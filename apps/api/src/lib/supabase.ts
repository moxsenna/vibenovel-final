import type { AppBindings } from "../env.js";

/**
 * Supabase client factory shell — no queries in Task 2.5.
 * Wire @supabase/supabase-js in Task 2.6+.
 */
export type SupabaseClientKind = "anon" | "service_role";

export interface SupabaseClientShell {
  kind: SupabaseClientKind;
  url: string;
}

export function createAnonClientShell(
  bindings: AppBindings,
): SupabaseClientShell | null {
  const url = bindings.SUPABASE_URL?.trim();
  const key = bindings.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { kind: "anon", url };
}

/** Service role — server only; never expose to browser. */
export function createServiceRoleClientShell(
  bindings: AppBindings,
): SupabaseClientShell | null {
  const url = bindings.SUPABASE_URL?.trim();
  const key = bindings.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { kind: "service_role", url };
}