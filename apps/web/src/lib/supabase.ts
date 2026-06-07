import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const isSupabaseConfigured = Boolean(url && anonKey);

/** Browser Supabase client — anon key only; never service role. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;