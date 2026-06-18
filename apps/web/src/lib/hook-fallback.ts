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

export function aiGenerationFailureNotice(error: unknown, prefix: string): string {
  const base =
    error instanceof ApiClientError ? `${prefix} (${error.message}).` : `${prefix}.`;
  return `${base} ${AI_FAILURE_REFUND_NOTICE}`;
}

export function shouldLoadMockOnFailure(): boolean {
  return allowMockFallback();
}
