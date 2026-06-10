# Task 10.29 — Remove Misleading Mock Flow and Build Real Post-Intake Workflow Map

**Date:** 2026-06-10  
**Status:** **GO**  
**Bundle:** `index-DmFC9e-5.js` on `https://app.narraza.web.id`  
**Related:** [`docs/87`](87-real-private-beta-story-flow-report.md), [`docs/88`](88-founder-private-beta-story-smoke-report.md), [`docs/89`](89-full-repo-audit-vs-sprint-plan.md), [`docs/90`](90-ai-founder-test-mode-report.md), [`.agent-logs/sprint-10/task-10.29-remove-misleading-mock-flow.md`](../.agent-logs/sprint-10/task-10.29-remove-misleading-mock-flow.md)

> Note: [`docs/91-founder-browser-e2e-story-workflow-report.md`](91-founder-browser-e2e-story-workflow-report.md) covers the earlier founder browser AI E2E sub-task. This report covers **mock-removal + honest workflow map**.

---

## Summary

Authenticated production no longer silently falls back to Sprint 1 mock pages when API preconditions fail. Dashboard progress reflects `workflowPhase`. Write/Summary/Publish show locked or error states instead of fake scenes, validators, and completed steps. Intake persistence unchanged; assistant replies labeled as stub. Payment OFF, migration 00010 not applied, no secrets exposed.

---

## Before / After (founder-visible)

| Area | Before | After |
|---|---|---|
| Dashboard progress | Always “Fondasi cerita selesai”, “Outline siap”, “Bab N sedang ditulis” | Steps from `workflowPhase`: “Intake berjalan”, “Fondasi belum dibuat”, “Outline belum dikunci”, etc. |
| Write room (no locked outline) | Banner + full mock Sprint 1 scenes/validator/AI panel | `WorkflowLockedState`: “Ruang Tulis belum tersedia — outline real belum dibuat/dikunci” |
| API failure (authed) | “Menampilkan mock Sprint 1” + demo data | Error notice + empty/locked UI; no fake project state |
| Intake assistant | “Balasan dari server (stub)” | “Balasan awal otomatis. AI penuh belum aktif untuk tahap ini.” |
| Sidebar post-intake nav | Enabled whenever project exists | Locked until phase: foundation → outline → write; publish locked in beta |
| Dev demo (`VITE_USE_MOCKS=true`) | Unlabeled mock | `DEMO_MODE_LABEL` on dashboard and hooks |

---

## Mock audit

| File | Route/Feature | Mock Type | Production Risk | Action |
|---|---|---|---|---|
| `api-mappers.ts` `buildProgressSteps` | Dashboard | Hardcoded “selesai/siap” | **Misleading** | **Fixed** — `buildHonestProgressSteps(workflowPhase)` |
| `useWriteRoomData.ts` `applyMock` | Write | Sprint 1 chapter fallback | **Misleading** | **Fixed** — `applyBlocked` locked/error |
| `useSummaryData.ts` | Summary | Mock chapter summary fallback | **Misleading** | **Fixed** — locked/error |
| `usePublishData.ts` | Publish | Mock publish package fallback | **Misleading** | **Fixed** — locked/error |
| `useFoundationData/Flow.ts` | Foundation | Mock foundation on API fail | **Misleading** | **Fixed** — empty API shell or error |
| `useOutlineData.ts` | Outline | Mock outline on API fail | **Misleading** | **Fixed** — empty bundle or error |
| `useConceptsData.ts` | Concepts | Mock concepts on API fail | **Misleading** | **Fixed** — `[]` or error |
| `useIntakeData.ts` | Intake | Mock session on API fail | **Misleading** | **Fixed** — empty session or error |
| `useDashboardData.ts` | Dashboard | Mock usage on API fail | Partial | **Fixed** — zero usage unless demo mode |
| `useSettingsData.ts` | Settings | Mock settings on fail | Partial | **Fixed** — real profile/credits when possible |
| `mapFoundationBundleToUi` | Foundation | Fill empty fields from mock | **Misleading** | **Fixed** — “Belum diisi” in API mode |
| `mapIntakeBundleToUi` | Intake | Empty → mock messages | **Misleading** | **Fixed** — empty arrays in API mode |
| `mocks/*.ts` | Dev only | Sprint 1 demo data | Safe in dev | **Guarded** — `allowMockFallback()` only |
| `CreditIndicator.tsx` | Shell | Hardcoded 1.250 | Display-only debt | **Deferred** → Task 10.30 |
| `useActiveProject.ts` | Sidebar | Demo project in mock mode | Safe | Unchanged — demo only when `useMocks` |

