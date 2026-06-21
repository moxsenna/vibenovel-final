import assert from "node:assert/strict";
import { GENERATION_TYPES, WRITER_QUALITY_MODES } from "@vibenovel/shared";
import { getCreditCostForGeneration } from "../src/services/ai-credit-policy.ts";
import {
  resolveGenerationRoute,
  AI_ROUTING_POLICY_VERSION,
} from "../src/services/ai-routing-policy.ts";
import { getDeploymentCost } from "../src/services/ai-model-registry.ts";

// User credit prices must stay independent of the AI routing refactor.
const CREDIT_PRICE_SNAPSHOT: Array<{
  generationType: (typeof GENERATION_TYPES)[keyof typeof GENERATION_TYPES];
  qualityMode: (typeof WRITER_QUALITY_MODES)[keyof typeof WRITER_QUALITY_MODES];
  expected: number;
}> = [
  {
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 800,
  },
  {
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: WRITER_QUALITY_MODES.seimbang,
    expected: 1500,
  },
  {
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
    expected: 7500,
  },
  {
    generationType: GENERATION_TYPES.publish_copy,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
    expected: 400,
  },
];

for (const entry of CREDIT_PRICE_SNAPSHOT) {
  assert.equal(
    getCreditCostForGeneration({
      generationType: entry.generationType,
      qualityMode: entry.qualityMode,
    }),
    entry.expected,
    `${entry.generationType}/${entry.qualityMode} credit price must be unchanged`,
  );
}

// Provider cost is derived from the registry deployment, never user credit.
const proseTerbaik = resolveGenerationRoute(
  GENERATION_TYPES.prose_beat,
  WRITER_QUALITY_MODES.terbaik,
);
const providerCost = getDeploymentCost(
  proseTerbaik.primary.model,
  proseTerbaik.primary.provider,
);
assert.ok(providerCost.inputUsdPer1M >= 0);
assert.ok(providerCost.outputUsdPer1M >= 0);

assert.equal(AI_ROUTING_POLICY_VERSION, "v3");

console.log("PASS AI routing v3 credit invariance");
