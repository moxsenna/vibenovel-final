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
  /** Sprint 10 — credit topup checkout gate (default false when unset). */
  CREDIT_TOPUP_ENABLED?: string;
  /** Sprint 10 — local smoke without Mayar network (default false when unset). */
  PAYMENT_PROVIDER_MOCK?: string;
  /** Sprint 10 — mock behavior: success | fail_provider | invalid_response */
  PAYMENT_PROVIDER_MOCK_MODE?: string;
  /** Sprint 10 — Worker-only; never log or expose to client. */
  MAYAR_API_KEY?: string;
  MAYAR_BASE_URL?: string;
  /** Sprint 10 — sandbox | production (default sandbox). */
  MAYAR_ENV?: string;
  /** Sprint 10 — web origin for Mayar redirectUrl. */
  MAYAR_REDIRECT_BASE_URL?: string;
  PAYMENT_TIMEOUT_MS?: string;
  /** Sprint 10.10 — active payment provider when mock is off: mock | mayar | duitku */
  PAYMENT_PROVIDER?: string;
  /** Sprint 10.10 — generic web return base (optional alias over provider-specific URLs). */
  PAYMENT_RETURN_BASE_URL?: string;
  /** Sprint 10.10 — Duitku POP credentials (Worker-only). */
  DUITKU_MERCHANT_CODE?: string;
  DUITKU_MERCHANT_KEY?: string;
  DUITKU_ENV?: string;
  DUITKU_BASE_URL?: string;
  DUITKU_CALLBACK_URL?: string;
  DUITKU_RETURN_URL?: string;
  DUITKU_TIMEOUT_MS?: string;
  /** Sprint 10.12 — force local smoke callback fixture credentials. */
  DUITKU_SMOKE_CALLBACK_FIXTURE?: string;
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
  creditTopupEnabled: boolean;
  paymentProviderMock: boolean;
  hasMayarApiKey: boolean;
  mayarEnv: string;
  paymentProvider: string;
  duitkuEnv: string;
  hasDuitkuMerchantCode: boolean;
  hasDuitkuMerchantKey: boolean;
  hasDuitkuCallbackUrl: boolean;
  duitkuCallbackUrlIsPublic: boolean;
  duitkuSmokeCallbackFixture: boolean;
}

const DEFAULT_APP_ENV = "development";
const DEFAULT_ALLOWED_ORIGINS =
  "http://localhost:5173,http://localhost:5174,http://localhost:5175";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_AI_TIMEOUT_MS = 45_000;
const DEFAULT_AI_MAX_RETRIES = 1;

const DEFAULT_MAYAR_SANDBOX_BASE_URL = "https://api.mayar.club/hl/v1";
const DEFAULT_MAYAR_PRODUCTION_BASE_URL = "https://api.mayar.id/hl/v1";
const DEFAULT_MAYAR_REDIRECT_BASE_URL = "http://localhost:5173";
const DEFAULT_PAYMENT_TIMEOUT_MS = 30_000;

const DEFAULT_DUITKU_SANDBOX_POP_BASE_URL = "https://api-sandbox.duitku.com";
const DEFAULT_DUITKU_PRODUCTION_POP_BASE_URL = "https://api-prod.duitku.com";

/** Local-only smoke fixture — not a production secret; documented in .dev.vars.example. */
export const DUITKU_SMOKE_CALLBACK_MERCHANT_CODE = "SMOKE01";
export const DUITKU_SMOKE_CALLBACK_MERCHANT_KEY = "smoke-local-duitku-callback-key";

export type PaymentProviderName = "mock" | "mayar" | "duitku";

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

export function isCreditTopupEnabled(bindings: AppBindings): boolean {
  return parseTruthy(bindings.CREDIT_TOPUP_ENABLED);
}

export function isPaymentProviderMock(bindings: AppBindings): boolean {
  return parseTruthy(bindings.PAYMENT_PROVIDER_MOCK);
}

export function getPaymentProviderMockMode(
  bindings: AppBindings,
): "success" | "fail_provider" | "invalid_response" {
  const raw = bindings.PAYMENT_PROVIDER_MOCK_MODE?.trim().toLowerCase();
  if (raw === "fail_provider" || raw === "invalid_response") return raw;
  return "success";
}

export function getMayarEnv(bindings: AppBindings): "sandbox" | "production" {
  const raw = bindings.MAYAR_ENV?.trim().toLowerCase();
  if (raw === "production") return "production";
  return "sandbox";
}

export function getMayarApiKey(bindings: AppBindings): string | undefined {
  const key = bindings.MAYAR_API_KEY?.trim();
  return key || undefined;
}

export function hasMayarApiKey(bindings: AppBindings): boolean {
  return Boolean(getMayarApiKey(bindings));
}

export function getMayarBaseUrl(bindings: AppBindings): string {
  const explicit = bindings.MAYAR_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return getMayarEnv(bindings) === "production"
    ? DEFAULT_MAYAR_PRODUCTION_BASE_URL
    : DEFAULT_MAYAR_SANDBOX_BASE_URL;
}

export function getMayarRedirectBaseUrl(bindings: AppBindings): string {
  const raw = bindings.MAYAR_REDIRECT_BASE_URL?.trim();
  return (raw || DEFAULT_MAYAR_REDIRECT_BASE_URL).replace(/\/$/, "");
}

