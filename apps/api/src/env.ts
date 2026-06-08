/** Cloudflare Worker bindings — names only in docs; never log values. */
export interface AppBindings {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_ENV?: string;
  ALLOWED_ORIGINS?: string;
  /** Sprint 8 — AI generation gate (default false when unset). */
  AI_GENERATION_ENABLED?: string;
  /** Sprint 8 — local smoke without OpenRouter network (Task 8.6). */
  AI_PROVIDER_MOCK?: string;
  /** Sprint 8 — Worker-only; never log or expose to client. */
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  DEFAULT_AI_MODEL?: string;
  AI_CREDIT_COST_PROSE_BEAT?: string;
  AI_CREDIT_COST_PROSE_REWRITE?: string;
  AI_CREDIT_COST_PUBLISH_COPY?: string;
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

/** Required for JWT validation + profile/credit reads (Task 2.6+). */
export function assertAuthBindings(bindings: AppBindings): void {
  const missing: string[] = [];
  if (!bindings.SUPABASE_URL?.trim()) missing.push("SUPABASE_URL");
  if (!bindings.SUPABASE_ANON_KEY?.trim()) missing.push("SUPABASE_ANON_KEY");
  if (!bindings.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }
}

/** Alias for data routes that require service role. */
export function assertDataBindings(bindings: AppBindings): void {
  assertAuthBindings(bindings);
}