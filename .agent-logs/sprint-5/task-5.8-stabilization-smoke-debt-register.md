# Task 5.8 — Stabilization, Smoke Consolidation & Technical Debt Register

## Task goal

Consolidate non-blocking debt documentation, clarify npm smoke commands, add local smoke suite runner, and provide pre-Sprint 6 verification checklist. No product/API/UI/schema changes.

## Files read

- `README.md`
- `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`
- `docs/33-sprint-4-verification-report.md`
- `docs/35-sprint-5-verification-report.md`
- `scripts/README.md`
- `scripts/sprint2-smoke-api.ps1`
- `scripts/sprint3-smoke-web.ps1`
- `scripts/sprint4-smoke-api.ps1`
- `scripts/sprint4-smoke-web.ps1`
- `scripts/sprint5-smoke-api.ps1`
- `scripts/sprint5-smoke-web.ps1`
- `package.json`
- `.github/workflows/ci.yml`
- `.agent-logs/sprint-5/`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | **Created** — debt register |
| `scripts/smoke-all-local.ps1` | **Created** — local smoke suite orchestrator |
| `package.json` | Added `smoke:api:base`, `smoke:api:sprint5`, `smoke:all:local`, `smoke:all:local:full` |
| `scripts/README.md` | Smoke index, prerequisites, troubleshooting, CI note |
| `README.md` | Verification checklist, docs/36 link, Task 5.8 row |
| `.github/workflows/ci.yml` | Comment only — local smoke remains out of CI |
| `.agent-logs/sprint-5/task-5.8-stabilization-smoke-debt-register.md` | **Created** (this log) |

No application source, migration, or API/UI behavior changes.

## Commands run

```bash
npm run typecheck
npm run build:shared
npm run build:web
npm run build:api
npm run smoke:api
npm run smoke:api:sprint5
npm run smoke:web
npm run smoke:web:outline
npm run smoke:web:write
```

## Results

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run smoke:api` | **PASS** — 17/17 |
| `npm run smoke:api:sprint5` | **PASS** — 49/49 |
| `npm run smoke:web` | **PASS** — mock 3/3 |
| `npm run smoke:web:outline` | **PASS** — mock |
| `npm run smoke:web:write` | **PASS** — mock |
| `npm run smoke:all:local` | **NOT RUN** — component smokes verified individually |
| `npm run smoke:all:local:full` | **NOT RUN** — requires `VITE_USE_MOCKS=false` + dev:web restart |

## Decisions

- `smoke:api` unchanged — still Sprint 2 regression for backward compatibility / CI docs.
- `smoke:api:base` explicit alias to same script.
- `smoke:all:local:full` documented; runs web scripts with `-IncludeApiMode`.
- CI left as typecheck/build only — no Docker/Supabase in GitHub Actions.
- `sprint4-smoke-api.ps1` documented as optional manual script, not wired to npm (avoid scope creep).

## Limitations

- `smoke:all:local` not run end-to-end in this session (long aggregate); component smokes run individually.
- API-mode full suite not re-run (env switch discipline).
- PowerShell-first; no bash port.

## Next recommended task

**Sprint 6** — Chapter Summary, Chapter Delta & Canon Proposal Flow.