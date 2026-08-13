import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getNotificacionesAlertas = createServerFn({ method: "GET" })
  .handler(async () => {
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
      
      const supabaseClient = supabase;

      // 1. Obtener notificaciones ya gestionadas
      const { data: gestionadas } = await supabaseClient
        .from("notificaciones_gestion")
        .select("notificacion_id");
      
      const gestionadasIds = new Set(gestionadas?.map((g: any) => g.notificacion_id) || []);
      stats.gestionadasOmitidas = gestionadasIds.size;
      
      // 2. Alertas de Stock Bajo
      const { data: prodsStock } = await supabaseClient
        .from("productos")
        .select("id, nombre, stock, stock_minimo, activo, unidad");
      
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

      // 3. Alertas de Lotes
      const { data: lotes } = await supabaseClient
        .from("lotes")
        .select("id, fecha_vencimiento, producto_id, productos(nombre, unidad), cantidad_actual, numero_lote");

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
              let titulo = isNaN(diffDays) ? "En riesgo — no vendible" : diffDays <= 0 ? "Vencido" : "Próximo a Vencer";
              let urgenciaLabel = isNaN(diffDays) ? "Info" : diffDays <= 0 ? "Vencido" : diffDays <= 7 ? "Crítico" : "Advertencia";
              let prioridad = isNaN(diffDays) ? 1 : diffDays <= 0 ? 0 : diffDays <= 7 ? 1 : 2;
              
              const productName = (l.productos as any)?.nombre || "Producto desconocido";
              const unidad = (l.productos as any)?.unidad || "unid";
              let mensaje = isNaN(diffDays) 
                ? `${productName} · Lote ${l.numero_lote || 'N/A'}`
                : diffDays <= 0 
                  ? `${productName} · Lote ${l.numero_lote || 'N/A'}`
                  : `${productName} · Lote ${l.numero_lote || 'N/A'} (Vence en ${diffDays} días)`;

              alerts.push({
                id,
                tipo: "vencimiento",
                titulo,
                mensaje,
                stock: stockLote,
                unidad: unidad,
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
        debug: `OK: Analizados ${stats.totalProductos} productos y ${stats.lotesAnalizados} lotes.`
      };
    } catch (err) {
      console.error("Error in getNotificacionesAlertas:", err);
      return { alerts: [], stats: {}, debug: `Error: ${err instanceof Error ? err.message : String(err)}` };
    }
  });


export const resolverNotificacion = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("notificaciones_gestion")
      .upsert({ notificacion_id: data.id }, { onConflict: 'notificacion_id' });

    if (error) throw new Error(error.message);
    return { success: true };
  });