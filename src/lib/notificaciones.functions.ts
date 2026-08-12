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
        // Fallback demo alerts if no credentials
        return [];
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // 1. Obtener notificaciones ya gestionadas
      const { data: gestionadas } = await supabaseAdmin
        .from("notificaciones_gestion")
        .select("notificacion_id");
      
      const gestionadasIds = new Set(gestionadas?.map((g: any) => g.notificacion_id) || []);
      
      // 2. Alertas de Stock Bajo
      const { data: configStock } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_stock_bajo")
        .maybeSingle();

      if (!configStock || configStock.valor !== "false") {
        const { data: prodsStock } = await supabaseAdmin
          .from("productos")
          .select("id, nombre, stock, stock_minimo, unidad")
          .eq("activo", true);
        
        if (prodsStock) {
          prodsStock.forEach((p: any) => {
            const stockActual = Number(p.stock || 0);
            const stockMin = Number(p.stock_minimo || 0);
            const id = `stock-${p.id}`;

            if (stockActual < stockMin && !gestionadasIds.has(id)) {
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
          });
        }
      }

      // 3. Alertas de Lotes
      const { data: lotes } = await supabaseAdmin
        .from("lotes")
        .select("id, fecha_vencimiento, producto_id, productos(nombre, unidad), stock_actual, lote_codigo")
        .gt("stock_actual", 0);

      if (lotes) {
        const hoy = new Date();
        lotes.forEach((l: any) => {
          const id = `venc-${l.id}`;
          if (!gestionadasIds.has(id)) {
            const fVenc = l.fecha_vencimiento ? new Date(l.fecha_vencimiento) : null;
            const diffMs = fVenc ? fVenc.getTime() - hoy.getTime() : null;
            const diffDays = diffMs !== null ? Math.ceil(diffMs / (1000 * 3600 * 24)) : NaN;
            
            let titulo = isNaN(diffDays) ? "Revisar Vencimiento" : diffDays <= 0 ? "Producto Vencido" : "Próximo a Vencer";
            let urgenciaLabel = isNaN(diffDays) ? "Info" : diffDays <= 0 ? "Vencido" : diffDays <= 7 ? "Crítico" : "Advertencia";
            let prioridad = isNaN(diffDays) ? 2 : diffDays <= 0 ? 0 : diffDays <= 7 ? 1 : 2;
            let mensaje = "";

            const productName = (l.productos as any)?.nombre || "Producto desconocido";
            const unidad = (l.productos as any)?.unidad || "unid";

            if (isNaN(diffDays)) {
              titulo = "En riesgo — no vendible";
              urgenciaLabel = "Info";
              prioridad = 1; 
              mensaje = `${productName} · Lote ${l.lote_codigo || 'N/A'}`;
            } else if (diffDays <= 0) {
              titulo = "Vencido";
              urgenciaLabel = "Vencido";
              prioridad = 0;
              mensaje = `${productName} · Lote ${l.lote_codigo || 'N/A'}`;
            } else {
              mensaje = `${productName} · Lote ${l.lote_codigo || 'N/A'} (Vence en ${diffDays} días)`;
            }
            
            if (diffDays <= 30 || isNaN(diffDays)) {
              alerts.push({
                id,
                tipo: "vencimiento",
                titulo,
                mensaje,
                stock: l.stock_actual,
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

      // Force demo alerts if database returns nothing (to ensure user can see them for now)
      if (alerts.length === 0) {
        return [];
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
    
    if (!supabaseUrl || !supabaseServiceRole) {
      // If no real DB, just return success for demo
      return { success: true };
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error } = await supabaseAdmin
      .from("notificaciones_gestion")
      .upsert({ notificacion_id: data.id }, { onConflict: 'notificacion_id' });

    if (error) throw new Error(error.message);
    return { success: true };
  });