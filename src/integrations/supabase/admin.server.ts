import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con Service Role Key.
 * SOLO PARA USO EN EL SERVIDOR. Bypassa RLS y permite gestión de usuarios (auth.admin).
 */
export const getSupabaseAdmin = () => {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SB_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno SB_SERVICE_ROLE_KEY o VITE_SUPABASE_URL");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
