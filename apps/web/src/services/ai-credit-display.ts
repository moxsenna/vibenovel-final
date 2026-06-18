import {
  WRITER_QUALITY_MODES,
  type WriterQualityMode,
} from "@vibenovel/shared";

const PROSE_BEAT_CREDIT_COSTS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 800,
  [WRITER_QUALITY_MODES.seimbang]: 1500,
  [WRITER_QUALITY_MODES.terbaik]: 7500,
};

const PROSE_REWRITE_CREDIT_COSTS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 500,
  [WRITER_QUALITY_MODES.seimbang]: 900,
  [WRITER_QUALITY_MODES.terbaik]: 4500,
};

const PUBLISH_COPY_CREDIT_COSTS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 400,
  [WRITER_QUALITY_MODES.seimbang]: 400,
  [WRITER_QUALITY_MODES.terbaik]: 400,
};

export function resolveDisplayedCreditCost(
  serverCreditCost: number | null | undefined,
  fallbackCreditCost: number,
): number {
  return Number.isInteger(serverCreditCost) && (serverCreditCost ?? 0) > 0
    ? (serverCreditCost as number)
    : fallbackCreditCost;
}

export function getProseBeatCreditCost(
  qualityMode: WriterQualityMode,
  serverCreditCost?: number | null,
): number {
  const fallback =
    PROSE_BEAT_CREDIT_COSTS[qualityMode] ?? PROSE_BEAT_CREDIT_COSTS.seimbang;
  return resolveDisplayedCreditCost(serverCreditCost, fallback);
}

export function getProseRewriteCreditCost(
  qualityMode: WriterQualityMode,
  serverCreditCost?: number | null,
): number {
  const fallback =
    PROSE_REWRITE_CREDIT_COSTS[qualityMode] ??
    PROSE_REWRITE_CREDIT_COSTS.seimbang;
  return resolveDisplayedCreditCost(serverCreditCost, fallback);
}

export function getPublishCopyCreditCost(
  qualityMode: WriterQualityMode,
  serverCreditCost?: number | null,
): number {
  const fallback =
    PUBLISH_COPY_CREDIT_COSTS[qualityMode] ??
    PUBLISH_COPY_CREDIT_COSTS.seimbang;
  return resolveDisplayedCreditCost(serverCreditCost, fallback);
}

export function formatProseBeatActionCostLabel(
  qualityMode: WriterQualityMode,
  serverCreditCost?: number | null,
): string {
  const cost = getProseBeatCreditCost(qualityMode, serverCreditCost);
  return `Biaya Tulis Beat dengan AI: ${cost} kredit`;
}

export function formatProseBeatCreditCostLabel(
  qualityMode: WriterQualityMode,
  serverCreditCost?: number | null,
): string {
  const cost = getProseBeatCreditCost(qualityMode, serverCreditCost);
  return `Biaya: ${cost} kredit`;
}

export function formatProseRewriteActionCostLabel(
  qualityMode: WriterQualityMode,
  serverCreditCost?: number | null,
): string {
  const cost = getProseRewriteCreditCost(qualityMode, serverCreditCost);
  return `Biaya rewrite: ${cost} kredit`;
}

export function formatPublishCopyCreditCostLabel(
  qualityMode: WriterQualityMode,
  serverCreditCost?: number | null,
): string {
  const cost = getPublishCopyCreditCost(qualityMode, serverCreditCost);
  return `Biaya: ${cost} kredit`;
}

export function formatPublishCopyTierCostsLabel(): string {
  return "Biaya mengikuti estimasi server.";
}
