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

/** Mirrors server ai-credit-policy prose_beat costs — display only; billing is server-side. */
const PROSE_BEAT_CREDIT_COSTS: Record<WriterQualityMode, number> = {
  [WRITER_QUALITY_MODES.hemat]: 5,
  [WRITER_QUALITY_MODES.seimbang]: 10,
  [WRITER_QUALITY_MODES.terbaik]: 20,
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

export function formatProseBeatCreditCostLabel(qualityMode: WriterQualityMode): string {
  const cost = getProseBeatCreditCost(qualityMode);
  return `Biaya: ${cost} kredit`;
}

export function buildBeatProseIdempotencyKey(beatId: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${beatId}-${Date.now()}-${suffix}`;
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