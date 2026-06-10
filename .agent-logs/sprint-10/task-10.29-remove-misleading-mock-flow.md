# Task 10.29 — Remove Misleading Mock Flow and Build Real Post-Intake Workflow Map

## Task goal

Stop authenticated production app from silently showing Sprint 1 mock data as real user project state. Replace with honest workflow-derived statuses, locked states, and explicit demo-only labeling when `VITE_USE_MOCKS=true`.

## Files read

- `docs/90-ai-founder-test-mode-report.md`, `docs/89-full-repo-audit-vs-sprint-plan.md`, `docs/88-founder-private-beta-story-smoke-report.md`, `docs/87-real-private-beta-story-flow-report.md`, `docs/86-private-beta-launch-readiness-audit.md`
- `README.md`, `docs/36`, `docs/63`
- `apps/web/src/hooks/*Data.ts`, `useWriteRoomData.ts`, `useActiveProject.ts`
- `apps/web/src/lib/api-mappers.ts`, `apps/web/src/utils/navigation.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `apps/web/src/lib/workflow-truth.ts` | Honest progress steps, nav locks, intake stub label |
| `apps/web/src/lib/empty-states.ts` | Empty API/foundation/chapter shells |
| `apps/web/src/lib/hook-fallback.ts` | Shared API error helper |
| `apps/web/src/lib/env.ts` | `allowMockFallback()` guard |
| `apps/web/src/components/common/WorkflowLockedState.tsx` | Locked/empty UI |
| `apps/web/src/lib/api-mappers.ts` | Dashboard progress from `workflowPhase`; honest mapper empty states |
| `apps/web/src/utils/navigation.ts` | Sidebar locks by workflow phase |
| `apps/web/src/components/layout/NavItem.tsx`, `Sidebar.tsx` | Lock hints |
| `apps/web/src/hooks/use*Data.ts` (10 hooks) | Remove production `api-fallback` → `locked`/`error`/`mock` |
| `apps/web/src/pages/WritePage.tsx`, `SummaryPage.tsx`, `PublishPage.tsx` | Locked state rendering |
| `docs/91-remove-misleading-mock-flow-report.md` | Closure report |
| `README.md`, `docs/36`, `docs/63`, `docs/87`, `docs/88`, `docs/89`, `docs/90` | Status cross-links |

## Commands run

```powershell
npm run typecheck --workspace=apps/web
npm run build:web:production
npm run deploy:web:production
Invoke-WebRequest https://narraza.web.id
Invoke-WebRequest https://app.narraza.web.id
Invoke-RestMethod https://api.narraza.web.id/health
Invoke-RestMethod https://api-staging.narraza.web.id/api/health
# bundle grep: index-DmFC9e-5.js — no "Menampilkan mock Sprint 1", no staging supabase ref
```

## Results

| Check | Result |
|---|---|
| `tsc --noEmit` (web) | PASS |
| Production web build | PASS — `index-DmFC9e-5.js` |
| Cloudflare Pages deploy | PASS — `narraza-web-production` |
| Homepage 200 | PASS |
| App 200 | PASS |
| API prod health | PASS — `aiGenerationEnabled=true`, `creditTopupEnabled=false`, `paymentProviderMock=true` |
| Staging health | PASS |
| Bundle: no `Menampilkan mock Sprint 1` | PASS |
| Bundle: no staging API URL | PASS |
| Payment enabled | OFF (unchanged) |
| Migration 00010 | NOT applied (unchanged) |

## Decisions

1. **`allowMockFallback()`** — mock Sprint 1 data only when `VITE_USE_MOCKS=true` (dev/demo). Production build sets `VITE_USE_MOCKS=false`.
2. **Dashboard progress** — derived from `project.workflowPhase` + `currentChapter`, not hardcoded “Fondasi selesai / Outline siap”.
3. **Write room** — outline not locked → `WorkflowLockedState`, not mock chapter draft.
4. **Intake** — real persistence kept; assistant labeled “Balasan awal otomatis…”
5. **Sidebar** — Foundation/Outline/Write/Publish disabled until workflow phase allows; Publish always locked in beta.
6. **Data source types** — replaced `api-fallback` with `locked` | `error` | `mock` | `api`.

## Limitations

- Mock module strings still ship in bundle (tree-shake incomplete) but are not activated in authenticated production flow.
- `CreditIndicator` shell still shows mock 1.250 credits (pre-existing debt).
- Full concept/foundation/outline LLM generators not built — routes show real API data when present, honest empty/locked otherwise.
- Publish nav locked entirely in beta (by design).

## Next recommended task

**10.30** — Wire shell `CreditIndicator` to real credit API; align sidebar active project with route project ID. Then **10.31** — real concept/foundation/outline generator wiring when backend templates/LLM paths are approved.