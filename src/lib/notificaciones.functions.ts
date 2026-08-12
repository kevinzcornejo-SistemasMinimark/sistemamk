import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const getNotificacionesAlertas = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const alerts: any[] = [];
      
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
      const supabaseServiceRole = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "placeholder";

      if (!supabaseUrl || !supabaseServiceRole) {
        console.error("Missing Supabase Admin credentials");
        return [];
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // 1. Obtener notificaciones ya gestionadas
      const { data: gestionadas } = await supabaseAdmin
        .from("notificaciones_gestion")
        .select("notificacion_id");
      
      const gestionadasIds = new Set(gestionadas?.map(g => g.notificacion_id) || []);
      
      // 2. Alertas de Stock Bajo
      // Verificamos si la configuración permite stock bajo (por defecto sí)
      const { data: configStock } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_stock_bajo")
        .maybeSingle();

      if (!configStock || configStock.valor !== "false") {
        const { data: prodsStock, error: errStock } = await supabaseAdmin
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
                titulo: "Stock Bajo",
                mensaje: `El producto ${p.nombre} tiene stock ${stockActual} (mínimo ${stockMin}).`,
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

      // 3. Alertas de Lotes por Vencer
      const { data: lotes, error: errLotes } = await supabaseAdmin
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
            
            // Alertar si faltan 30 días o menos, o si ya venció
            if (diffDays <= 30 || isNaN(diffDays)) {
              const productName = (l.productos as any)?.nombre || "Producto desconocido";
              const unidad = (l.productos as any)?.unidad || "unid";
              const loteInfo = l.lote_codigo ? ` (Lote: ${l.lote_codigo})` : "";
              
              alerts.push({
                id,
                tipo: "vencimiento",
                titulo: isNaN(diffDays) ? "Revisar Vencimiento" : diffDays <= 0 ? "Producto Vencido" : "Próximo a Vencer",
                mensaje: isNaN(diffDays)
                  ? `El producto ${productName}${loteInfo} no tiene fecha de vencimiento definida.`
                  : diffDays <= 0 
                    ? `El producto ${productName}${loteInfo} venció el ${l.fecha_vencimiento}.` 
                    : `El producto ${productName}${loteInfo} vence en ${diffDays} días.`,
                stock: l.stock_actual,
                unidad: unidad,
                fecha: new Date().toISOString(),
                diasRestantes: isNaN(diffDays) ? null : diffDays,
                prioridad: isNaN(diffDays) ? 2 : diffDays <= 0 ? 0 : diffDays <= 7 ? 1 : 2,
                urgenciaLabel: isNaN(diffDays) ? "Info" : diffDays <= 0 ? "Vencido" : diffDays <= 7 ? "Crítico" : "Advertencia"
              });
            }
          }
        });
      }

      // 4. Ordenar por prioridad (menor número = más urgente)
      const finalAlerts = alerts.sort((a, b) => a.prioridad - b.prioridad);
      console.log(`Retrieved ${finalAlerts.length} alerts for notifications panel`);
      return finalAlerts;
    } catch (err: any) {
      console.error("Error in getNotificacionesAlertas:", err);
      // Retornar una alerta de error para diagnosticar en el UI si es necesario
      return [{
        id: "error-diag",
        tipo: "error",
        titulo: "Error de Conexión",
        mensaje: `No se pudieron cargar las alertas: ${err?.message || "Error desconocido"}`,
        prioridad: 0,
        urgenciaLabel: "Error",
        stock: 0,
        unidad: "-",
        fecha: new Date().toISOString()
      }];
    }
  });

export const resolverNotificacion = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const supabaseServiceRole = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceRole!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error } = await supabaseAdmin
      .from("notificaciones_gestion")
      .upsert({ notificacion_id: data.id }, { onConflict: 'notificacion_id' });

    if (error) throw new Error(error.message);
    return { success: true };
  });
