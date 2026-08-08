import { createFileRoute } from '@tanstack/react-router'
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute('/api/public/debug-notifications')({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseServiceRole = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

        if (!supabaseUrl || !supabaseServiceRole) {
           return new Response(JSON.stringify({ error: "Missing admin keys", url: !!supabaseUrl, key: !!supabaseServiceRole }), { 
             headers: { 'content-type': 'application/json' } 
           });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);
        
        // 1. Verificar configuración
        const { data: config } = await supabaseAdmin
          .from("configuracion")
          .select("*")
          .in("clave", ["notif_stock_bajo", "notif_licencia", "notif_vencimiento", "notif_descuentos_grandes"]);
        
        // 2. Verificar productos con stock bajo
        const { data: stockBajo } = await supabaseAdmin
          .from("productos")
          .select("nombre, stock, stock_minimo")
          .lt("stock", "stock_minimo")
          .eq("activo", true);
          
        // 3. Verificar lotes por vencer
        const hoy = new Date();
        const { data: lotes } = await supabaseAdmin
          .from("lotes")
          .select("id, fecha_vencimiento, stock_actual")
          .gt("stock_actual", 0)
          .not("fecha_vencimiento", "is", null);
          
        return new Response(JSON.stringify({ config, stockBajo, lotesCount: lotes?.length, rawKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')) }), { 
          headers: { 'content-type': 'application/json' } 
        });
      }
    }
  }
})
