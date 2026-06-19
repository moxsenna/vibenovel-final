import { ApiClientError } from "@/lib/api";
import { allowMockFallback } from "@/lib/env";

export type HonestDataSource = "mock" | "api" | "locked" | "error";

export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError
    ? `API tidak tersedia (${error.message}). Coba muat ulang.`
    : fallback;
}

export const AI_FAILURE_REFUND_NOTICE =
  "Kredit tidak terpakai atau sudah dikembalikan otomatis.";

function safeAiFailureReason(error: ApiClientError): string | null {
  switch (error.code) {
    case "AI_PROVIDER_ERROR":
    case "AI_PROVIDER_TIMEOUT":
    case "AI_PROVIDER_RATE_LIMITED":
      return "Layanan AI sedang tidak tersedia.";
    case "INSUFFICIENT_CREDIT":
      return "Kredit tidak cukup.";
    case "AI_DISABLED":
    case "AI_NOT_CONFIGURED":
      return "Fitur AI belum tersedia.";
    default:
      return null;
  }
}

export function aiGenerationFailureNotice(error: unknown, prefix: string): string {
  const reason = error instanceof ApiClientError ? safeAiFailureReason(error) : null;
  return [prefix.endsWith(".") ? prefix : `${prefix}.`, reason, AI_FAILURE_REFUND_NOTICE]
    .filter(Boolean)
    .join(" ");
}

export function shouldLoadMockOnFailure(): boolean {
  return allowMockFallback();
}
