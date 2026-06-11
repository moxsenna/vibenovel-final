import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
// Accept either the legacy anon JWT key or the newer publishable key
// (`sb_publishable_…`). Production env ships the publishable key, so falling
// back here prevents an unconfigured (null) client that silently blocks auth.
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";

export const isSupabaseConfigured = Boolean(url && anonKey);

/** Browser Supabase client — anon key only; never service role. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;