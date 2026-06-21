import type { WriterQualityMode } from "@vibenovel/shared";

export type CreditEstimateFeature =
  | "intake_chat_reply"
  | "concept_generate_3"
  | "foundation_setup"
  | "outline_10_chapters"
  | "chapter_beats_generate"
  | "summary_delta"
  | "continuity_check_standalone"
  | "prose_beat"
  | "prose_rewrite"
  | "publish_package";

export interface CreditEstimate {
  feature: CreditEstimateFeature;
  qualityMode: WriterQualityMode | null;
  creditCost: number;
  creditPricingVersion: string;
}

export function buildCreditEstimatePath(
  feature: CreditEstimateFeature,
  qualityMode?: WriterQualityMode,
): string {
  const params = new URLSearchParams({ feature });
  if (qualityMode) params.set("qualityMode", qualityMode);
  return `/api/credits/estimate?${params.toString()}`;
}
