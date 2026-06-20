import assert from "node:assert/strict";
import { GENERATION_TYPES, WRITER_QUALITY_MODES } from "@vibenovel/shared";
import { AppError } from "../src/errors.ts";
import {
  assertGenerationRouteCallable,
  generateWithModelRouter,
} from "../src/services/model-router.ts";
import { createProviderEventSequence } from "../src/services/generation-provider-event.ts";

const baseBindings = {
  AI_GENERATION_ENABLED: "true",
  AI_PROVIDER_MOCK: "false",
  OPENROUTER_API_KEY: "openrouter",
  TOKENROUTER_API_KEY: "tokenrouter",
};

const calls: Array<{ provider: string; modelId: string }> = [];
const events: Array<{
  outcome: string;
  routeRole: string;
  sequenceNumber: number;
}> = [];
const providerEventSequence = createProviderEventSequence();

const result = await generateWithModelRouter(
  baseBindings,
  {
    generationAttemptId: "11111111-1111-1111-1111-111111111111",
    providerEventSequence,
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash: "hash",
    promptMessages: [{ role: "user", content: "outline" }],
    validateOutput(text) {
      const parsed = JSON.parse(text) as { chapters: unknown[] };
      if (!Array.isArray(parsed.chapters)) {
        throw new AppError("GENERATION_FAILED", "Invalid outline", 502);
      }
      return parsed;
    },
  },
  {
    resolveRoute() {
      return {
        routeKey: GENERATION_TYPES.outline_generation,
        requires: ["textGeneration", "structuredJson"],
        primary: { provider: "tokenrouter", model: "minimax_text" },
        fallback: { provider: "openrouter", model: "qwen_plus" },
        maxOutputTokens: 4000,
        timeoutMs: 60_000,
        primaryMaxRetries: 1,
        temperature: 0.4,
      };
    },
    async callProvider(input) {
      calls.push({ provider: input.provider, modelId: input.modelId });
      if (calls.length <= 2) {
        return {
          text: "not-json",
          inputTokens: 10,
          outputTokens: 5,
          latencyMs: 20,
        };
      }
      return {
        text: '{"chapters":[]}',
        inputTokens: 11,
        outputTokens: 6,
        latencyMs: 25,
      };
    },
    async recordEvent(input) {
      events.push({
        outcome: input.outcome,
        routeRole: input.routeRole,
        sequenceNumber: input.sequenceNumber,
      });
    },
    async sleep() {},
  },
);

assert.equal(result.fallbackUsed, true);
assert.equal(result.output.chapters.length, 0);
assert.equal(calls.filter((call) => call.provider === "tokenrouter").length, 2);
assert.equal(calls.filter((call) => call.provider === "openrouter").length, 1);
assert.equal(calls.length, 3);
assert.equal(calls[0].provider, "tokenrouter");
assert.equal(calls[0].modelId, "MiniMax-M3");
assert.equal(calls[2].provider, "openrouter");
assert.equal(calls[2].modelId, "qwen/qwen3.7-plus");
assert.deepEqual(
  events.map((event) => event.outcome),
  ["invalid_output", "invalid_output", "succeeded"],
);
assert.deepEqual(
  events.map((event) => event.sequenceNumber),
  [1, 2, 3],
);

let unsafeFallbackCalls = 0;
await assert.rejects(
  generateWithModelRouter(
    baseBindings,
    {
      generationAttemptId: "22222222-2222-2222-2222-222222222222",
      providerEventSequence: createProviderEventSequence(),
      generationType: GENERATION_TYPES.foundation_proposal,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      promptHash: "hash",
      promptMessages: [{ role: "user", content: "foundation" }],
      validateOutput() {
        throw new AppError("AI_OUTPUT_UNSAFE", "Unsafe output", 422);
      },
    },
    {
      resolveRoute() {
        return {
          routeKey: GENERATION_TYPES.foundation_proposal,
          requires: ["textGeneration", "structuredJson"],
          primary: { provider: "tokenrouter", model: "minimax_text" },
          fallback: { provider: "openrouter", model: "qwen_plus" },
          maxOutputTokens: 3000,
          timeoutMs: 60_000,
          primaryMaxRetries: 1,
          temperature: 0.4,
        };
      },
      async callProvider() {
        unsafeFallbackCalls += 1;
        return { text: "unsafe", latencyMs: 1 };
      },
      async recordEvent() {},
      async sleep() {},
    },
  ),
  (error: unknown) =>
    error instanceof AppError && error.code === "AI_OUTPUT_UNSAFE",
);
assert.equal(unsafeFallbackCalls, 1);

let fallbackFailureCalls = 0;
await assert.rejects(
  generateWithModelRouter(
    baseBindings,
    {
      generationAttemptId: "33333333-3333-3333-3333-333333333333",
      providerEventSequence: createProviderEventSequence(),
      generationType: GENERATION_TYPES.outline_generation,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      promptHash: "hash",
      promptMessages: [{ role: "user", content: "outline" }],
      validateOutput(text) {
        return JSON.parse(text);
      },
    },
    {
      resolveRoute() {
        return {
          routeKey: GENERATION_TYPES.outline_generation,
          requires: ["textGeneration", "structuredJson"],
          primary: { provider: "tokenrouter", model: "minimax_text" },
          fallback: { provider: "openrouter", model: "qwen_plus" },
          maxOutputTokens: 4000,
          timeoutMs: 60_000,
          primaryMaxRetries: 1,
          temperature: 0.4,
        };
      },
      async callProvider() {
        fallbackFailureCalls += 1;
        throw new AppError("AI_PROVIDER_ERROR", "Provider failed", 502);
      },
      async recordEvent() {},
      async sleep() {},
    },
  ),
);
assert.equal(
  fallbackFailureCalls,
  3,
  "primary must run twice and fallback exactly once",
);

assert.doesNotThrow(() =>
  assertGenerationRouteCallable(baseBindings, {
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
  }),
);

console.log("PASS model router v3 contracts");