---

## Route truth model

| Route | Status |
|---|---|
| `/dashboard` | **REAL PARTIAL** — projects/credits from API; honest workflow progress |
| `/start` | **REAL READY** — project creation |
| `/projects/:id/intake` | **REAL PARTIAL** — messages persist; assistant **STUB HONEST** |
| `/projects/:id/concepts` | **REAL PARTIAL** — API list/generate when called; empty state honest |
| `/projects/:id/foundation` | **REAL PARTIAL** — API bundle; empty fields labeled; proposals API |
| `/projects/:id/outline` | **REAL PARTIAL** — API bundle; generate/lock when foundation locked |
| `/projects/:id/write` | **LOCKED UNTIL PREVIOUS STEP** unless outline locked; then **REAL READY** (incl. founder AI test) |
| `/projects/:id/summary` | **LOCKED UNTIL PREVIOUS STEP** — needs chapter + write progress |
| `/projects/:id/publish` | **LOCKED UNTIL PREVIOUS STEP** — beta locked in nav; empty shell when no package |
| `/settings` | **REAL PARTIAL** — profile/credits real; per-project settings need active project |

---

## Changes made

- **dashboard:** `buildHonestProgressSteps`, honest recent card labels/routes
- **sidebar:** `resolveNavLocks(workflowPhase)` + lock hints on disabled items
- **intake:** stub assistant label; no mock messages on API empty state
- **concepts:** empty list + generate CTA; no silent mock cards on error
- **foundation:** honest empty fields; no mock characters/facts fill-in
- **outline:** honest empty plan copy; no mock arc on API error
- **write:** `WorkflowLockedState` when outline not locked; no mock beats/validator
- **summary:** locked when no outline chapter; honest empty synopsis shell when API ok but no summary
- **publish:** locked when no chapter; honest empty package shell when summary not approved
- **API fallback:** `allowMockFallback()` — production never loads Sprint 1 as user data

---

## Production verification

| Check | Result |
|---|---|
| Homepage `https://narraza.web.id` | 200 |
| App `https://app.narraza.web.id` | 200 |
| API `https://api.narraza.web.id/health` | PASS — `aiGenerationEnabled=true`, `creditTopupEnabled=false`, `paymentProviderMock=true` |
| Staging `https://api-staging.narraza.web.id/api/health` | PASS |
| Bundle `index-DmFC9e-5.js` | No `Menampilkan mock Sprint 1`; no staging API URL |
| Payment | OFF |
| Migration 00010 | NOT applied |
| Intake persistence | Unchanged (API path preserved) |

---

## Remaining honest stubs

- Intake agent replies — template/stub from API (labeled)
- Concept/foundation/outline generators — deterministic/API templates where wired; not full public LLM launch
- Shell credit badge — mock 1.250 until Task 10.30
- Publish — nav locked in private beta
- Mock strings still in JS bundle (inactive in production authed flow)

---

## Next recommended task

1. **10.30** — Real credit indicator + sidebar/route project alignment  
2. **10.31** — Wire real concept → foundation → outline generation pipeline (founder-approved scope)  
3. Re-run founder browser smoke on production after login to confirm locked write/foundation/outline for intake-only projects

---

## Files changed

`apps/web/src/lib/{workflow-truth,empty-states,hook-fallback,env,api-mappers}.ts`, `apps/web/src/components/common/WorkflowLockedState.tsx`, `apps/web/src/utils/navigation.ts`, `apps/web/src/components/layout/{NavItem,Sidebar}.tsx`, `apps/web/src/hooks/use{Dashboard,Intake,Concepts,Foundation,FoundationFlow,Outline,WriteRoom,Summary,Publish,Settings}*.ts`, `apps/web/src/pages/{Write,Summary,Publish}Page.tsx`, docs/README updates.

## Docs updated

`README.md`, `docs/36`, `docs/63`, `docs/87`, `docs/88`, `docs/89`, `docs/90`, this report.