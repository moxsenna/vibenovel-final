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

/** Fixed MVP costs — client cannot override. */
const CREDIT_COST_TABLE: Record<
  GenerationType,
  Record<WriterQualityMode, number | null>
> = {
  [GENERATION_TYPES.prose_beat]: {
    [WRITER_QUALITY_MODES.hemat]: 5,
    [WRITER_QUALITY_MODES.seimbang]: 10,
    [WRITER_QUALITY_MODES.terbaik]: 20,
  },
  [GENERATION_TYPES.prose_rewrite]: {
    [WRITER_QUALITY_MODES.hemat]: 3,
    [WRITER_QUALITY_MODES.seimbang]: 6,
    [WRITER_QUALITY_MODES.terbaik]: 12,
  },
  [GENERATION_TYPES.publish_copy]: {
    [WRITER_QUALITY_MODES.hemat]: 3,
    [WRITER_QUALITY_MODES.seimbang]: 6,
    [WRITER_QUALITY_MODES.terbaik]: 12,
  },
  [GENERATION_TYPES.summary_delta]: {
    [WRITER_QUALITY_MODES.hemat]: null,
    [WRITER_QUALITY_MODES.seimbang]: null,
    [WRITER_QUALITY_MODES.terbaik]: null,
  },
};

const ENABLED_GENERATION_TYPES = new Set<GenerationType>([
  GENERATION_TYPES.prose_beat,
  GENERATION_TYPES.prose_rewrite,
  GENERATION_TYPES.publish_copy,
]);

export function assertGenerationTypeCreditEnabled(generationType: GenerationType): void {
  if (!ENABLED_GENERATION_TYPES.has(generationType)) {
    throw new AppError(
      "CREDIT_INVALID_AMOUNT",
      "Credit billing is not enabled for this generation type",
      400,
    );
  }
}

/** Resolve fixed credit cost from generation type + quality tier only. */
export function getCreditCostForGeneration(input: CreditCostInput): number {
  assertGenerationTypeCreditEnabled(input.generationType);
  const cost = CREDIT_COST_TABLE[input.generationType][input.qualityMode];
  if (cost === null || cost <= 0) {
    throw new AppError(
      "CREDIT_INVALID_AMOUNT",
      "Credit cost is not configured for this generation type",
      400,
    );
  }
  return cost;
}