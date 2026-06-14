import assert from "node:assert/strict";
import { getEnvPresenceFlags, type AppBindings } from "../src/env.ts";

const bindings: AppBindings = {
  SUPABASE_URL: "https://prodprojectref12345.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  AI_GENERATION_ENABLED: "true",
  AI_PROVIDER_MOCK: "false",
  OPENROUTER_API_KEY: "openrouter-key",
  CREDIT_TOPUP_ENABLED: "false",
  PAYMENT_PROVIDER_MOCK: "true",
  MAYAR_API_KEY: "mayar-key",
  MAYAR_ENV: "production",
  PAYMENT_PROVIDER: "duitku",
  DUITKU_MERCHANT_CODE: "D123",
  DUITKU_MERCHANT_KEY: "duitku-key",
  DUITKU_ENV: "production",
  DUITKU_CALLBACK_URL: "https://api.narraza.web.id/api/payment-webhooks/duitku",
};

const flags = getEnvPresenceFlags(bindings);
const expectedKeys = [
  "hasSupabaseUrl",
  "hasSupabaseAnonKey",
  "hasSupabaseServiceRoleKey",
  "aiGenerationEnabled",
  "aiProviderMock",
  "hasOpenRouterApiKey",
  "creditTopupEnabled",
  "paymentProviderMock",
].sort();

assert.deepEqual(Object.keys(flags).sort(), expectedKeys);

for (const [key, value] of Object.entries(flags)) {
  assert.equal(typeof value, "boolean", `${key} must be a boolean`);
}

assert.equal(flags.hasSupabaseUrl, true);
assert.equal(flags.hasSupabaseAnonKey, true);
assert.equal(flags.hasSupabaseServiceRoleKey, true);
assert.equal(flags.aiGenerationEnabled, true);
assert.equal(flags.aiProviderMock, false);
assert.equal(flags.hasOpenRouterApiKey, true);
assert.equal(flags.creditTopupEnabled, false);
assert.equal(flags.paymentProviderMock, true);

console.log("PASS env health flags are safe booleans only");
