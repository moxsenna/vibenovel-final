import type {
  ChapterProseVersion,
  CreditBalance,
  GenerationStatus,
  GenerationType,
  WriterQualityMode,
} from "@vibenovel/shared";
import { WRITER_QUALITY_MODES } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface GenerateBeatProseInput {
  chapterOutlineId: string;
  beatId: string;
  writingSessionId?: string;
  qualityMode: WriterQualityMode;
  idempotencyKey: string;
  instruction?: string;
}

/** Safe subset returned by POST /ai/generate-prose — no prompt/packet fields. */
export interface GenerationAttemptSummary {
  id: string;
  status: GenerationStatus;
  generationType: GenerationType;
  creditCost: number;
  outputEntityId: string | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
}

export interface GenerateBeatProseResponse {
  version: ChapterProseVersion;
  generationAttempt: GenerationAttemptSummary;
  creditBalance: CreditBalance | null;
  creditCost: number;
  idempotentReplay: boolean;
}

/** Mirrors server ai-credit-policy — display only; billing is server-side. */
const PROSE_BEAT_CREDIT_COSTS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 5,
  [WRITER_QUALITY_MODES.seimbang]: 10,
  [WRITER_QUALITY_MODES.terbaik]: 20,
};

const PROSE_REWRITE_CREDIT_COSTS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 3,
  [WRITER_QUALITY_MODES.seimbang]: 6,
  [WRITER_QUALITY_MODES.terbaik]: 12,
};

const QUALITY_SET = new Set<string>(Object.values(WRITER_QUALITY_MODES));

export function normalizeQualityMode(value: string | null | undefined): WriterQualityMode {
  if (value && QUALITY_SET.has(value)) {
    return value as WriterQualityMode;
  }
  return WRITER_QUALITY_MODES.seimbang;
}

export function getProseBeatCreditCost(qualityMode: WriterQualityMode): number {
  return PROSE_BEAT_CREDIT_COSTS[qualityMode] ?? PROSE_BEAT_CREDIT_COSTS.seimbang;
}

export function getProseRewriteCreditCost(qualityMode: WriterQualityMode): number {
  return PROSE_REWRITE_CREDIT_COSTS[qualityMode] ?? PROSE_REWRITE_CREDIT_COSTS.seimbang;
}

export function formatQualityModeLabel(qualityMode: WriterQualityMode): string {
  if (qualityMode === WRITER_QUALITY_MODES.hemat) return "Hemat";
  if (qualityMode === WRITER_QUALITY_MODES.terbaik) return "Terbaik";
  return "Seimbang";
}

export function formatProseBeatCreditCostLabel(qualityMode: WriterQualityMode): string {
  const cost = getProseBeatCreditCost(qualityMode);
  return `Biaya: ${cost} kredit`;
}

export function formatProseBeatActionCostLabel(qualityMode: WriterQualityMode): string {
  const cost = getProseBeatCreditCost(qualityMode);
  return `Biaya Tulis Beat dengan AI: ${cost} kredit`;
}

export function formatProseRewriteActionCostLabel(qualityMode: WriterQualityMode): string {
  const cost = getProseRewriteCreditCost(qualityMode);
  return `Biaya rewrite: ${cost} kredit`;
}

export const PROSE_REWRITE_MODES = {
  improve_emotion: "improve_emotion",
  tighten_pacing: "tighten_pacing",
  natural_dialogue: "natural_dialogue",
  shorter: "shorter",
  longer: "longer",
  custom: "custom",
} as const;

export type ProseRewriteMode =
  (typeof PROSE_REWRITE_MODES)[keyof typeof PROSE_REWRITE_MODES];

const REWRITE_MODE_SET = new Set<string>(Object.values(PROSE_REWRITE_MODES));

export function isProseRewriteMode(value: string): value is ProseRewriteMode {
  return REWRITE_MODE_SET.has(value);
}

