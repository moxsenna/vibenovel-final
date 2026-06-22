import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type GenerationType,
  type WriterQualityMode,
} from "@vibenovel/shared";
import type { AppBindings } from "../src/env.ts";
import { AppError } from "../src/errors.ts";
import { getCreditCostForGeneration } from "../src/services/ai-credit-policy.ts";
import { parseAndValidateBeatAiOutput } from "../src/services/beat-generation-ai.ts";
import { parseAndValidateChapterSummaryAiOutput } from "../src/services/chapter-summary-schema.ts";
import { resolveGenerationRoute } from "../src/services/ai-routing-policy.ts";

const bindings: AppBindings = {
  AI_PROVIDER_MOCK: "true",
};

// Structured engines must preflight the route, pass the attempt id, and supply
// an output validator to the router's success boundary.
for (const file of [
  "src/services/intake.ts",
  "src/services/concept.ts",
  "src/services/foundation-proposal.ts",
  "src/services/asisten-narra-foundation-patch.ts",
  "src/services/outline-generator.ts",
  "src/services/beat-generation-ai.ts",
  "src/services/chapter-summary-ai.ts",
]) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /assertGenerationRouteCallable/, `${file} must preflight`);
  assert.match(
    source,
    /generationAttemptId:\s*attempt\.id/,
    `${file} must pass the attempt id`,
  );
  assert.match(source, /validateOutput:/, `${file} must pass a validator`);
}

// publish-copy validates through the safe-repair wrapper, but still preflights
// and threads the attempt id into the router.
{
  const source = readFileSync("src/services/publish-copy-ai-generation.ts", "utf8");
  assert.match(source, /assertGenerationRouteCallable/);
  assert.match(source, /generationAttemptId:\s*attempt\.id/);
}

const planningGenerationContracts: Array<{
  key:
    | "concept_generation"
    | "foundation_proposal"
    | "outline_generation"
    | "beat_generation"
    | "chapter_summary_generation";
  value: string;
  costs: Record<WriterQualityMode, number>;
  tokenCap: number;
}> = [
  {
    key: "concept_generation",
    value: "concept_generation",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 1000,
      [WRITER_QUALITY_MODES.seimbang]: 1000,
      [WRITER_QUALITY_MODES.terbaik]: 1000,
    },
    tokenCap: 3000,
  },
  {
    key: "foundation_proposal",
    value: "foundation_proposal",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 2000,
      [WRITER_QUALITY_MODES.seimbang]: 2000,
      [WRITER_QUALITY_MODES.terbaik]: 2000,
    },
    tokenCap: 3000,
  },
  {
    key: "outline_generation",
    value: "outline_generation",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 2500,
      [WRITER_QUALITY_MODES.seimbang]: 2500,
      [WRITER_QUALITY_MODES.terbaik]: 2500,
    },
    tokenCap: 4000,
  },
  {
    key: "beat_generation",
    value: "beat_generation",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 3,
      [WRITER_QUALITY_MODES.seimbang]: 3,
      [WRITER_QUALITY_MODES.terbaik]: 3,
    },
    tokenCap: 3000,
  },
  {
    key: "chapter_summary_generation",
    value: "chapter_summary_generation",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 500,
      [WRITER_QUALITY_MODES.seimbang]: 500,
      [WRITER_QUALITY_MODES.terbaik]: 500,
    },
    tokenCap: 3000,
  },
];

for (const contract of planningGenerationContracts) {
  const generationType = GENERATION_TYPES[contract.key] as GenerationType;

  assert.equal(
    generationType,
    contract.value,
    `${contract.key} must be a first-class generation type`,
  );

  for (const [qualityMode, expectedCost] of Object.entries(contract.costs)) {
    assert.equal(
      getCreditCostForGeneration({
        generationType,
        qualityMode: qualityMode as WriterQualityMode,
      }),
      expectedCost,
      `${contract.key} ${qualityMode} cost must match the v2 contract`,
    );
  }

  assert.equal(
    resolveGenerationRoute(generationType, WRITER_QUALITY_MODES.terbaik)
      .maxOutputTokens,
    contract.tokenCap,
    `${contract.key} must resolve enough output tokens for planning JSON`,
  );
}

assert.equal(
  resolveGenerationRoute(
    GENERATION_TYPES.publish_copy,
    WRITER_QUALITY_MODES.terbaik,
  ).maxOutputTokens,
  800,
  "publish_copy must keep the short marketing-copy token cap",
);

assert.equal(
  GENERATION_TYPES.draft_import_signal_extraction,
  "draft_import_signal_extraction",
  "draft import signal extraction must be a first-class internal generation type",
);

assert.equal(
  resolveGenerationRoute(
    GENERATION_TYPES.draft_import_signal_extraction,
    WRITER_QUALITY_MODES.hemat,
  ).maxOutputTokens,
  1800,
  "draft import signal extraction must have a bounded JSON token cap",
);

