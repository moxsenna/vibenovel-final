import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type GenerationType,
  type WriterQualityMode,
} from "@vibenovel/shared";
import { AppError } from "../errors.js";

export interface CreditCostInput {
  generationType: GenerationType;
  qualityMode: WriterQualityMode;
}

export type NarrazaAiFeature =
  | "intake_chat_reply"
  | "concept_generate_3"
  | "foundation_setup"
  | "draft_import_signal_extraction"
  | "outline_10_chapters"
  | "chapter_beats_generate"
  | "summary_delta"
  | "continuity_check_standalone"
  | "prose_beat"
  | "prose_rewrite"
  | "publish_package";

const FEATURE_KEYS = new Set<NarrazaAiFeature>([
  "intake_chat_reply",
  "concept_generate_3",
  "foundation_setup",
  "draft_import_signal_extraction",
  "outline_10_chapters",
  "chapter_beats_generate",
  "summary_delta",
  "continuity_check_standalone",
  "prose_beat",
  "prose_rewrite",
  "publish_package",
]);

export function isNarrazaAiFeature(value: unknown): value is NarrazaAiFeature {
  return typeof value === "string" && FEATURE_KEYS.has(value as NarrazaAiFeature);
}

export interface FeatureCreditCostInput {
  feature: NarrazaAiFeature;
  qualityMode?: WriterQualityMode;
}

export const CREDIT_PRICING_VERSION = "v2";

const GENERATION_TYPE_FEATURE_MAP: Record<GenerationType, NarrazaAiFeature> = {
  [GENERATION_TYPES.intake_assistant]: "intake_chat_reply",
  [GENERATION_TYPES.concept_generation]: "concept_generate_3",
  [GENERATION_TYPES.foundation_proposal]: "foundation_setup",
  [GENERATION_TYPES.draft_import_signal_extraction]:
    "draft_import_signal_extraction",
  [GENERATION_TYPES.outline_generation]: "outline_10_chapters",
  [GENERATION_TYPES.beat_generation]: "chapter_beats_generate",
  [GENERATION_TYPES.chapter_summary_generation]: "summary_delta",
  [GENERATION_TYPES.continuity_delta]: "continuity_check_standalone",
  [GENERATION_TYPES.prose_beat]: "prose_beat",
  [GENERATION_TYPES.prose_rewrite]: "prose_rewrite",
  [GENERATION_TYPES.publish_copy]: "publish_package",
  [GENERATION_TYPES.summary_delta]: "summary_delta",
};

/**
 * Single server-side source of truth.
 * Phase 1 intentionally preserves every existing value byte-for-byte.
 */
const CREDIT_COST_TABLE: Record<
  NarrazaAiFeature,
  Record<WriterQualityMode, number | null>
> = {
  intake_chat_reply: {
    [WRITER_QUALITY_MODES.hemat]: 100,
    [WRITER_QUALITY_MODES.seimbang]: 100,
    [WRITER_QUALITY_MODES.terbaik]: 100,
  },
  concept_generate_3: {
    [WRITER_QUALITY_MODES.hemat]: 1000,
    [WRITER_QUALITY_MODES.seimbang]: 1000,
    [WRITER_QUALITY_MODES.terbaik]: 1000,
  },
  foundation_setup: {
    [WRITER_QUALITY_MODES.hemat]: 2000,
    [WRITER_QUALITY_MODES.seimbang]: 2000,
    [WRITER_QUALITY_MODES.terbaik]: 2000,
  },
  draft_import_signal_extraction: {
    [WRITER_QUALITY_MODES.hemat]: null,
    [WRITER_QUALITY_MODES.seimbang]: null,
    [WRITER_QUALITY_MODES.terbaik]: null,
  },
  outline_10_chapters: {
    [WRITER_QUALITY_MODES.hemat]: 2500,
    [WRITER_QUALITY_MODES.seimbang]: 2500,
    [WRITER_QUALITY_MODES.terbaik]: 2500,
  },
  chapter_beats_generate: {
    [WRITER_QUALITY_MODES.hemat]: 3,
    [WRITER_QUALITY_MODES.seimbang]: 3,
    [WRITER_QUALITY_MODES.terbaik]: 3,
  },
  summary_delta: {
    [WRITER_QUALITY_MODES.hemat]: 500,
    [WRITER_QUALITY_MODES.seimbang]: 500,
    [WRITER_QUALITY_MODES.terbaik]: 500,
  },
  continuity_check_standalone: {
    [WRITER_QUALITY_MODES.hemat]: 500,
    [WRITER_QUALITY_MODES.seimbang]: 500,
    [WRITER_QUALITY_MODES.terbaik]: 500,
  },
  prose_beat: {
    [WRITER_QUALITY_MODES.hemat]: 800,
    [WRITER_QUALITY_MODES.seimbang]: 1500,
    [WRITER_QUALITY_MODES.terbaik]: 7500,
  },
  prose_rewrite: {
    [WRITER_QUALITY_MODES.hemat]: 500,
    [WRITER_QUALITY_MODES.seimbang]: 900,
    [WRITER_QUALITY_MODES.terbaik]: 4500,
  },
  publish_package: {
    [WRITER_QUALITY_MODES.hemat]: 400,
    [WRITER_QUALITY_MODES.seimbang]: 400,
    [WRITER_QUALITY_MODES.terbaik]: 400,
  },
};

