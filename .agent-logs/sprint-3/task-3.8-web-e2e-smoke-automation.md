# Task 3.8 — Web E2E Smoke Automation

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Add lightweight, reusable web E2E smoke for Sprint 3 flow (intake → concepts → foundation) before Sprint 4. Testing/hygiene only — no product features, no CI browser setup yet.

## Files read

- `README.md`
- `docs/31-sprint-3-verification-report.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `scripts/README.md`
- `scripts/sprint2-smoke-api.ps1`
- `apps/web/src/pages/IntakePage.tsx`, `ConceptsPage.tsx`, `FoundationPage.tsx`
- `apps/web/src/components/foundation/FoundationProposalsPanel.tsx`
- `apps/web/src/context/AuthContext.tsx`
- `apps/web/src/lib/api.ts`, `env.ts`
- `.agents/rules/09-agent-work-logs.md`
- Related hooks/components for Playwright selectors

## Files created/changed

| Path | Note |
|---|---|
| `apps/web/playwright.config.ts` | Playwright config, base URL via `SMOKE_WEB_BASE_URL` |
| `apps/web/e2e/sprint3-flow.spec.ts` | Mock + API mode browser tests |
| `apps/web/package.json` | `@playwright/test`, `test:e2e`, `test:e2e:sprint3` |
| `scripts/sprint3-smoke-web.ps1` | Orchestrator: preflight, mock/API Playwright |
| `scripts/sprint3-smoke-web-manual-checklist.md` | Manual API-mode fallback checklist |
| `scripts/README.md` | Sprint 3 web smoke section |
| `package.json` | `smoke:web` root script |
| `README.md` | Command list, scripts status, Task 3.8 row |
| `docs/31-sprint-3-verification-report.md` | Task 3.8 deliverables, web smoke status |
| `.gitignore` | Playwright artifacts (`test-results/`, etc.) |
| `apps/web/.env.local` | Created locally for API-mode verification only (gitignored, not committed) |

## Commands run

| Command | Result |
|---|---|
| `npm install` | PASS — added `@playwright/test` |
| `npx playwright install chromium` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run dev:web` | Running (background) for smoke |
| `npm run smoke:web` | PASS — mock 3/3 Playwright, API NOT RUN (default) |
| `npm run smoke:web -- -IncludeApiMode -SkipMockMode` | PASS — API Playwright 4/4 (with local `.env.local` + `VITE_USE_MOCKS=false`) |

## Results

### Approach

**Playwright** (devDependency in `apps/web`) + **PowerShell orchestrator** (`scripts/sprint3-smoke-web.ps1`), mirroring Task 2.15 `smoke:api` pattern.

### Smoke coverage

| Mode | Automated | Coverage |
|---|---|---|
| **Mock** | `npm run smoke:web` | `/projects/demo-project-001/intake`, `/concepts`, `/foundation` — not blank; mock markers visible |
| **API** | `npm run smoke:web -- -IncludeApiMode` | DevAuth login → intake message + agent reply → generate/select concept → foundation proposals → accept safe → lock or readiness message |
| **API manual** | Checklist doc | When automation not run or env incomplete |

### Web smoke outcomes (this session)

- **Mock-mode:** PASS (3 Playwright tests)
- **API-mode (default `smoke:web`):** NOT RUN (by design — requires `-IncludeApiMode`)
- **API-mode (`-IncludeApiMode`):** PASS after local `apps/web/.env.local` with `VITE_USE_MOCKS=false` and Supabase/API running

## Decisions

1. **Playwright over HTTP-only** — SPA needs JS render; Playwright is small scoped devDependency.
2. **PowerShell wrapper** — consistent with `smoke:api`; checks dev server, optional API preflight (signup + project create).
3. **API mode opt-in** — default `smoke:web` is mock-only; honest `NOT RUN` for API without flag.
4. **No GitHub Actions web E2E** — documented deferred (browser + Supabase + dual env).
5. **Hoisted Playwright path** — script checks root `node_modules` when workspace-local missing.
6. **Selectors** — role/heading scoped to `main`; wait for loading spinners hidden.

## Limitations

- Windows-first `npm run smoke:web` (PowerShell).
- First run needs `npx playwright install chromium` in `apps/web`.
- API mode requires `VITE_USE_MOCKS=false` + Supabase env in `apps/web/.env.local` and **restart** `dev:web`.
- Mock and API modes cannot share one dev-server env without restart.
- DevAuthPanel dev-only; no production E2E.
- Does not cover outline/write/summary/publish pages.
- CI web E2E not added.

## Next recommended task

**Sprint 4 — Outline Planning Engine** (per roadmap). Optional: extend `smoke:api` with Sprint 3 API endpoints regression.