assert.throws(
  () =>
    getCreditCostForGeneration({
      generationType: GENERATION_TYPES.draft_import_signal_extraction,
      qualityMode: WRITER_QUALITY_MODES.hemat,
    }),
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "CREDIT_INVALID_AMOUNT" &&
    err.message.includes("not enabled"),
  "draft import signal extraction must not be billable while import review is in test mode",
);

assert.deepEqual(
  resolveGenerationRoute(
    GENERATION_TYPES.draft_import_signal_extraction,
    WRITER_QUALITY_MODES.hemat,
  ).primary,
  { provider: "openrouter", model: "gemini_flash_lite" },
  "draft import routing must resolve through the typed policy",
);

const wranglerToml = readFileSync("wrangler.toml", "utf8");
assert.doesNotMatch(
  wranglerToml,
  /DEFAULT_AI_MODEL/,
  "deployment config must not bypass the typed policy with a global default",
);

const migrationSql = readFileSync(
  "../../supabase/migrations/00011_sprint13_generation_type_contracts.sql",
  "utf8",
);
for (const contract of planningGenerationContracts) {
  if (
    contract.key === "beat_generation" ||
    contract.key === "chapter_summary_generation"
  ) {
    continue;
  }
  assert.match(
    migrationSql,
    new RegExp(`ADD VALUE IF NOT EXISTS '${contract.value}'`),
    `${contract.key} must be present in the Supabase generation_type enum migration`,
  );
}


const sprint12MigrationSql = readFileSync(
  "../../supabase/migrations/00020_sprint12_story_generation_types.sql",
  "utf8",
);
for (const value of [
  "intake_assistant",
  "beat_generation",
  "chapter_summary_generation",
  "continuity_delta",
]) {
  assert.match(
    sprint12MigrationSql,
    new RegExp(value.replace(/_/g, "_")),
    `migration 00020 must add generation_type ${value}`,
  );
}

const beatJson = JSON.stringify({
  beats: [
    {
      beatNumber: 1,
      title: "A",
      summary: "Ringkasan adegan yang cukup panjang.",
      direction: "Arah penulisan jelas.",
      emotionalShift: "tenang",
      mustInclude: [],
      mustNotInclude: [],
      wordTarget: 350,
      stopCondition: "Selesai.",
    },
    {
      beatNumber: 2,
      title: "B",
      summary: "Lanjutan.",
      direction: "Eskalasi.",
      emotionalShift: "tegang",
      mustInclude: [],
      mustNotInclude: [],
      wordTarget: 400,
      stopCondition: "Hook.",
    },
    {
      beatNumber: 3,
      title: "C",
      summary: "Puncak.",
      direction: "Konflik.",
      emotionalShift: "tegang",
      mustInclude: [],
      mustNotInclude: [],
      wordTarget: 400,
      stopCondition: "Resolusi.",
    },
    {
      beatNumber: 4,
      title: "D",
      summary: "Turun.",
      direction: "Konsekuensi.",
      emotionalShift: "cemas",
      mustInclude: [],
      mustNotInclude: [],
      wordTarget: 350,
      stopCondition: "Biaya.",
    },
    {
      beatNumber: 5,
      title: "E",
      summary: "Penutup.",
      direction: "Hook bab.",
      emotionalShift: "penasaran",
      mustInclude: [],
      mustNotInclude: [],
      wordTarget: 350,
      stopCondition: "Cliffhanger.",
    },
  ],
});
assert.equal(parseAndValidateBeatAiOutput(beatJson).length, 5, "beat AI JSON must parse five beats");
assert.throws(
  () => parseAndValidateBeatAiOutput('{"beats":[]}'),
  (err: unknown) => err instanceof AppError && err.code === "GENERATION_FAILED",
  "beat parser must reject too few beats",
);

const summaryJson = JSON.stringify({
  synopsis: "Intisari bab yang valid tanpa marker terlarang.",
  miniVictory: null,
  emotionalOutcome: null,
  endingHook: null,
  newFacts: [],
  characterStateChanges: [],
  relationshipChanges: [],
  openLoopUpdates: [],
  revealProgress: [],
  continuityWarnings: [],
});
assert.equal(
  parseAndValidateChapterSummaryAiOutput(summaryJson).synopsis.length > 0,
  true,
  "chapter summary AI JSON must parse synopsis",
);
assert.throws(
  () => parseAndValidateChapterSummaryAiOutput("not json"),
  (err: unknown) => err instanceof AppError && err.code === "GENERATION_FAILED",
  "summary parser must reject invalid JSON",
);


const aiProposalSource = readFileSync("src/services/ai-proposal.ts", "utf8");
assert.match(aiProposalSource, /promoteProposalToCanon/, "generic accept must call promoteProposalToCanon");
assert.match(aiProposalSource, /CANON_PROMOTABLE_TYPES/, "generic accept must gate promotable types");
assert.doesNotMatch(
  aiProposalSource,
  /status_only_no_canon_promotion/,
  "generic accept must not log status_only_no_canon_promotion",
);

console.log("PASS generation contracts are first-class and correctly budgeted");
