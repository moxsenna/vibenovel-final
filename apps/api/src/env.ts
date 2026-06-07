/** Cloudflare Worker bindings — names only in docs; never log values. */
export interface AppBindings {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_ENV?: string;
  ALLOWED_ORIGINS?: string;
}

export interface EnvPresenceFlags {
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasSupabaseServiceRoleKey: boolean;
  appEnv: string;
  allowedOriginsCount: number;
}

const DEFAULT_APP_ENV = "development";
const DEFAULT_ALLOWED_ORIGINS =
  "http://localhost:5173,http://localhost:5174,http://localhost:5175";

export function getAppEnv(bindings: AppBindings): string {
  return bindings.APP_ENV?.trim() || DEFAULT_APP_ENV;
}

export function getAllowedOrigins(bindings: AppBindings): string[] {
  const raw = bindings.ALLOWED_ORIGINS?.trim() || DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Safe flags for /health — never exposes secret values. */
export function getEnvPresenceFlags(bindings: AppBindings): EnvPresenceFlags {
  return {
    hasSupabaseUrl: Boolean(bindings.SUPABASE_URL?.trim()),
    hasSupabaseAnonKey: Boolean(bindings.SUPABASE_ANON_KEY?.trim()),
    hasSupabaseServiceRoleKey: Boolean(bindings.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    appEnv: getAppEnv(bindings),
    allowedOriginsCount: getAllowedOrigins(bindings).length,
  };
}

/**
 * Validates required bindings for future data routes (Task 2.6+).
 * Not enforced on /health — scaffold only.
 */
export function assertDataBindings(bindings: AppBindings): void {
  const missing: string[] = [];
  if (!bindings.SUPABASE_URL?.trim()) missing.push("SUPABASE_URL");
  if (!bindings.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }
}