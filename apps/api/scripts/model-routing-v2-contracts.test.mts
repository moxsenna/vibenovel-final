import assert from "node:assert/strict";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
} from "@vibenovel/shared";
import type { AppBindings } from "../src/env.ts";
import {
  FIXED_FEATURE_MODELS,
  MODEL_ROUTING_VERSION,
  PROSE_MODELS,
  getModelCandidatesForGeneration,
} from "../src/services/model-routing-v2.ts";
import {
  MODEL_ALLOWLIST,
  resolveFallbackModelForGeneration,
  resolveModelForGeneration,
} from "../src/services/model-router.ts";
import { getModelCostConfig } from "../src/services/model-cost-map.ts";
import {
  REJECTED_OPENROUTER_MODEL_IDS,
  VERIFIED_OPENROUTER_MODELS,
  getVerifiedOpenRouterModel,
  verifyOpenRouterModels,
} from "../src/services/openrouter-model-verification.ts";

const bindings: AppBindings = {
  AI_GENERATION_ENABLED: "true",
  AI_PROVIDER_MOCK: "false",
};

assert.equal(MODEL_ROUTING_VERSION, "v2");
assert.deepEqual(FIXED_FEATURE_MODELS.intake_chat_reply, {
  primary: "google/gemini-3.1-flash-lite",
  fallback: "qwen/qwen3.7-plus",
});
assert.deepEqual(PROSE_MODELS.terbaik, {
  primary: "anthropic/claude-opus-4.6",
  fallback: "google/gemini-3.1-pro-preview",
});

assert.deepEqual(
  getModelCandidatesForGeneration(
    GENERATION_TYPES.publish_copy,
    WRITER_QUALITY_MODES.terbaik,
  ),
  FIXED_FEATURE_MODELS.publish_package,
  "non-prose routing must ignore requested quality mode",
);
assert.deepEqual(
  getModelCandidatesForGeneration(
    GENERATION_TYPES.prose_beat,
    WRITER_QUALITY_MODES.seimbang,
  ),
  PROSE_MODELS.seimbang,
  "prose routing must follow quality mode",
);

const verifiedModels = new Set(
  [
    ...Object.values(FIXED_FEATURE_MODELS),
    ...Object.values(PROSE_MODELS),
  ].flatMap(({ primary, fallback }) => [primary, fallback]),
);
for (const model of verifiedModels) {
  const verification = getVerifiedOpenRouterModel(model);
  assert.ok(verification, `${model} must have a verified catalog record`);
  assert.equal(verification.catalogMatch, "exact");
  assert.ok(
    Number.isFinite(Date.parse(verification.verifiedAt)),
    `${model} must have a valid verification timestamp`,
  );
  assert.ok(verification.canonicalId.length > 0);
  assert.ok(verification.contextLength > 0);
  assert.ok(verification.inputUsdPer1M >= 0);
  assert.ok(verification.outputUsdPer1M >= 0);
  assert.ok(verification.supportedParameters.includes("max_tokens"));
  assert.ok(verification.supportedParameters.includes("temperature"));
  assert.equal(MODEL_ALLOWLIST.has(model), true, `${model} must be allowlisted`);
  assert.notEqual(
    getModelCostConfig(model),
    null,
    `${model} must have provider pricing telemetry`,
  );
}
assert.deepEqual(
  [...MODEL_ALLOWLIST].sort(),
  Object.keys(VERIFIED_OPENROUTER_MODELS).sort(),
  "the runtime allowlist must contain verified OpenRouter models only",
);

assert.deepEqual(getModelCostConfig("anthropic/claude-opus-4.6"), {
  inputUsdPer1M: 5,
  outputUsdPer1M: 25,
});
assert.deepEqual(getModelCostConfig("google/gemini-3.1-pro-preview"), {
  inputUsdPer1M: 2,
  outputUsdPer1M: 12,
});

for (const retired of [
  "google/gemma-2-9b-it",
  "google/gemini-flash-latest",
  "anthropic/claude-3.5-sonnet",
  ...REJECTED_OPENROUTER_MODEL_IDS,
]) {
  assert.equal(
    MODEL_ALLOWLIST.has(retired),
    false,
    `${retired} must be removed after catalog verification failed`,
  );
}

const incompatible = verifyOpenRouterModels(
  ["example/incompatible"],
  [
    {
      id: "example/incompatible",
      canonical_slug: "example/incompatible-20260619",
      context_length: 200_000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      supported_parameters: ["max_tokens"],
    },
  ],
  "2026-06-19T00:00:00Z",
)[0];
assert.equal(incompatible.status, "INCOMPATIBLE");
assert.deepEqual(incompatible.missingRequiredParameters, ["temperature"]);

const missing = verifyOpenRouterModels(
  ["example/missing"],
  [],
  "2026-06-19T00:00:00Z",
)[0];
assert.equal(missing.status, "MISSING");

assert.equal(
  resolveModelForGeneration(bindings, {
    generationType: GENERATION_TYPES.intake_assistant,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
  }).model,
  FIXED_FEATURE_MODELS.intake_chat_reply.primary,
);
assert.equal(
  resolveFallbackModelForGeneration(bindings, {
    generationType: GENERATION_TYPES.intake_assistant,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
  })?.model,
  FIXED_FEATURE_MODELS.intake_chat_reply.fallback,
);
assert.equal(
  resolveModelForGeneration(
    {
      ...bindings,
      AI_MODEL_TERBAIK: "google/gemma-4-31b-it:free",
    },
    {
      generationType: GENERATION_TYPES.prose_beat,
      qualityMode: WRITER_QUALITY_MODES.terbaik,
    },
  ).model,
  "google/gemma-4-31b-it:free",
  "prose env override remains an emergency control",
);
assert.equal(
  resolveModelForGeneration(
    {
      ...bindings,
      AI_MODEL_TERBAIK: "anthropic/claude-opus-4.6",
    },
    {
      generationType: GENERATION_TYPES.publish_copy,
      qualityMode: WRITER_QUALITY_MODES.terbaik,
    },
  ).model,
  FIXED_FEATURE_MODELS.publish_package.primary,
  "tier env overrides must not change non-prose routing",
);

console.log("PASS model routing v2 Phase 8 contracts");
