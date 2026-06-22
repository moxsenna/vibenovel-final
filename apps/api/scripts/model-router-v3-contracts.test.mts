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
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
  latencyMs: number | null | undefined;
  estimatedCostUsd: number | null | undefined;
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
        primary: { provider: "openrouter", model: "minimax_text" },
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
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        latencyMs: input.latencyMs,
        estimatedCostUsd: input.estimatedCostUsd,
      });
    },
    async sleep() {},
  },
);

assert.equal(result.fallbackUsed, true);
assert.equal(result.output.chapters.length, 0);
assert.equal(
  calls.filter((call) => call.modelId === "minimax/minimax-m3").length,
  2,
);
assert.equal(
  calls.filter((call) => call.modelId === "qwen/qwen3.7-plus").length,
  1,
);
assert.equal(calls.length, 3);
assert.equal(calls[0].provider, "openrouter");
assert.equal(calls[0].modelId, "minimax/minimax-m3");
assert.equal(calls[2].provider, "openrouter");
assert.equal(calls[2].modelId, "qwen/qwen3.7-plus");
assert.equal(result.inputTokens, 31);
assert.equal(result.outputTokens, 16);
assert.equal(result.latencyMs, 65);
assert.equal(result.estimatedCostUsd, 0.000029);
assert.deepEqual(
  events.map((event) => event.outcome),
  ["invalid_output", "invalid_output", "succeeded"],
);
assert.deepEqual(
  events.map((event) => event.sequenceNumber),
  [1, 2, 3],
);
assert.deepEqual(
  events.map((event) => event.estimatedCostUsd),
  [0.000009, 0.000009, 0.000011],
);

let telemetryWrites = 0;
const telemetryResilientResult = await generateWithModelRouter(
  baseBindings,
  {
    generationAttemptId: "55555555-5555-5555-5555-555555555555",
    providerEventSequence: createProviderEventSequence(),
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash: "hash",
    promptMessages: [{ role: "user", content: "outline" }],
    validateOutput: (text) => JSON.parse(text) as { chapters: unknown[] },
  },
  {
    resolveRoute() {
      return {
        routeKey: GENERATION_TYPES.outline_generation,
        requires: ["textGeneration", "structuredJson"],
        primary: { provider: "openrouter", model: "qwen_plus" },
        fallback: null,
        maxOutputTokens: 4000,
        timeoutMs: 60_000,
        primaryMaxRetries: 1,
        temperature: 0.4,
      };
    },
    async callProvider() {
      return {
        text: '{"chapters":[]}',
        inputTokens: 4,
        outputTokens: 2,
        latencyMs: 8,
      };
    },
    async recordEvent() {
      telemetryWrites += 1;
      throw new Error("telemetry unavailable");
    },
    async sleep() {},
  },
);
assert.equal(telemetryResilientResult.output.chapters.length, 0);
assert.equal(telemetryWrites, 1);

const unverifiedCalls: Array<{ provider: string; modelId: string }> = [];
const unverifiedEvents: Array<{
  outcome: string;
  errorCodeSafe?: string | null;
}> = [];
const unverifiedResult = await generateWithModelRouter(
  baseBindings,
  {
    generationAttemptId: "66666666-6666-6666-6666-666666666666",
    providerEventSequence: createProviderEventSequence(),
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash: "hash",
    promptMessages: [{ role: "user", content: "outline" }],
    validateOutput: (text) => JSON.parse(text) as { chapters: unknown[] },
  },
  {
    now: new Date("2026-06-21T00:00:00Z"),
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
      unverifiedCalls.push({
        provider: input.provider,
        modelId: input.modelId,
      });
      return {
        text: '{"chapters":[]}',
        inputTokens: 5,
        outputTokens: 3,
        latencyMs: 10,
      };
    },
    async recordEvent(input) {
      unverifiedEvents.push({
        outcome: input.outcome,
        errorCodeSafe: input.errorCodeSafe,
      });
    },
    async sleep() {},
  },
);
assert.equal(unverifiedResult.fallbackUsed, true);
assert.deepEqual(unverifiedCalls, [
  { provider: "openrouter", modelId: "qwen/qwen3.7-plus" },
]);
assert.deepEqual(unverifiedEvents, [
  {
    outcome: "configuration_error",
    errorCodeSafe: "AI_DEPLOYMENT_UNVERIFIED",
  },
  { outcome: "succeeded", errorCodeSafe: undefined },
]);

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
          primary: { provider: "openrouter", model: "minimax_text" },
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
          primary: { provider: "openrouter", model: "minimax_text" },
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

// Expired TokenRouter promotion must auto-revert to the OpenRouter fallback.
const expiredCalls: Array<{ provider: string; modelId: string }> = [];
const expiredEvents: string[] = [];
const expiredResult = await generateWithModelRouter(
  baseBindings,
  {
    generationAttemptId: "44444444-4444-4444-4444-444444444444",
    providerEventSequence: createProviderEventSequence(),
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash: "hash",
    promptMessages: [{ role: "user", content: "outline" }],
    validateOutput: (text) => JSON.parse(text) as { chapters: unknown[] },
  },
  {
    now: new Date("2026-07-01T00:00:00Z"),
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
      expiredCalls.push({ provider: input.provider, modelId: input.modelId });
      return { text: '{"chapters":[]}', inputTokens: 5, outputTokens: 3, latencyMs: 10 };
    },
    async recordEvent(input) {
      expiredEvents.push(input.outcome);
    },
    async sleep() {},
  },
);
assert.equal(expiredResult.fallbackUsed, true);
assert.equal(expiredCalls.length, 1, "expired primary must not be called");
assert.equal(expiredCalls[0].provider, "openrouter");
assert.deepEqual(expiredEvents, ["configuration_error", "succeeded"]);

console.log("PASS model router v3 contracts");
