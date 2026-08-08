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
      const { data: configStock } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_stock_bajo")
        .maybeSingle();

      if (configStock?.valor === "true" || !configStock) { // Por defecto true si no existe
        const { data: prodsStock, error: prodsError } = await supabaseAdmin
          .from("productos")
          .select("id, nombre, stock, stock_minimo, unidad")
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
      const { data: configLic } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_licencia")
        .maybeSingle();

      if (configLic?.valor === "true" || !configLic) { // Por defecto true
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

      // 3. Alertas de Productos por Vencer (Lotes)
      const { data: configVenc } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_vencimiento")
        .maybeSingle();

      if (configVenc?.valor !== "false") { // Por defecto true
        const { data: lotes, error: lotesError } = await supabaseAdmin
          .from("lotes")
          .select("id, fecha_vencimiento, producto_id, productos(nombre)")
          .gt("stock_actual", 0)
          .not("fecha_vencimiento", "is", null);

        if (!lotesError && lotes) {
          const hoy = new Date();
          lotes.forEach((l: any) => {
            const fVenc = new Date(l.fecha_vencimiento);
            const diffDays = Math.ceil((fVenc.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
            
            if (diffDays <= 30) {
              alerts.push({
                id: `venc-${l.id}`,
                tipo: "vencimiento",
                titulo: diffDays <= 0 ? "Producto Vencido" : "Próximo a Vencer",
                mensaje: diffDays <= 0 
                  ? `El lote de ${(l.productos as any)?.nombre || "producto"} ha vencido.` 
                  : `El lote de ${(l.productos as any)?.nombre || "producto"} vence en ${diffDays} días.`,
                fecha: new Date().toISOString(),
                leida: false,
                prioridad: diffDays <= 7 ? "alta" : "media"
              });
            }
          });
        }
      }

      // 4. Alertas de Ventas con Descuento Grande (Auditoría)
      const { data: configDesc } = await supabaseAdmin
        .from("configuracion")
        .select("valor")
        .eq("clave", "notif_descuentos_grandes")
        .maybeSingle();

      if (configDesc?.valor === "true" || !configDesc) { // Por defecto true
        const { data: descs, error: descError } = await supabaseAdmin
          .from("descuentos_auditoria")
          .select("id, monto_descuento, creado_en, motivo, autorizado_por, venta_id")
          .order("creado_en", { ascending: false })
          .limit(10);

        if (!descError && descs) {
          descs.forEach((d: any) => {
            if (d.monto_descuento > 20) { // Ejemplo: descuento > S/ 20
              alerts.push({
                id: `desc-${d.id}`,
                tipo: "descuento",
                titulo: "Descuento Aplicado",
                mensaje: `Se aplicó un descuento de S/ ${d.monto_descuento.toFixed(2)} por ${d.motivo}.`,
                fecha: d.creado_en,
                leida: false,
                prioridad: "media"
              });
            }
          });
        }
      }

      return alerts;
    } catch (err) {
      console.error("Critical error in getNotificacionesAlertas:", err);
      return [];
    }
  });