export function formatProseRewriteModeLabel(mode: ProseRewriteMode): string {
  switch (mode) {
    case PROSE_REWRITE_MODES.improve_emotion:
      return "Perkuat emosi";
    case PROSE_REWRITE_MODES.tighten_pacing:
      return "Rapikan pacing";
    case PROSE_REWRITE_MODES.natural_dialogue:
      return "Naturalkan dialog";
    case PROSE_REWRITE_MODES.shorter:
      return "Buat lebih singkat";
    case PROSE_REWRITE_MODES.longer:
      return "Buat lebih detail";
    case PROSE_REWRITE_MODES.custom:
      return "Instruksi khusus";
    default:
      return mode;
  }
}

export function buildBeatProseIdempotencyKey(beatId: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${beatId}-${Date.now()}-${suffix}`;
}

export function buildRewriteProseIdempotencyKey(beatId: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `rewrite-${beatId}-${Date.now()}-${suffix}`;
}

export interface RewriteBeatProseInput {
  proseVersionId?: string;
  beatId?: string;
  writingSessionId: string;
  rewriteMode: ProseRewriteMode;
  qualityMode?: WriterQualityMode;
  instruction?: string;
  idempotencyKey: string;
}

export interface RewriteBeatProseResponse {
  proseVersion: ChapterProseVersion;
  generationAttempt: GenerationAttemptSummary;
  creditBalance: CreditBalance | null;
  rewriteMode: ProseRewriteMode;
  idempotentReplay: boolean;
}

export function mapAiGenerationErrorCode(code: string): string {
  switch (code) {
    case "AI_DISABLED":
      return "AI generation belum aktif.";
    case "INSUFFICIENT_CREDIT":
      return "Kredit tidak cukup.";
    case "AI_PROVIDER_ERROR":
    case "AI_PROVIDER_TIMEOUT":
      return "AI sedang bermasalah. Kredit dikembalikan jika sudah terpotong.";
    case "AI_OUTPUT_UNSAFE":
      return "Output AI ditolak oleh pemeriksaan keamanan.";
    case "GENERATION_IN_PROGRESS":
      return "Generasi masih berjalan.";
    case "GENERATION_FAILED":
      return "Generasi gagal. Coba lagi dengan permintaan baru.";
    case "AI_NOT_CONFIGURED":
      return "AI generation belum dikonfigurasi.";
    case "INVALID_STATE":
      return "Sesi menulis tidak siap untuk generasi AI.";
    default:
      return "Gagal menghasilkan narasi AI.";
  }
}

export function mapAiRewriteErrorCode(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "NO_PROSE_TO_REWRITE":
      return "Belum ada teks untuk diperbaiki.";
    case "GENERATION_IN_PROGRESS":
      return "Rewrite masih berjalan.";
    case "GENERATION_FAILED":
      return "Rewrite sebelumnya gagal. Coba lagi dengan permintaan baru.";
    case "AI_OUTPUT_UNSAFE":
      return "Output rewrite ditolak oleh pemeriksaan keamanan.";
    case "BAD_REQUEST":
      return fallbackMessage?.trim() || "Permintaan rewrite tidak valid.";
    default:
      return mapAiGenerationErrorCode(code);
  }
}

export async function generateBeatProse(
  projectId: string,
  token: string | null | undefined,
  input: GenerateBeatProseInput,
): Promise<GenerateBeatProseResponse> {
  return apiRequest<GenerateBeatProseResponse>(
    `/api/projects/${projectId}/ai/generate-prose`,
    { method: "POST", body: input, token },
  );
}

export async function rewriteBeatProse(
  projectId: string,
  token: string | null | undefined,
  input: RewriteBeatProseInput,
): Promise<RewriteBeatProseResponse> {
  return apiRequest<RewriteBeatProseResponse>(
    `/api/projects/${projectId}/ai/rewrite-prose`,
    { method: "POST", body: input, token },
  );
}