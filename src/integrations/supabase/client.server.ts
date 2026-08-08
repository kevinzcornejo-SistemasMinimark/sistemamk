import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRole = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  // If not in a server function (though this file is .server.ts), fail gracefully or use anon
  // but for admin tasks we need the secret.
}

export const supabaseAdmin = createClient(
  supabaseUrl || "",
  supabaseServiceRole || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
