/** Cloudflare Worker bindings — names only in docs; never log values. */
export interface AppBindings {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_ENV?: string;
  ALLOWED_ORIGINS?: string;
  /** Sprint 8 — AI generation gate (default false when unset). */
  AI_GENERATION_ENABLED?: string;
  /** Sprint 8 — local smoke without OpenRouter network. */
  AI_PROVIDER_MOCK?: string;
  /** Sprint 8 — mock behavior: success | fail_provider | unsafe_output */
  AI_PROVIDER_MOCK_MODE?: string;
  /** Sprint 8 — Worker-only; never log or expose to client. */
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  DEFAULT_AI_MODEL?: string;
  AI_MODEL_HEMAT?: string;
  AI_MODEL_SEIMBANG?: string;
  AI_MODEL_TERBAIK?: string;
  AI_TIMEOUT_MS?: string;
  AI_MAX_RETRIES?: string;
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
  aiGenerationEnabled: boolean;
  aiProviderMock: boolean;
  hasOpenRouterApiKey: boolean;
}

const DEFAULT_APP_ENV = "development";
const DEFAULT_ALLOWED_ORIGINS =
  "http://localhost:5173,http://localhost:5174,http://localhost:5175";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_AI_TIMEOUT_MS = 45_000;
const DEFAULT_AI_MAX_RETRIES = 1;

function parseTruthy(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function isAiGenerationEnabled(bindings: AppBindings): boolean {
  return parseTruthy(bindings.AI_GENERATION_ENABLED);
}

export function isAiProviderMock(bindings: AppBindings): boolean {
  return parseTruthy(bindings.AI_PROVIDER_MOCK);
}

export function getAiProviderMockMode(
  bindings: AppBindings,
): "success" | "fail_provider" | "unsafe_output" {
  const raw = bindings.AI_PROVIDER_MOCK_MODE?.trim().toLowerCase();
  if (raw === "fail_provider" || raw === "unsafe_output") return raw;
  return "success";
}

export function getOpenRouterBaseUrl(bindings: AppBindings): string {
  return bindings.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL;
}

export function getOpenRouterApiKey(bindings: AppBindings): string | undefined {
  const key = bindings.OPENROUTER_API_KEY?.trim();
  return key || undefined;
}

export function hasOpenRouterApiKey(bindings: AppBindings): boolean {
  return Boolean(getOpenRouterApiKey(bindings));
}

export function getDefaultAiModel(bindings: AppBindings): string | undefined {
  const model = bindings.DEFAULT_AI_MODEL?.trim();
  return model || undefined;
}

export function getAiTimeoutMs(bindings: AppBindings): number {
  const parsed = Number(bindings.AI_TIMEOUT_MS?.trim());
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return DEFAULT_AI_TIMEOUT_MS;
}

export function getAiMaxRetries(bindings: AppBindings): number {
  const parsed = Number(bindings.AI_MAX_RETRIES?.trim());
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  return DEFAULT_AI_MAX_RETRIES;
}

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
    aiGenerationEnabled: isAiGenerationEnabled(bindings),
    aiProviderMock: isAiProviderMock(bindings),
    hasOpenRouterApiKey: hasOpenRouterApiKey(bindings),
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