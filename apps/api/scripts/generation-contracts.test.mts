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
import { resolveModelForGeneration } from "../src/services/model-router.ts";

const bindings: AppBindings = {
  AI_PROVIDER_MOCK: "true",
};

const planningGenerationContracts: Array<{
  key: "concept_generation" | "foundation_proposal" | "outline_generation";
  value: string;
  costs: Record<WriterQualityMode, number>;
  tokenCap: number;
}> = [
  {
    key: "concept_generation",
    value: "concept_generation",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 3,
      [WRITER_QUALITY_MODES.seimbang]: 6,
      [WRITER_QUALITY_MODES.terbaik]: 12,
    },
    tokenCap: 3000,
  },
  {
    key: "foundation_proposal",
    value: "foundation_proposal",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 3,
      [WRITER_QUALITY_MODES.seimbang]: 6,
      [WRITER_QUALITY_MODES.terbaik]: 12,
    },
    tokenCap: 3000,
  },
  {
    key: "outline_generation",
    value: "outline_generation",
    costs: {
      [WRITER_QUALITY_MODES.hemat]: 5,
      [WRITER_QUALITY_MODES.seimbang]: 10,
      [WRITER_QUALITY_MODES.terbaik]: 20,
    },
    tokenCap: 4000,
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
      `${contract.key} ${qualityMode} cost must match the Sprint 1 contract`,
    );
  }

  assert.equal(
    resolveModelForGeneration(bindings, {
      generationType,
      qualityMode: WRITER_QUALITY_MODES.terbaik,
    }).maxOutputTokens,
    contract.tokenCap,
    `${contract.key} must resolve enough output tokens for planning JSON`,
  );
}

assert.equal(
  resolveModelForGeneration(bindings, {
    generationType: GENERATION_TYPES.publish_copy,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
  }).maxOutputTokens,
  800,
  "publish_copy must keep the short marketing-copy token cap",
);

assert.equal(
  GENERATION_TYPES.draft_import_signal_extraction,
  "draft_import_signal_extraction",
  "draft import signal extraction must be a first-class internal generation type",
);

assert.equal(
  resolveModelForGeneration(bindings, {
    generationType: GENERATION_TYPES.draft_import_signal_extraction,
    qualityMode: WRITER_QUALITY_MODES.hemat,
  }).maxOutputTokens,
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

const migrationSql = readFileSync(
  "../../supabase/migrations/00011_sprint13_generation_type_contracts.sql",
  "utf8",
);
for (const contract of planningGenerationContracts) {
  assert.match(
    migrationSql,
    new RegExp(`ADD VALUE IF NOT EXISTS '${contract.value}'`),
    `${contract.key} must be present in the Supabase generation_type enum migration`,
  );
}

console.log("PASS generation contracts are first-class and correctly budgeted");
