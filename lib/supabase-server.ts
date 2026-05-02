import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabase-env";

export function getSupabaseServerClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceKey();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase server env is missing. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or the STORAGE_SUPABASE_* equivalents in Vercel.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
