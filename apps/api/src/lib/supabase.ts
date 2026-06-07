import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppBindings } from "../env.js";

const CLIENT_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
} as const;

function requireUrl(bindings: AppBindings): string {
  const url = bindings.SUPABASE_URL?.trim();
  if (!url) throw new Error("SUPABASE_URL is not configured");
  return url;
}

/** Anon client — JWT validation via auth.getUser(token). */
export function createAnonClient(bindings: AppBindings): SupabaseClient {
  const url = requireUrl(bindings);
  const key = bindings.SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error("SUPABASE_ANON_KEY is not configured");
  return createClient(url, key, CLIENT_OPTIONS);
}

/** Service role — server only; bypasses RLS for profile sync. Never expose to client. */
export function createServiceRoleClient(bindings: AppBindings): SupabaseClient {
  const url = requireUrl(bindings);
  const key = bindings.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(url, key, CLIENT_OPTIONS);
}