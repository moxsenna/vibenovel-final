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
  primary: "anthropic/claude-opus-4.8",
  fallback: "openai/gpt-5.2",
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
  assert.equal(MODEL_ALLOWLIST.has(model), true, `${model} must be allowlisted`);
  assert.notEqual(
    getModelCostConfig(model),
    null,
    `${model} must have provider pricing telemetry`,
  );
}

assert.deepEqual(getModelCostConfig("anthropic/claude-opus-4.8"), {
  inputUsdPer1M: 5,
  outputUsdPer1M: 25,
});
assert.deepEqual(getModelCostConfig("openai/gpt-5.2"), {
  inputUsdPer1M: 1.75,
  outputUsdPer1M: 14,
});

for (const retired of [
  "google/gemma-2-9b-it",
  "google/gemini-flash-latest",
  "anthropic/claude-3.5-sonnet",
]) {
  assert.equal(
    MODEL_ALLOWLIST.has(retired),
    false,
    `${retired} must be removed after catalog verification failed`,
  );
}

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
      AI_MODEL_TERBAIK: "anthropic/claude-opus-4.8",
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
