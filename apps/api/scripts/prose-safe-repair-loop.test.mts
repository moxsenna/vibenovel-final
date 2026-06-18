import assert from "node:assert/strict";
import {
  estimateProviderTokenFootprint,
  isBlockedValidationReport,
  PROSE_SAFE_REPAIR_MAX_RETRIES,
  PROSE_SAFE_REPAIR_TOKEN_BUDGET_MULTIPLIER,
} from "../src/services/prose-output-safe-repair.ts";
import { validateAiOutput } from "../src/services/output-validator.ts";
import { buildProseRepairInstruction } from "../src/services/safe-repair.ts";

const blocked = validateAiOutput({
  outputText: "This output contains planningTruth leak marker for smoke testing.",
  forbiddenConcepts: ["hubungan siska"],
});
assert.equal(blocked.allowed, false);
assert.equal(isBlockedValidationReport(blocked), true);

const warningOnly = validateAiOutput({
  outputText: "Adegan singkat di dapur dengan gerbang tua terlihat dari jendela.",
  forbiddenConcepts: [],
  mustInclude: ["fakta yang tidak ada di teks"],
});
assert.equal(warningOnly.allowed, true);
assert.equal(isBlockedValidationReport(warningOnly), false);

const retentionWarn = validateAiOutput({
  outputText: "x".repeat(200),
  retentionHookKeywords: ["penasaran"],
});
assert.equal(retentionWarn.allowed, true);
assert.ok(
  retentionWarn.checks.some((c) => c.key === "retention_unlock_hook" && !c.passed),
);

const instruction = buildProseRepairInstruction(["adik kandung"], ["gerbang tua"]);
assert.match(instruction, /fakta besar/i);
assert.match(instruction, /gerbang tua/i);

const footprint = estimateProviderTokenFootprint({
  text: "x".repeat(400),
  provider: "mock",
  model: "mock",
  latencyMs: 1,
  promptHash: "abc",
  inputTokens: 10,
  outputTokens: 20,
});
assert.equal(footprint, 30);

assert.equal(PROSE_SAFE_REPAIR_MAX_RETRIES, 2);
assert.equal(PROSE_SAFE_REPAIR_TOKEN_BUDGET_MULTIPLIER, 3);

console.log("PASS prose safe-repair loop contracts");