const ENABLED_GENERATION_TYPES = new Set<GenerationType>([
  GENERATION_TYPES.intake_assistant,
  GENERATION_TYPES.concept_generation,
  GENERATION_TYPES.foundation_proposal,
  GENERATION_TYPES.outline_generation,
  GENERATION_TYPES.beat_generation,
  GENERATION_TYPES.chapter_summary_generation,
  GENERATION_TYPES.continuity_delta,
  GENERATION_TYPES.prose_beat,
  GENERATION_TYPES.prose_rewrite,
  GENERATION_TYPES.publish_copy,
  GENERATION_TYPES.summary_delta,
]);

const PROSE_GENERATION_TYPES = new Set<GenerationType>([
  GENERATION_TYPES.prose_beat,
  GENERATION_TYPES.prose_rewrite,
]);

export function assertGenerationTypeCreditEnabled(
  generationType: GenerationType,
): void {
  if (!ENABLED_GENERATION_TYPES.has(generationType)) {
    throw new AppError(
      "CREDIT_INVALID_AMOUNT",
      "Credit billing is not enabled for this generation type",
      400,
    );
  }
}

/** Default daily credit cap v2 — harus >= max action cost. */
export const DEFAULT_DAILY_DEBIT_CAP_V2 = 100_000;

/** Maximum configured credit cost across all generation types and quality modes. */
export function getMaximumConfiguredCreditCost(): number {
  return Math.max(
    ...Object.values(CREDIT_COST_TABLE).flatMap((byMode) =>
      Object.values(byMode).filter((value): value is number => typeof value === "number"),
    ),
  );
}

export function getFeatureKeyForGenerationType(
  generationType: GenerationType,
): NarrazaAiFeature {
  return GENERATION_TYPE_FEATURE_MAP[generationType];
}

export function resolveQualityModeForGeneration(
  generationType: GenerationType,
  requestedQualityMode: WriterQualityMode,
): WriterQualityMode {
  return PROSE_GENERATION_TYPES.has(generationType)
    ? requestedQualityMode
    : WRITER_QUALITY_MODES.hemat;
}

export function getCreditCost(input: FeatureCreditCostInput): number {
  const qualityMode = input.qualityMode ?? WRITER_QUALITY_MODES.hemat;
  const cost = CREDIT_COST_TABLE[input.feature]?.[qualityMode];
  if (cost === null || cost === undefined || cost <= 0) {
    throw new AppError(
      "CREDIT_INVALID_AMOUNT",
      "Credit cost is not configured for this AI feature",
      400,
    );
  }
  return cost;
}

/** Compatibility adapter for existing generation-type orchestrators. */
export function getCreditCostForGeneration(input: CreditCostInput): number {
  assertGenerationTypeCreditEnabled(input.generationType);
  return getCreditCost({
    feature: getFeatureKeyForGenerationType(input.generationType),
    qualityMode: resolveQualityModeForGeneration(
      input.generationType,
      input.qualityMode,
    ),
  });
}
