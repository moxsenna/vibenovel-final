# Task 11.2 — Hosted Supabase Staging + Portable Staging Smoke Harness

**Date:** 2026-06-09  
**Status:** Closed — PARTIAL GO  
**Agent:** Cursor (Task 11.2)

## Task goal

Enable staging beyond shell/health with portable cloud-agnostic smoke harness (`-ApiBaseUrl`, `-WebBaseUrl`). Configure hosted Supabase staging if operator credentials available.

## Files read

- `docs/63`, `docs/62`, `docs/61`, `docs/60`, `docs/36`, `docs/53`
- `README.md`, `apps/api/wrangler.toml`, `apps/api/src/env.ts`, `apps/api/README.md`
- `apps/web/.env.example`, `package.json`
- `scripts/staging-health-smoke.ps1`, `scripts/sprint10-smoke-web.ps1`, `scripts/sprint2-smoke-api.ps1`, `scripts/smoke-all-local.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `scripts/lib/staging-smoke-common.ps1` | Created — shared staging smoke helpers |
| `scripts/smoke-staging.ps1` | Created — portable orchestrator |
| `scripts/staging-health-smoke.ps1` | Updated — common lib + defaults |
| `scripts/sprint2-smoke-api.ps1` | Updated — staging anon key + remote URL guard |
| `scripts/sprint10-smoke-web.ps1` | Updated — `-StagingMode` + staging Supabase |
| `package.json` | Added `smoke:staging` |
| `apps/web/.env.example` | Staging smoke env notes |
| `docs/64-staging-smoke-harness-and-supabase-report.md` | Created |
| `README.md`, `docs/36`, `docs/60`, `docs/62`, `docs/63`, `scripts/README.md`, `apps/api/README.md` | Updated |

## Commands run

```powershell
npm run typecheck
npm run build:shared
npm run build:api
npm run build:web
npm run smoke:staging:health
npm run smoke:staging
npm run smoke:api
npm run smoke:all:local
Invoke-RestMethod https://vibenovel-api-staging.moxsenna.workers.dev/api/health
```

## Results

| Command | Result |
|---|---|
| typecheck | PASS |
| build:shared/api/web | PASS |
| smoke:staging:health | PASS (Mode A flags) |
| smoke:staging | PARTIAL GO — phases A–C PASS; D BLOCKED (no Supabase) |
| smoke:api | PASS 17/17 |
| smoke:all:local | PASS 14/14 |
| Worker Supabase secrets | NOT SET (operator credentials unavailable) |
| Web Supabase rebuild | NOT RUN |

## Decisions

1. **PARTIAL GO** — implement harness without faking Supabase secrets.
2. Shared `staging-smoke-common.ps1` instead of modifying all 15+ smoke scripts — sprint2 + sprint10 updated for staging path; orchestrator delegates to them.
3. Default Cloudflare URLs in common lib only — all overrideable for AWS/VPS.
4. No `wrangler secret put`, no migration push, no web redeploy — operator gate documented in docs/64.

## Limitations

- Hosted Supabase staging not configured in this session.
- Full API-mode staging smoke blocked until Task 11.2b (operator).
- Mode B payment not run.
- AWS deploy explicitly out of scope.

## Next recommended task

**Task 11.2b (operator)** — Supabase staging + Worker secrets + web rebuild + `smoke:staging -IncludeApiMode`.

**Or Task 11.3** — AWS Staging Readiness plan (per roadmap).

---

## Re-verification (same session, 2026-06-09)

Task 11.2 artifacts were already present; this pass re-ran acceptance regressions.

### Commands run (re-verification)

```powershell
Set-Location D:\Coding\vibenovel-unified-blueprint
npm run typecheck
npm run build:shared; npm run build:api; npm run build:web
npm run smoke:staging:health
npm run smoke:staging
npm run smoke:api
npm run smoke:all:local
curl.exe -s https://vibenovel-api-staging.moxsenna.workers.dev/api/health
```

### Results (re-verification)

| Command | Result |
|---|---|
| typecheck | PASS |
| build:shared/api/web | PASS |
| smoke:staging:health | PASS (5/5 Mode A flags) |
| smoke:staging | PARTIAL GO — A/B/C PASS; D BLOCKED (no STAGING_SUPABASE_*) |
| smoke:api | PASS 17/17 |
| smoke:all:local | PASS 14/14 (~1.3m) |
| STAGING_SUPABASE_URL env | not set |
| STAGING_SUPABASE_ANON_KEY env | not set |
| Worker Supabase secrets | NOT SET (operator gate unchanged) |

**Verdict unchanged: PARTIAL GO.**