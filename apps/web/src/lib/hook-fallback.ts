import { ApiClientError } from "@/lib/api";
import { allowMockFallback } from "@/lib/env";

export type HonestDataSource = "mock" | "api" | "locked" | "error";

export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError
    ? `API tidak tersedia (${error.message}). Coba muat ulang.`
    : fallback;
}

export function shouldLoadMockOnFailure(): boolean {
  return allowMockFallback();
}