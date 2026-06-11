/**
 * Whether to render mock/demo data instead of calling the real API.
 *
 * Boundary lock (Sprint 12 Task 12.3c): a PRODUCTION build must NEVER serve
 * mocks — even if `VITE_USE_MOCKS` is missing or accidentally set to "true",
 * and regardless of any `__MOCK_OVERRIDE__`. Mocks are dev/test/demo only.
 * In dev/test the default stays true so the Sprint 1 UI is stable offline.
 */
export function shouldUseMocks(): boolean {
  if (import.meta.env.PROD) return false;

  const isTestOrDev = import.meta.env.MODE === "test" || import.meta.env.DEV;
  if (isTestOrDev && typeof window !== "undefined") {
    const override = (window as any).__MOCK_OVERRIDE__;
    if (override === "false") return false;
    if (override === "true") return true;
  }
  const raw = import.meta.env.VITE_USE_MOCKS?.trim().toLowerCase();
  if (raw === "false") return false;
  return true;
}

/** Mock Sprint 1 data may only load when explicit demo mode is on. */
export function allowMockFallback(): boolean {
  return shouldUseMocks();
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL?.trim() || "http://127.0.0.1:8787";
}

export function isApiModeEnabled(): boolean {
  return !shouldUseMocks();
}