import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

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
      
      // 1. Alertas de Stock Bajo
      const { data: configStock, error: configStockError } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_stock_bajo")
        .maybeSingle();

      if (configStock?.valor === "true") {
        const { data: prodsStock, error: prodsError } = await supabaseAdmin
          .from("productos")
          .select("id, nombre, stock, stock_minimo")
          .lt("stock", "stock_minimo")
          .eq("activo", true);
        
        if (!prodsError && prodsStock) {
          prodsStock.forEach((p: any) => {
            alerts.push({
              id: `stock-${p.id}`,
              tipo: "stock",
              titulo: "Stock Bajo",
              mensaje: `El producto ${p.nombre} tiene stock ${p.stock} (mínimo ${p.stock_minimo})`,
              fecha: new Date().toISOString(),
              leida: false,
              prioridad: "alta"
            });
          });
        }
      }

      // 2. Alertas de Licencia
      const { data: configLic, error: configLicError } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_licencia")
        .maybeSingle();

      if (configLic?.valor === "true") {
        const { data: lic, error: licError } = await supabaseAdmin
          .from("licencia")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (!licError && lic?.fecha_vencimiento) {
          const d = (new Date(lic.fecha_vencimiento).getTime() - Date.now()) / 86400000;
          const dias = Math.floor(d);
          if (dias <= 7) {
            alerts.push({
              id: `licencia-${lic.id}`,
              tipo: "licencia",
              titulo: dias <= 0 ? "Licencia Vencida" : "Licencia por Vencer",
              mensaje: dias <= 0 ? "La licencia ha vencido. Renueva pronto." : `La licencia vence en ${dias} días.`,
              fecha: new Date().toISOString(),
              leida: false,
              prioridad: dias <= 3 ? "critica" : "media"
            });
          }
        }
      }

      return alerts;
    } catch (err) {
      console.error("Critical error in getNotificacionesAlertas:", err);
      return [];
    }
  });
