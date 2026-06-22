import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENERATION_TYPES, WRITER_QUALITY_MODES } from "@vibenovel/shared";
import {
  AI_GENERATION_ROUTING_POLICY,
  AI_ROUTING_POLICY_VERSION,
  assertAiRoutingPolicyValid,
  getEmbeddingRoute,
  resolveGenerationRoute,
  validateAiRoutingPolicy,
} from "../src/services/ai-routing-policy.ts";

assert.equal(AI_ROUTING_POLICY_VERSION, "v3");
assert.deepEqual(validateAiRoutingPolicy(), []);
assert.doesNotThrow(() => assertAiRoutingPolicyValid());
assert.match(
  readFileSync("src/app.ts", "utf8"),
  /assertAiRoutingPolicyValid\(\)/,
  "application startup must fail fast on an invalid routing policy",
);

assert.deepEqual(
  resolveGenerationRoute(
    GENERATION_TYPES.intake_assistant,
    WRITER_QUALITY_MODES.terbaik,
  ).primary,
  { provider: "openrouter", model: "gemini_flash_lite" },
);

assert.deepEqual(
  resolveGenerationRoute(
    GENERATION_TYPES.prose_beat,
    WRITER_QUALITY_MODES.seimbang,
  ).primary,
  { provider: "openrouter", model: "gemini_flash" },
);

assert.equal(
  resolveGenerationRoute(
    GENERATION_TYPES.outline_generation,
    WRITER_QUALITY_MODES.hemat,
  ).maxOutputTokens,
  4000,
);

assert.deepEqual(getEmbeddingRoute("import_rag").primary, {
  provider: "openrouter",
  model: "openai_embedding_small",
});

assert.equal(
  AI_GENERATION_ROUTING_POLICY[GENERATION_TYPES.summary_delta],
  AI_GENERATION_ROUTING_POLICY[GENERATION_TYPES.continuity_delta],
  "legacy summary_delta must reference the canonical continuity route",
);

for (const generationType of Object.values(GENERATION_TYPES)) {
  for (const qualityMode of Object.values(WRITER_QUALITY_MODES)) {
    const route = resolveGenerationRoute(generationType, qualityMode);
    assert.equal(route.primary.provider, "openrouter");
    assert.notEqual(route.fallback?.provider, "tokenrouter");
  }
}

console.log("PASS AI routing policy contracts");
