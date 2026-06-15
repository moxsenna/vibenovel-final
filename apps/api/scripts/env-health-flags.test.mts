import assert from "node:assert/strict";
import { getEnvPresenceFlags, type AppBindings } from "../src/env.ts";

const bindings: AppBindings = {
  SUPABASE_URL: "https://prodprojectref12345.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  APP_ENV: "production",
  AI_GENERATION_ENABLED: "true",
  AI_PROVIDER_MOCK: "false",
  OPENROUTER_API_KEY: "openrouter-key",
  CREDIT_TOPUP_ENABLED: "true",
  PAYMENT_PROVIDER_MOCK: "false",
  MAYAR_API_KEY: "mayar-key",
  MAYAR_ENV: "production",
  PAYMENT_PROVIDER: "duitku",
  DUITKU_MERCHANT_CODE: "D123",
  DUITKU_MERCHANT_KEY: "duitku-key",
  DUITKU_ENV: "production",
  DUITKU_CALLBACK_URL: "https://api.narraza.web.id/api/payments/duitku/callback",
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
  "appEnv",
  "paymentProvider",
  "hasMayarApiKey",
  "mayarEnv",
  "hasDuitkuMerchantCode",
  "hasDuitkuMerchantKey",
  "duitkuEnv",
  "hasDuitkuCallbackUrl",
  "duitkuCallbackUrlIsPublic",
  "duitkuSmokeCallbackFixture",
].sort();

assert.deepEqual(Object.keys(flags).sort(), expectedKeys);

for (const [key, value] of Object.entries(flags)) {
  if (key === "appEnv" || key === "paymentProvider" || key === "mayarEnv" || key === "duitkuEnv") {
    assert.equal(typeof value, "string", `${key} must be a string`);
  } else {
    assert.equal(typeof value, "boolean", `${key} must be a boolean`);
  }
}

assert.equal(flags.hasSupabaseUrl, true);
assert.equal(flags.hasSupabaseAnonKey, true);
assert.equal(flags.hasSupabaseServiceRoleKey, true);
assert.equal(flags.aiGenerationEnabled, true);
assert.equal(flags.aiProviderMock, false);
assert.equal(flags.hasOpenRouterApiKey, true);
assert.equal(flags.creditTopupEnabled, true);
assert.equal(flags.paymentProviderMock, false);
assert.equal(flags.appEnv, "production");
assert.equal(flags.paymentProvider, "duitku");
assert.equal(flags.hasMayarApiKey, true);
assert.equal(flags.mayarEnv, "production");
assert.equal(flags.hasDuitkuMerchantCode, true);
assert.equal(flags.hasDuitkuMerchantKey, true);
assert.equal(flags.duitkuEnv, "production");
assert.equal(flags.hasDuitkuCallbackUrl, true);
assert.equal(flags.duitkuCallbackUrlIsPublic, true);
assert.equal(flags.duitkuSmokeCallbackFixture, false);

console.log("PASS env health flags expose safe deployment fields");
