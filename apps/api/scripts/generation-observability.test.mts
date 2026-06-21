import assert from "node:assert/strict";
import {
  buildSafeGenerationObservabilityMetadata,
} from "../src/services/generation-attempt.js";
import {
  summarizeGenerationObservability,
} from "../src/services/admin-ops.js";

const metadata = buildSafeGenerationObservabilityMetadata({
  contextPacketVersion: "context_packet_v3",
  safetyEnvelopeVersion: "writer_safety_v1",
  contextBudgetProfile: "conservative",
  packetBytes: 12345,
  serializedContextChars: 8300,
  serializedPromptChars: 9100,
  sectionChars: {
    currentChapterAndBeat: 1200,
    canonFacts: 1800,
    precedingProseTail: 880,
  },
  truncatedSectionNames: ["GENERAL FOUNDATION"],
  precedingProseTailIncluded: true,
  precedingProseTailChars: 880,
  canonFactCount: 14,
  characterCount: 5,
  timelineCount: 3,
  retrievalSnippetCount: 2,
  validationCheckCount: 11,
  semanticJudgeMode: "shadow",
  semanticJudgeCalled: true,
  semanticJudgeInputTokens: 120,
  semanticJudgeOutputTokens: 40,
  semanticJudgeEstimatedCostUsd: 0.00012,
  repairAttempts: 1,
  runtime: "node",
  latencyBreakdownMs: {
    contextBuild: 40,
    provider: 900,
    validation: 120,
    persistence: 30,
  },
  prompt: "must never survive",
  prose: "must never survive",
  planningTruth: "must never survive",
});

assert.equal(metadata.runtime, "node");
assert.equal(metadata.serializedPromptChars, 9100);
assert.deepEqual(metadata.truncatedSectionNames, ["GENERAL FOUNDATION"]);
const serialized = JSON.stringify(metadata);
assert.doesNotMatch(serialized, /must never survive|planningTruth/i);
assert.equal(Object.hasOwn(metadata, "prompt"), false);
assert.equal(Object.hasOwn(metadata, "prose"), false);

const aggregate = summarizeGenerationObservability([
  { metadata: { ...metadata, serializedPromptChars: 1000 }, error_code: null },
  { metadata: { ...metadata, serializedPromptChars: 2000 }, error_code: "CONTEXT_LENGTH_EXCEEDED" },
  { metadata: { ...metadata, serializedPromptChars: 3000 }, error_code: null },
  { metadata: { ...metadata, serializedPromptChars: 4000 }, error_code: null },
]);
assert.equal(aggregate.byProfile.conservative.count, 4);
assert.equal(aggregate.byProfile.conservative.p50SerializedPromptChars, 2000);
assert.equal(aggregate.byProfile.conservative.p95SerializedPromptChars, 4000);
assert.equal(aggregate.providerContextLengthErrors, 1);

console.log("PASS safe generation observability metadata and aggregate");
