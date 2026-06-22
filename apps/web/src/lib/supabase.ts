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

function getSupabaseProjectRef(): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const match = host.match(/^([a-z0-9]{20})\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function removeAuthKeys(storage: Storage): void {
  const projectRef = getSupabaseProjectRef();
  const keys = new Set<string>(["supabase.auth.token"]);
  if (projectRef) keys.add(`sb-${projectRef}-auth-token`);

  for (const key of Object.keys(storage)) {
    if (/^sb-[a-z0-9]+-auth-token$/i.test(key)) keys.add(key);
  }

  for (const key of keys) {
    storage.removeItem(key);
  }
}

export function clearSupabaseAuthStorage(): void {
  if (typeof window === "undefined") return;
  removeAuthKeys(window.localStorage);
  removeAuthKeys(window.sessionStorage);
}

/** Browser Supabase client — anon key only; never service role. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
