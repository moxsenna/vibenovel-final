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

const PUBLISH_COPY_FALLBACK_CREDIT_COST = 400;

function formatCreditNumber(value: number): string {
  return value.toLocaleString("id-ID");
}

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
  serverCreditCost?: number | null,
): number {
  return resolveDisplayedCreditCost(
    serverCreditCost,
    PUBLISH_COPY_FALLBACK_CREDIT_COST,
  );
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
  serverCreditCost?: number | null,
): string {
  const cost = getPublishCopyCreditCost(serverCreditCost);
  return `Biaya: ${cost} kredit`;
}

export function formatPublishCopyTierCostsLabel(): string {
  return "Biaya mengikuti estimasi server.";
}

export function formatCreditSuccessNotice(
  actionLabel: string,
  creditCost: number,
  remainingBalance: number | null,
  idempotentReplay = false,
): string {
  const costCopy =
    creditCost > 0
      ? `${formatCreditNumber(creditCost)} kredit digunakan.`
      : "Tidak ada kredit yang digunakan.";
  const balanceCopy =
    remainingBalance != null
      ? ` Sisa kredit: ${formatCreditNumber(remainingBalance)}.`
      : "";
  const replayCopy = idempotentReplay
    ? " Hasil permintaan sebelumnya ditampilkan kembali."
    : "";
  return `${actionLabel}. ${costCopy}${balanceCopy}${replayCopy}`;
}

export function formatPremiumQualityWarning(
  qualityMode: WriterQualityMode,
  creditCost: number,
): string | null {
  if (qualityMode !== WRITER_QUALITY_MODES.terbaik) return null;
  return `Mode Terbaik memakai ${formatCreditNumber(
    creditCost,
  )} kredit. Gunakan untuk adegan kunci seperti opening, klimaks, atau ending.`;
}
