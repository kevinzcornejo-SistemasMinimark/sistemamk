import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export const getDiagnosticInfo = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseServiceRole = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

      const results = {
        env: {
          url: !!supabaseUrl,
          key: !!supabaseServiceRole,
          keys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('ROLE'))
        },
        db: {}
      };

      if (supabaseUrl && supabaseServiceRole) {
        const supabase = createClient(supabaseUrl, supabaseServiceRole);
        
        const { data: config } = await supabase.from("configuracion").select("*");
        const { data: products } = await supabase.from("productos").select("nombre, stock, stock_minimo").lt("stock", "stock_minimo");
        
        results.db = {
          config: config?.length,
          lowStock: products
        };
      }

      return results;
    } catch (e: any) {
      return { error: e.message };
    }
  });
