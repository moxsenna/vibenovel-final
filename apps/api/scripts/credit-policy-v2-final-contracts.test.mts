import assert from "node:assert/strict";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type WriterQualityMode,
} from "@vibenovel/shared";
import {
  CREDIT_PRICING_VERSION,
  getCreditCost,
  getCreditCostForGeneration,
  resolveQualityModeForGeneration,
} from "../src/services/ai-credit-policy.ts";

const modes = Object.values(WRITER_QUALITY_MODES) as WriterQualityMode[];

assert.equal(CREDIT_PRICING_VERSION, "v2");

for (const [feature, expected] of [
  ["intake_chat_reply", 100],
  ["concept_generate_3", 1_000],
  ["foundation_setup", 2_000],
  ["outline_10_chapters", 2_500],
  ["summary_delta", 500],
  ["continuity_check_standalone", 500],
  ["publish_package", 400],
] as const) {
  for (const qualityMode of modes) {
    assert.equal(
      getCreditCost({ feature, qualityMode }),
      expected,
      `${feature} must ignore quality mode`,
    );
  }
}

for (const [feature, expected] of [
  ["prose_beat", [800, 1_500, 7_500]],
  ["prose_rewrite", [500, 900, 4_500]],
] as const) {
  modes.forEach((qualityMode, index) => {
    assert.equal(
      getCreditCost({ feature, qualityMode }),
      expected[index],
      `${feature}/${qualityMode} must use final v2 pricing`,
    );
  });
}

for (const qualityMode of modes) {
  assert.equal(
    getCreditCostForGeneration({
      generationType: GENERATION_TYPES.publish_copy,
      qualityMode,
    }),
    400,
    "publish pricing must be mode-invariant",
  );
  assert.equal(
    getCreditCostForGeneration({
      generationType: GENERATION_TYPES.foundation_proposal,
      qualityMode,
    }),
    2_000,
    "foundation pricing must be mode-invariant",
  );
  assert.equal(
    getCreditCostForGeneration({
      generationType: GENERATION_TYPES.outline_generation,
      qualityMode,
    }),
    2_500,
    "outline pricing must be mode-invariant",
  );
}

// The current beat-planning endpoint is not priced by the product spec.
// Keep its legacy amount fixed and mode-invariant until a product decision exists.
for (const qualityMode of modes) {
  assert.equal(
    getCreditCostForGeneration({
      generationType: GENERATION_TYPES.beat_generation,
      qualityMode,
    }),
    3,
  );
}

assert.equal(
  resolveQualityModeForGeneration(
    GENERATION_TYPES.publish_copy,
    WRITER_QUALITY_MODES.terbaik,
  ),
  WRITER_QUALITY_MODES.hemat,
  "non-prose must accept but ignore a legacy client quality mode",
);
assert.equal(
  resolveQualityModeForGeneration(
    GENERATION_TYPES.prose_beat,
    WRITER_QUALITY_MODES.terbaik,
  ),
  WRITER_QUALITY_MODES.terbaik,
  "prose must retain the requested quality mode",
);

console.log("PASS final credit policy v2 Phase 5-7 contracts");