/** Generic payment return base — prefers PAYMENT_RETURN_BASE_URL, then DUITKU_RETURN_URL, then Mayar. */
export function getPaymentReturnBaseUrl(bindings: AppBindings): string {
  const generic = bindings.PAYMENT_RETURN_BASE_URL?.trim();
  if (generic) return generic.replace(/\/$/, "");
  const duitku = bindings.DUITKU_RETURN_URL?.trim();
  if (duitku) return duitku.replace(/\/$/, "");
  return getMayarRedirectBaseUrl(bindings);
}

export function getPaymentProvider(bindings: AppBindings): PaymentProviderName {
  const raw = bindings.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (raw === "duitku") return "duitku";
  if (raw === "mock") return "mock";
  if (raw === "mayar") return "mayar";
  return "mayar";
}

export function getDuitkuEnv(bindings: AppBindings): "sandbox" | "production" {
  const raw = bindings.DUITKU_ENV?.trim().toLowerCase();
  if (raw === "production") return "production";
  return "sandbox";
}

export function getDuitkuMerchantCode(bindings: AppBindings): string | undefined {
  const code = bindings.DUITKU_MERCHANT_CODE?.trim();
  return code || undefined;
}

export function getDuitkuMerchantKey(bindings: AppBindings): string | undefined {
  const key = bindings.DUITKU_MERCHANT_KEY?.trim();
  return key || undefined;
}

export function hasDuitkuMerchantCode(bindings: AppBindings): boolean {
  return Boolean(getDuitkuMerchantCode(bindings));
}

export function hasDuitkuMerchantKey(bindings: AppBindings): boolean {
  return Boolean(getDuitkuMerchantKey(bindings));
}

/** Local smoke callback fixture when real Duitku keys are unset (development only). */
export function isDuitkuSmokeCallbackFixtureEnabled(bindings: AppBindings): boolean {
  if (parseTruthy(bindings.DUITKU_SMOKE_CALLBACK_FIXTURE)) return true;
  return (
    getAppEnv(bindings) === "development" &&
    !hasDuitkuMerchantCode(bindings) &&
    !hasDuitkuMerchantKey(bindings)
  );
}

/** Credentials for Duitku callback signature validation (real keys or local smoke fixture). */
export function getDuitkuCallbackMerchantCode(bindings: AppBindings): string | undefined {
  const real = getDuitkuMerchantCode(bindings);
  if (real) return real;
  if (isDuitkuSmokeCallbackFixtureEnabled(bindings)) {
    return DUITKU_SMOKE_CALLBACK_MERCHANT_CODE;
  }
  return undefined;
}

export function getDuitkuCallbackMerchantKey(bindings: AppBindings): string | undefined {
  const real = getDuitkuMerchantKey(bindings);
  if (real) return real;
  if (isDuitkuSmokeCallbackFixtureEnabled(bindings)) {
    return DUITKU_SMOKE_CALLBACK_MERCHANT_KEY;
  }
  return undefined;
}

export function getDuitkuPopBaseUrl(bindings: AppBindings): string {
  const explicit = bindings.DUITKU_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return getDuitkuEnv(bindings) === "production"
    ? DEFAULT_DUITKU_PRODUCTION_POP_BASE_URL
    : DEFAULT_DUITKU_SANDBOX_POP_BASE_URL;
}

export function getDuitkuCallbackUrl(bindings: AppBindings): string | undefined {
  const raw = bindings.DUITKU_CALLBACK_URL?.trim();
  return raw || undefined;
}

export function hasDuitkuCallbackUrl(bindings: AppBindings): boolean {
  return Boolean(getDuitkuCallbackUrl(bindings));
}

/** True when callback host is reachable from Duitku (not localhost/loopback). */
export function isDuitkuCallbackUrlPublic(bindings: AppBindings): boolean {
  const url = getDuitkuCallbackUrl(bindings);
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

export function getDuitkuReturnUrl(bindings: AppBindings): string | undefined {
  const raw = bindings.DUITKU_RETURN_URL?.trim();
  return raw || undefined;
}

export function isPaymentSandboxMode(bindings: AppBindings): boolean {
  if (isPaymentProviderMock(bindings)) return true;
  if (getPaymentProvider(bindings) === "duitku") {
    return getDuitkuEnv(bindings) === "sandbox";
  }
  return getMayarEnv(bindings) === "sandbox";
}

export function getPaymentTimeoutMs(bindings: AppBindings): number {
  const parsed = Number(bindings.PAYMENT_TIMEOUT_MS?.trim());
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return DEFAULT_PAYMENT_TIMEOUT_MS;
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
    creditTopupEnabled: isCreditTopupEnabled(bindings),
    paymentProviderMock: isPaymentProviderMock(bindings),
    hasMayarApiKey: hasMayarApiKey(bindings),
    mayarEnv: getMayarEnv(bindings),
    paymentProvider: isPaymentProviderMock(bindings)
      ? "mock"
      : getPaymentProvider(bindings),
    duitkuEnv: getDuitkuEnv(bindings),
    hasDuitkuMerchantCode: hasDuitkuMerchantCode(bindings),
    hasDuitkuMerchantKey: hasDuitkuMerchantKey(bindings),
    hasDuitkuCallbackUrl: hasDuitkuCallbackUrl(bindings),
    duitkuCallbackUrlIsPublic: isDuitkuCallbackUrlPublic(bindings),
    duitkuSmokeCallbackFixture: isDuitkuSmokeCallbackFixtureEnabled(bindings),
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