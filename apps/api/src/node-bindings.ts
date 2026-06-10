import type { AppBindings } from "./env.js";

const BINDING_ENV_KEYS: (keyof AppBindings)[] = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_ENV",
  "ALLOWED_ORIGINS",
  "AI_GENERATION_ENABLED",
  "AI_PROVIDER_MOCK",
  "AI_PROVIDER_MOCK_MODE",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "DEFAULT_AI_MODEL",
  "AI_MODEL_HEMAT",
  "AI_MODEL_SEIMBANG",
  "AI_MODEL_TERBAIK",
  "AI_TIMEOUT_MS",
  "AI_MAX_RETRIES",
  "AI_CREDIT_COST_PROSE_BEAT",
  "AI_CREDIT_COST_PROSE_REWRITE",
  "AI_CREDIT_COST_PUBLISH_COPY",
  "CREDIT_TOPUP_ENABLED",
  "PAYMENT_PROVIDER_MOCK",
  "PAYMENT_PROVIDER_MOCK_MODE",
  "MAYAR_API_KEY",
  "MAYAR_BASE_URL",
  "MAYAR_ENV",
  "MAYAR_REDIRECT_BASE_URL",
  "PAYMENT_TIMEOUT_MS",
  "PAYMENT_PROVIDER",
  "PAYMENT_RETURN_BASE_URL",
  "DUITKU_MERCHANT_CODE",
  "DUITKU_MERCHANT_KEY",
  "DUITKU_ENV",
  "DUITKU_BASE_URL",
  "DUITKU_CALLBACK_URL",
  "DUITKU_RETURN_URL",
  "DUITKU_TIMEOUT_MS",
  "DUITKU_SMOKE_CALLBACK_FIXTURE",
];

/** Map Node `process.env` to Worker-compatible `AppBindings` shape. */
export function loadBindingsFromProcessEnv(
  source: NodeJS.ProcessEnv = process.env,
): AppBindings {
  const bindings: AppBindings = {};

  for (const key of BINDING_ENV_KEYS) {
    const value = source[key];
    if (value !== undefined && value !== "") {
      bindings[key] = value;
    }
  }

  return bindings;
}

const DEFAULT_NODE_PORT = 8787;

export function getNodePort(source: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(source.PORT?.trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return DEFAULT_NODE_PORT;
}