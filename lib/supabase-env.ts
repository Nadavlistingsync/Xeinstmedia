function firstDefinedEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function getSupabaseUrl() {
  return firstDefinedEnv([
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "STORAGE_SUPABASE_URL",
  ]);
}

export function getSupabaseAnonKey() {
  return firstDefinedEnv([
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_STORAGE_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_STORAGE_SUPABASE_PUBLISHABLE_KEY",
  ]);
}

export function getSupabaseServiceKey() {
  return firstDefinedEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "STORAGE_SUPABASE_SERVICE_ROLE_KEY",
    "STORAGE_SUPABASE_SECRET_KEY",
  ]);
}
