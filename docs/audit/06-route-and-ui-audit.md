# 06 - Route and UI Audit

Evidence utama: `apps/web/src/routes/index.tsx`, `apps/web/src/pages/*`, `apps/web/src/hooks/*`, `apps/web/src/components/*`.

| Route | Purpose | Current status | Mock dependency | UI issue | Mobile issue | Desktop issue | Copy issue | Recommended fix | Priority |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Landing | Implemented | Low | None found in static audit | Not visually verified | Not visually verified | Avoid overclaim | Visual pass later | P3 |
| `/login` | Login/signup | Implemented | Low | "Lanjut ke dashboard" link can confuse signed-out API mode | Not verified | Not verified | CTA implies dashboard reachable | In API mode, label should reflect login requirement or rely on guard; verify logout E2E | P1 |
| AppShell protected routes | Workspace guard | Implemented | Depends on `shouldUseMocks` | Guard only blocks when API mode | Not verified | Not verified | "Memeriksa sesi..." OK | Verify production env `VITE_USE_MOCKS=false` and signed-out redirect | P0 |
| `/dashboard` | Dashboard | Implemented | Mock fallback in dev | E2E saw stale user content after logout | Not verified | Not verified | "Halo, Penulis!" should not appear signed-out | Rerun auth regression on production-like env | P0 |
| `/start` | New project entry | Implemented | Uses `DEMO_PROJECT_ID` route helper in mock config | Start route must resolve real project in API mode | Not verified | Not verified | Guided copy OK | Ensure no demo ID in API mode | P1 |
| `/projects/:id/intake` | Story intake | Partial/Implemented | Mock fallback in dev | E2E blocked by token | Not verified | Not verified | Beginner-friendly | Fix auth; verify agent reply and signals | P0 |
| `/projects/:id/concepts` | 3 concepts | Partial/Implemented | Mock fallback in dev | E2E saw no concepts after token error | Not verified | Not verified | CTA clear | Fix auth; ensure exactly 3 user-specific concepts | P0 |
| `/projects/:id/foundation` | Foundation/readiness/lock | Partial | Mock fallback in dev | Readiness stuck 0% under auth failure; generator still stub-heavy | Not verified | Not verified | "Buat Usulan Fondasi" clear | Fix auth then real foundation generator | P0 |
| `/projects/:id/outline` | 10 chapter outline | Partial | Mock fallback in dev | Generator still deterministic-heavy | Not verified | Not verified | OK | Real outline generator from locked foundation | P0 |
| `/projects/:id/write` | Write room | Implemented but preconditioned | Mock fallback in dev | Shows locked/error if API fails or outline not locked | `WriterMobileLayout.tsx` exists but not browser-verified | Desktop 3-pane likely OK but not visual verified | "Ruang Tulis belum tersedia" is honest if outline not locked | Prepare test project to `outline_locked`; fix auth | P0 |
| `/projects/:id/summary` | Summary/delta | Implemented | Mock fallback in dev | Not in failed list | Not verified | Not verified | OK | Include in regression after write flow | P2 |
| `/projects/:id/publish` | Publish package | Implemented | Mock fallback in dev | Not in failed list | Not verified | Not verified | OK | Include in regression after summary flow | P2 |
| `/settings` | Usage/quality mode | Likely fixed | Mock mode supported | Previously reload reset; code now persists local/API | Not verified | Not verified | Cost estimate now numeric | Rerun `auth-settings-regression.spec.ts` | P1 |
| `/credits/topup` | Credit packages | Partial/gated | Mock mode intentionally disables checkout | Payment/topup disabled in safe modes | Not verified | Not verified | Explains mode API | Keep disabled until payment approval | P2 |
| Draft import route | Existing draft analysis | Missing | N/A | No route/page | N/A | N/A | N/A | Do not test as available; plan future sprint | P1 |

## User-flow issue interpretation

| Observed E2E issue | Likely true cause after code audit |
|---|---|
| `API tidak tersedia (Invalid or expired access token)` | API auth middleware rejecting Supabase JWT. Fix token/session/env before debugging downstream AI. |
| Concept/foundation/write no data | Cascades from auth rejection; foundation/outline also have real-generation gap. |
| Logout still shows dashboard | Code has guard, but production/browser storage may not clear or app may be in mock mode. Needs E2E verification. |
| Quality mode reloads as Seimbang | Current code appears to persist via localStorage/API. Needs rerun. |
| Credit estimate stuck loading | Current settings component renders numeric costs; loading text may come from API/session failure. |
| Draft import panels empty | Feature missing/deferred, not just auth. |
| Ruang Tulis mobile unavailable | Likely outline-not-locked or API auth, not a mobile-only UI bug. |

## Technical leakage/copy audit

- Normal UI uses labels Hemat/Seimbang/Terbaik, not raw model IDs (`apps/web/src/services/ai.ts`).
- `CreditTopupPage` intentionally mentions `VITE_USE_MOCKS=false` in mock mode; this is technical copy visible to users if mock mode is exposed. Acceptable for local/dev, not for production.
- No inspected route should expose OpenRouter key or service role.

## Mobile/desktop note

This audit did not run visual Playwright screenshots. `WriterMobileLayout.tsx` exists, but mobile readability must be verified after auth and write-room preconditions are fixed.
