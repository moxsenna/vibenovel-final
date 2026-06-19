import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type GenerationType,
  type WriterQualityMode,
} from "@vibenovel/shared";
import { getCreditCostForGeneration } from "../src/services/ai-credit-policy.ts";
import { generateWithMockProvider } from "../src/services/mock-ai-provider.ts";
import { parseAndValidateBeatAiOutput } from "../src/services/beat-generation-ai.ts";
import { parseAndValidateChapterSummaryAiOutput } from "../src/services/chapter-summary-schema.ts";
import { parseLenientJsonObject } from "../src/services/outline-generator.ts";

const serviceSources = [
  "foundation-proposal.ts",
  "outline.ts",
  "asisten-narra-foundation-patch.ts",
  "chapter-beat.ts",
  "chapter-summary.ts",
].map((file) => ({
  file,
  source: readFileSync(new URL(`../src/services/${file}`, import.meta.url), "utf8"),
}));

for (const { file, source } of serviceSources) {
  assert.doesNotMatch(
    source,
    /isAiGenerationEnabled\s*\(\s*bindings\s*\)\s*&&\s*!isAiProviderMock\s*\(\s*bindings\s*\)/,
    `${file} must not bypass paid orchestration when the configured provider is mock`,
  );
}

const foundationSource = serviceSources.find(
  ({ file }) => file === "foundation-proposal.ts",
)!.source;
const outlineSource = serviceSources.find(({ file }) => file === "outline.ts")!
  .source;
const chapterSummaryAiSource = readFileSync(
  new URL("../src/services/chapter-summary-ai.ts", import.meta.url),
  "utf8",
);
const summaryPromptBuilderSource =
  chapterSummaryAiSource.match(
    /function buildSummarySystemPrompt[\s\S]+?function inferFactRisk/,
  )?.[0] ?? "";
assert.doesNotMatch(
  summaryPromptBuilderSource,
  /planningTruth|planning_truth|packet_json|packetJson|context_packet|contextPacket|openrouter/i,
  "chapter summary prompt builders must not contain terms rejected by prompt safety",
);

for (const [label, source] of [
  ["foundation", foundationSource],
  ["outline", outlineSource],
] as const) {
  assert.match(
    source,
    /parsePaidActionIdempotencyKey/,
    `${label} generation must require a validated idempotency key for paid AI`,
  );
  assert.match(
    source,
    /getGenerationAttemptByIdempotencyKey/,
    `${label} generation must look up prior attempts before charging`,
  );
  assert.match(
    source,
    /idempotentReplay:\s*true/,
    `${label} generation must expose successful replay responses`,
  );
}
assert.match(
  foundationSource,
  /metadata:\s*\{[\s\S]{0,200}\bbatchId\b/,
  "foundation attempts must snapshot batchId for replay",
);

const costMatrix: Array<{
  generationType: GenerationType;
  qualityMode: WriterQualityMode;
  expected: number;
}> = [
  {
    generationType: GENERATION_TYPES.intake_assistant,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 100,
  },
  {
    generationType: GENERATION_TYPES.concept_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 1_000,
  },
  {
    generationType: GENERATION_TYPES.foundation_proposal,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 2_000,
  },
  {
    generationType: GENERATION_TYPES.outline_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 2_500,
  },
  {
    generationType: GENERATION_TYPES.beat_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 3,
  },
  {
    generationType: GENERATION_TYPES.chapter_summary_generation,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 500,
  },
  {
    generationType: GENERATION_TYPES.continuity_delta,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 500,
  },
  {
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 800,
  },
  {
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: WRITER_QUALITY_MODES.seimbang,
    expected: 1_500,
  },
  {
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
    expected: 7_500,
  },
  {
    generationType: GENERATION_TYPES.prose_rewrite,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 500,
  },
  {
    generationType: GENERATION_TYPES.prose_rewrite,
    qualityMode: WRITER_QUALITY_MODES.seimbang,
    expected: 900,
  },
  {
    generationType: GENERATION_TYPES.prose_rewrite,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
    expected: 4_500,
  },
  {
    generationType: GENERATION_TYPES.publish_copy,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    expected: 400,
  },
];

for (const row of costMatrix) {
  assert.equal(
    getCreditCostForGeneration(row),
    row.expected,
    `${row.generationType}/${row.qualityMode} must keep the v2 server-authoritative price`,
  );
}

const mockConfig = {
  provider: "mock" as const,
  model: "mock/credit-v2-matrix",
  maxOutputTokens: 4_000,
  timeoutMs: 1_000,
  temperature: 0.4,
};

async function mockText(generationType: GenerationType): Promise<string> {
  const result = await generateWithMockProvider(
    {
      generationType,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      promptHash: `credit-v2-${generationType}-abcdef123456`,
      metadata:
        generationType === GENERATION_TYPES.outline_generation
          ? { targetChapterCount: 10 }
          : undefined,
    },
    mockConfig,
    "success",
  );
  return result.text;
}

const foundation = JSON.parse(
  await mockText(GENERATION_TYPES.foundation_proposal),
) as Record<string, unknown>;
assert.equal(typeof foundation.premise, "string");
assert.equal(typeof foundation.mainConflict, "string");
assert.equal(typeof foundation.readerPromise, "string");
assert.ok(
  foundation.relationshipSpeechRule &&
    typeof foundation.relationshipSpeechRule === "object",
  "mock foundation must include a relationship speech rule so relationship-heavy projects can lock",
);
assert.match(JSON.stringify(foundation), /mock-foundation:/);

const outlineText = await mockText(GENERATION_TYPES.outline_generation);
const outline = parseLenientJsonObject(outlineText);
assert.ok(outline, "mock outline must be a JSON object");
assert.equal(
  Array.isArray(outline.chapters) ? outline.chapters.length : 0,
  10,
  "mock outline must contain ten chapters for the v2 action",
);
assert.match(outlineText, /mock-outline:/);

const beatsText = await mockText(GENERATION_TYPES.beat_generation);
assert.equal(parseAndValidateBeatAiOutput(beatsText).length, 5);
assert.match(beatsText, /"mock":true/);

const summaryText = await mockText(
  GENERATION_TYPES.chapter_summary_generation,
);
assert.ok(parseAndValidateChapterSummaryAiOutput(summaryText).synopsis);
assert.match(summaryText, /\[mock:/);

const continuity = JSON.parse(
  await mockText(GENERATION_TYPES.continuity_delta),
) as Record<string, unknown>;
assert.ok(Array.isArray(continuity.continuityWarnings));
assert.match(JSON.stringify(continuity), /mock-continuity:/);

console.log("PASS credit generation matrix and mock-provider billing contracts");
