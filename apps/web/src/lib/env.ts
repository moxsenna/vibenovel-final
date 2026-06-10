/** Default true so Sprint 1 UI stays stable when API is offline. */
export function shouldUseMocks(): boolean {
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