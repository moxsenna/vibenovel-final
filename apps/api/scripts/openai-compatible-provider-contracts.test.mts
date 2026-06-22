import assert from "node:assert/strict";
import type { AppBindings } from "../src/env.ts";
import { AppError } from "../src/errors.ts";
import {
  buildOpenAiCompatibleChatRequest,
  callOpenAiCompatibleChat,
  isQuotaExhaustedSignal,
} from "../src/services/openai-compatible-client.ts";
import {
  getProviderRuntime,
  hasProviderCredential,
} from "../src/services/ai-provider-adapters.ts";

const bindings: AppBindings = {
  OPENROUTER_API_KEY: "openrouter-secret",
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  TOKENROUTER_API_KEY: "tokenrouter-secret",
  TOKENROUTER_BASE_URL: "https://api.tokenrouter.com/v1",
};

assert.equal(hasProviderCredential(bindings, "openrouter"), true);
assert.equal(hasProviderCredential(bindings, "tokenrouter"), true);
assert.equal(
  getProviderRuntime(bindings, "tokenrouter").baseUrl,
  "https://api.tokenrouter.com/v1",
);

assert.deepEqual(
  buildOpenAiCompatibleChatRequest({
    modelId: "MiniMax-M3",
    messages: [{ role: "user", content: "Return JSON." }],
    maxOutputTokens: 100,
    temperature: 0.2,
  }),
  {
    model: "MiniMax-M3",
    messages: [{ role: "user", content: "Return JSON." }],
    max_tokens: 100,
    temperature: 0.2,
    stream: false,
  },
);

let requestedUrl = "";
const result = await callOpenAiCompatibleChat(
  {
    provider: "tokenrouter",
    baseUrl: "https://api.tokenrouter.com/v1",
    apiKey: "tokenrouter-secret",
    modelId: "MiniMax-M3",
    messages: [{ role: "user", content: "Return JSON." }],
    maxOutputTokens: 100,
    temperature: 0.2,
    timeoutMs: 5000,
  },
  async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  },
);

assert.equal(requestedUrl, "https://api.tokenrouter.com/v1/chat/completions");
assert.equal(result.text, '{"ok":true}');
assert.equal(result.inputTokens, 12);
assert.equal(result.outputTokens, 6);

// Quota-exhaustion detection (covers TokenRouter's Chinese 401 body).
assert.equal(isQuotaExhaustedSignal("token.RemainQuota = 0"), true);
assert.equal(isQuotaExhaustedSignal("该令牌额度已用尽"), true);
assert.equal(isQuotaExhaustedSignal("model not found"), false);

// A quota 401 maps to a specific safe code (never echoes the masked token),
// and the router treats it as fallback-eligible.
await assert.rejects(
  callOpenAiCompatibleChat(
    {
      provider: "tokenrouter",
      baseUrl: "https://api.tokenrouter.com/v1",
      apiKey: "tokenrouter-secret",
      modelId: "MiniMax-M3",
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 50,
      temperature: 0,
      timeoutMs: 5000,
    },
    async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "",
            message: "[sk-xxx***yyy] 该令牌额度已用尽 token.RemainQuota = 0",
            type: "api_error",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
  ),
  (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "AI_PROVIDER_QUOTA_EXHAUSTED");
    // The safe message must not leak the provider body / token.
    assert.doesNotMatch(error.message, /sk-|令牌|RemainQuota/);
    return true;
  },
);

console.log("PASS OpenAI-compatible provider contracts");
