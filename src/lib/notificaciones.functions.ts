import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const getNotificacionesAlertas = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const alerts: any[] = [];
      
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseServiceRole = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

      if (!supabaseUrl || !supabaseServiceRole) {
        console.error("Missing Supabase Admin credentials");
        return [];
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Obtener notificaciones ya gestionadas
      const { data: gestionadas } = await supabaseAdmin
        .from("notificaciones_gestion")
        .select("notificacion_id");
      
      const gestionadasIds = new Set(gestionadas?.map(g => g.notificacion_id) || []);
      
      // 1. Alertas de Stock Bajo
      const { data: configStock } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_stock_bajo")
        .maybeSingle();

      if (configStock?.valor !== "false") {
        const { data: prodsStock } = await supabaseAdmin
          .from("productos")
          .select("id, nombre, stock, stock_minimo, unidad")
          .lt("stock", "stock_minimo")
          .eq("activo", true);
        
        if (prodsStock) {
          prodsStock.forEach((p: any) => {
            const id = `stock-${p.id}`;
            if (!gestionadasIds.has(id)) {
              alerts.push({
                id,
                tipo: "stock",
                titulo: "Stock Bajo",
                mensaje: `El producto ${p.nombre} tiene stock ${p.stock} (mínimo ${p.stock_minimo}).`,
                stock: p.stock,
                unidad: p.unidad,
                fecha: new Date().toISOString(),
                prioridad: 1,
                urgenciaLabel: "Crítico",
                diasRestantes: null
              });
            }
          });
        }
      }

      // 2. Alertas de Lotes por Vencer
      const { data: lotes } = await supabaseAdmin
        .from("lotes")
        .select("id, fecha_vencimiento, producto_id, productos(nombre, unidad), stock_actual, lote_codigo")
        .gt("stock_actual", 0)
        .not("fecha_vencimiento", "is", null);

      if (lotes) {
        const hoy = new Date();
        lotes.forEach((l: any) => {
          const id = `venc-${l.id}`;
          if (!gestionadasIds.has(id)) {
            const fVenc = new Date(l.fecha_vencimiento);
            const diffMs = fVenc.getTime() - hoy.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));
            
            if (diffDays <= 30) {
              const productName = (l.productos as any)?.nombre || "producto";
              const unidad = (l.productos as any)?.unidad || "unid";
              const loteInfo = l.lote_codigo ? ` (Lote: ${l.lote_codigo})` : "";
              
              alerts.push({
                id,
                tipo: "vencimiento",
                titulo: diffDays <= 0 ? "Producto Vencido" : "Próximo a Vencer",
                mensaje: diffDays <= 0 
                  ? `El producto ${productName}${loteInfo} venció el ${l.fecha_vencimiento}.` 
                  : `El producto ${productName}${loteInfo} vence en ${diffDays} días.`,
                stock: l.stock_actual,
                unidad: unidad,
                fecha: new Date().toISOString(),
                diasRestantes: diffDays,
                prioridad: diffDays <= 0 ? 0 : diffDays <= 7 ? 1 : 2,
                urgenciaLabel: diffDays <= 0 ? "Vencido" : diffDays <= 7 ? "Crítico" : "Advertencia"
              });
            }
          }
        });
      }

      return alerts.sort((a, b) => a.prioridad - b.prioridad);
    } catch (err) {
      console.error("Error in getNotificacionesAlertas:", err);
      return [];
    }
  });

export const resolverNotificacion = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceRole = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    
    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRole!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error } = await supabaseAdmin
      .from("notificaciones_gestion")
      .insert({ notificacion_id: data.id });

    if (error) throw new Error(error.message);
    return { success: true };
  });
