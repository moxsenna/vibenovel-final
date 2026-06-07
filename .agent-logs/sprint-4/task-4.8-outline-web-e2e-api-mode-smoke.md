# Task 4.8 — Outline Web E2E API-mode Smoke Automation

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Menambahkan Playwright smoke test untuk `/projects/:id/outline` di mock mode dan API mode, dengan orchestrator script terpisah — testing/hygiene only, tanpa fitur produk baru.

## Files read

- `README.md`
- `docs/33-sprint-4-verification-report.md`
- `scripts/sprint4-smoke-api.ps1`
- `scripts/sprint3-smoke-web.ps1`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/sprint3-flow.spec.ts`
- `apps/web/src/pages/OutlinePage.tsx`
- `apps/web/src/hooks/useOutlineData.ts`
- `apps/web/src/services/outline.ts`
- `apps/web/src/components/outline/OutlineWorkflowActions.tsx`
- `apps/web/src/components/outline/OutlineTrackingPanels.tsx`
- `apps/web/src/components/outline/OutlineChapterEditor.tsx`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/web/e2e/sprint4-outline-flow.spec.ts` | Created — mock + API mode Playwright |
| `scripts/sprint4-smoke-web.ps1` | Created — orchestrator dengan `-IncludeApiMode` |
| `package.json` | Updated — `smoke:web:outline` script |
| `apps/web/package.json` | Updated — `test:e2e:sprint4` |
| `apps/web/.env.example` | Updated — mention Task 4.8 |
| `apps/web/src/hooks/useOutlineData.ts` | Fixed — `setSource("api")` after generate (bug dari E2E) |
| `scripts/README.md` | Updated — Sprint 4 outline web smoke section |
| `docs/33-sprint-4-verification-report.md` | Updated — web runtime PASS Task 4.8 |
| `README.md` | Updated — Task 4.8 + command list |
| `.agent-logs/sprint-4/task-4.8-outline-web-e2e-api-mode-smoke.md` | Created (log ini) |

**Tidak diubah:** `smoke:web` (Sprint 3), API routes, migration, CI workflow.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:web` | PASS — 3 mock, API NOT RUN (unchanged) |
| `npm run smoke:web:outline` | PASS — mock 1/1 |
| `npm run smoke:web:outline -- -IncludeApiMode` | PASS — mock + API 9/9 |

## Results

### Approach

- **Mock mode:** Playwright langsung ke `demo-project-001/outline` — assert mock markers + no `planningTruth` in DOM.
- **API mode:** Script bootstrap foundation locked via API (pola `sprint4-smoke-api.ps1`), lalu Playwright DevAuth login → outline generate → edit → approve → lock.
- **Grep filter:** Mock/API runs terpisah di orchestrator (`--grep`) agar tidak double-run.

### Smoke coverage

| Mode | Coverage |
|---|---|
| Mock | Page not blank; `Bab 1–10: Awal Konflik`, `Makan Malam yang Dingin`; DOM redaction |
| API | Generate 10 bab; tracking panels; chapter edit; approve/lock; locked badge; editor disabled; DOM redaction |

### Bug fix dari E2E

`useOutlineData.generateOutlinePlan` tidak set `source="api"` setelah generate sukses → `hasApiOutline` false → tracking panels tidak render. Diperbaiki dengan `setSource("api")` + `setNotice(null)` setelah `applyBundle`.

## Decisions

1. **Script terpisah `sprint4-smoke-web.ps1`** — tidak mengubah `sprint3-smoke-web.ps1`.
2. **API bootstrap via PowerShell** — lebih cepat dan stabil daripada full browser upstream flow.
3. **CI deferred** — dokumentasi eksplisit; butuh browser + Supabase + dual env.

## Limitations

- GitHub Actions belum menjalankan outline API-mode E2E.
- Mock/API mode butuh `VITE_USE_MOCKS` berbeda — restart `dev:web` saat switch.
- Tidak test write/summary/publish.
- DevAuthPanel dev-only.

## Next recommended task

**Sprint 5 — Safe Write Room & Context Packet** (primary per roadmap).