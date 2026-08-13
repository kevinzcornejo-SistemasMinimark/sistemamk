import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente administrativo para bypass RLS solo en el servidor si es necesario
// NOTA: En un Worker de Cloudflare, process.env es accesible dentro del handler.


// Mantenemos como server function pero aseguramos que use el cliente con la sesión actual
export const getNotificacionesAlertas = createServerFn({ method: "GET" })
  .handler(async () => {
    console.log("Iniciando getNotificacionesAlertas en el servidor...");
    try {
      const alerts: any[] = [];
      const stats = {
        totalProductos: 0,
        productosActivos: 0,
        conStockMinimoConfig: 0,
        bajoStock: 0,
        lotesAnalizados: 0,
        lotesConStock: 0,
        lotesProximosVencer: 0,
        gestionadasOmitidas: 0
      };
      
      // Preferir el cliente con la sesión del usuario para respetar RLS y auditoría.
      // Si el Service Role está presente y hay errores de permiso, se puede usar como fallback.
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const client = supabase; 
      
      console.log("Servidor: Usando cliente con sesión de usuario (RLS activo)");

      // 1. Productos
      const { data: prodsStock, error: prodsError } = await client
        .from("productos")
        .select("id, nombre, stock, stock_minimo, activo, unidad");
      
      if (prodsError) {
        console.error("Error en servidor fetching productos:", prodsError);
        throw prodsError;
      }

      // 2. Lotes
      const { data: lotes, error: lotesError } = await client
        .from("lotes")
        .select("id, fecha_vencimiento, producto_id, productos(nombre, unidad), cantidad_actual, numero_lote");

      if (lotesError) {
        console.error("Error en servidor fetching lotes:", lotesError);
      }


      const { data: gestionadas } = await client
        .from("notificaciones_gestion")
        .select("notificacion_id");

      
      const gestionadasIds = new Set(gestionadas?.map((g: any) => g.notificacion_id) || []);
      stats.gestionadasOmitidas = gestionadasIds.size;

      // Procesar productos
      if (prodsStock) {
        stats.totalProductos = prodsStock.length;
        prodsStock.forEach((p: any) => {
          if (!p.activo) return;
          stats.productosActivos++;
          const stockActual = Number(p.stock || 0);
          const stockMin = Number(p.stock_minimo || 0);
          if (stockMin > 0) stats.conStockMinimoConfig++;
          if (stockActual < stockMin) {
            stats.bajoStock++;
            const id = `stock-${p.id}`;
            if (!gestionadasIds.has(id)) {
              alerts.push({
                id,
                tipo: "stock",
                titulo: "Stock Mínimo",
                mensaje: `El producto ${p.nombre} tiene stock bajo: ${stockActual} (mínimo ${stockMin}).`,
                stock: stockActual,
                unidad: p.unidad || "unid",
                fecha: new Date().toISOString(),
                prioridad: 1,
                urgenciaLabel: "Crítico",
                diasRestantes: null
              });
            }
          }
        });
      }

      // Procesar lotes
      if (lotes) {
        stats.lotesAnalizados = lotes.length;
        const hoy = new Date();
        lotes.forEach((l: any) => {
          const stockLote = Number(l.cantidad_actual || 0);
          if (stockLote <= 0) return;
          stats.lotesConStock++;
          const fVenc = l.fecha_vencimiento ? new Date(l.fecha_vencimiento) : null;
          const diffMs = fVenc ? fVenc.getTime() - hoy.getTime() : null;
          const diffDays = diffMs !== null ? Math.ceil(diffMs / (1000 * 3600 * 24)) : NaN;
          
          if (isNaN(diffDays) || diffDays <= 30) {
            stats.lotesProximosVencer++;
            const id = `venc-${l.id}`;
            if (!gestionadasIds.has(id)) {
              let titulo = isNaN(diffDays) ? "En riesgo" : diffDays <= 0 ? "Vencido" : "Próximo a Vencer";
              let urgenciaLabel = isNaN(diffDays) ? "Info" : diffDays <= 0 ? "Vencido" : diffDays <= 7 ? "Crítico" : "Advertencia";
              let prioridad = isNaN(diffDays) ? 1 : diffDays <= 0 ? 0 : diffDays <= 7 ? 1 : 2;
              const productName = (l.productos as any)?.nombre || "Producto";
              alerts.push({
                id,
                tipo: "vencimiento",
                titulo,
                mensaje: `${productName} · Lote ${l.numero_lote || 'N/A'} ${isNaN(diffDays) ? '' : (diffDays <= 0 ? '(Vencido)' : `(Vence en ${diffDays} días)`)}`,
                stock: stockLote,
                unidad: (l.productos as any)?.unidad || "unid",
                fecha: new Date().toISOString(),
                diasRestantes: isNaN(diffDays) ? null : diffDays,
                prioridad,
                urgenciaLabel
              });
            }
          }
        });
      }

      return { 
        alerts: alerts.sort((a, b) => a.prioridad - b.prioridad),
        stats,
        debug: `Servidor: ${stats.totalProductos} productos y ${stats.lotesAnalizados} lotes detectados.`
      };
    } catch (err: any) {
      return { 
        alerts: [], 
        stats: { totalProductos: 0, lotesAnalizados: 0 }, 
        debug: `Error Servidor: ${err.message || String(err)}` 
      };
    }
  });

export const resolverNotificacion = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const client = supabase;

    const { error } = await client
      .from("notificaciones_gestion")
      .upsert({ notificacion_id: data.id }, { onConflict: 'notificacion_id' });

    if (error) throw new Error(error.message);
    return { success: true };
  });