# Task 2.15 — Automated Smoke Test & CI Hygiene

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Merapikan smoke test Sprint 2 agar reproducible oleh manusia/AI agent: script parameterized, dokumentasi, root `npm run smoke:api`, optional GitHub Actions CI tanpa secrets.

## Files read

- `README.md`
- `docs/29-sprint-2-verification-report.md`
- `scripts/sprint2-smoke-api.ps1`
- `apps/api/README.md`
- `supabase/README.md`
- `.agent-logs/sprint-2/` (task 2.1–2.14)
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `scripts/sprint2-smoke-api.ps1` | Refactored — params, header, PASS/FAIL, no hardcoded anon key, no full JWT |
| `scripts/README.md` | Rewritten — prerequisites, usage, limitations |
| `package.json` | Added `smoke:api` script |
| `.github/workflows/ci.yml` | Created — typecheck + build (no secrets) |
| `docs/29-sprint-2-verification-report.md` | Updated — smoke:api + CI note |
| `README.md` | Added `npm run smoke:api` + task 2.15 row |
| `.agent-logs/sprint-2/task-2.15-automated-smoke-test-ci-hygiene.md` | Created (log ini) |

**Tidak diubah:** API source, web source, migrations, seed, UI.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 steps |
| GitHub Actions live run | tidak dijalankan (workflow draft only) |
| `git push` / deploy | tidak dijalankan |

## Results

- Smoke script: parameterized `ApiBaseUrl`, `SupabaseUrl`, `SupabaseAnonKey`, `TestEmail`, `TestPassword`, `SeedProjectId`
- Anon key resolved from `SUPABASE_ANON_KEY` or `supabase status -o env` — removed hardcoded JWT from script
- Output: `[PASS]`/`[FAIL]` per step + summary; exit 1 on failure
- Root: `npm run smoke:api` (Windows/PowerShell)
- CI: `.github/workflows/ci.yml` — checkout, Node 20, `npm ci`, typecheck, build shared/web/api
- No secrets in workflow; API smoke not in CI (Docker/Supabase local required)

## Decisions

1. **Windows-first** — `smoke:api` uses PowerShell; documented in scripts/README
2. **No anon key in repo** — auto-detect via CLI/env; fail fast with clear message
3. **CI scope minimal** — build-only until Supabase service container is planned
4. **Sanitize output** — `Get-SafeDetail` redacts JWT-like strings; signup logs email only

## Limitations

- `npm run smoke:api` tidak cross-platform (PowerShell)
- CI tidak menjalankan `smoke:api` atau `supabase db reset`
- GET failure tests show generic PowerShell message for some 401/404 (still PASS)
- Smoke creates ephemeral users/projects without cleanup

## Next recommended task

**Sprint 3 — Story Foundation Flow** (Intake + Concept + Foundation Real) per `docs/17` / `docs/29`.