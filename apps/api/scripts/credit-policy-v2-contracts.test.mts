import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GENERATION_TYPES } from "@vibenovel/shared";
import {
  CREDIT_PRICING_VERSION,
  getFeatureKeyForGenerationType,
} from "../src/services/ai-credit-policy.ts";

assert.equal(CREDIT_PRICING_VERSION, "v2");
assert.equal(
  getFeatureKeyForGenerationType(GENERATION_TYPES.intake_assistant),
  "intake_chat_reply",
);
assert.equal(
  getFeatureKeyForGenerationType(GENERATION_TYPES.concept_generation),
  "concept_generate_3",
);
assert.equal(
  getFeatureKeyForGenerationType(GENERATION_TYPES.publish_copy),
  "publish_package",
);

const intakeSource = readFileSync(
  new URL("../src/services/intake.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  intakeSource,
  /creditCost:\s*(?:1|100)\b/,
  "intake attempt cost must come from the centralized policy",
);
assert.doesNotMatch(
  intakeSource,
  /amount:\s*(?:1|100)\b/,
  "intake debit/refund amount must come from the centralized policy",
);
assert.match(
  intakeSource,
  /getCreditCostForGeneration/,
  "intake must consume the centralized credit policy",
);

console.log("PASS centralized credit policy contracts");
