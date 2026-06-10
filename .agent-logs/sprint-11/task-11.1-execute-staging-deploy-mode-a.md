# Task 11.1 — Execute Staging Deploy Mode A

## Task goal

Deploy VibeNovel staging in Mode A safe default: API Cloudflare Worker + Web Cloudflare Pages. Verify health, web load, CORS, safe flags only. No payment sandbox, no production.

## Files read

- `docs/60-sprint-11-staging-deploy-and-public-callback-plan.md`
- `docs/59-duitku-sandbox-live-smoke-report.md`
- `docs/58-duitku-callback-idempotent-grant-report.md`
- `docs/53-sprint-10-verification-report.md`
- `docs/52-sprint-10-payment-ops-and-safety-regression.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `.agent-logs/sprint-11/task-11.0-staging-deploy-public-callback-preparation.md`
- `apps/api/wrangler.toml`
- `apps/api/src/env.ts`
- `apps/api/package.json`
- `apps/web/.env.example`
- `apps/web/package.json`
- `package.json`
- `scripts/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `docs/62-staging-deploy-mode-a-report.md` | **Created** — deploy report (renamed from docs/61 in Task 11.0b) |
| `.agent-logs/sprint-11/task-11.1-execute-staging-deploy-mode-a.md` | **Created** — this log |
| `apps/api/wrangler.toml` | `[env.staging]` Mode A vars |
| `apps/api/package.json` | `deploy:staging` script |
| `apps/web/public/_redirects` | SPA fallback for Pages |
| `package.json` | `deploy:api:staging`, `deploy:web:staging`, `smoke:staging:health` |
| `scripts/staging-health-smoke.ps1` | **Created** — Mode A health smoke |
| `README.md`, `docs/60`, `docs/36`, `scripts/README.md`, `apps/api/README.md`, `apps/web/.env.example` | Updated |

## Commands run

```text
npx wrangler whoami
npm run typecheck
npm run build:shared
npm run build:api
npm run build:web
npx wrangler secret list --env staging  (worker not exist yet — before deploy)
npm run deploy:api:staging
curl.exe -s https://vibenovel-api-staging.moxsenna.workers.dev/api/health
npm run smoke:staging:health -- -ApiBaseUrl https://vibenovel-api-staging.moxsenna.workers.dev
set VITE_API_URL=... && set VITE_USE_MOCKS=false && npm run build:web
npx wrangler pages project create vibenovel-web-staging --production-branch main
npx wrangler pages deploy apps/web/dist --project-name vibenovel-web-staging --branch main --commit-dirty=true
curl.exe -sI https://vibenovel-web-staging.pages.dev/
curl.exe -sI https://vibenovel-web-staging.pages.dev/credits/topup
curl.exe -sI -H Origin:https://vibenovel-web-staging.pages.dev https://vibenovel-api-staging.moxsenna.workers.dev/api/health
```

Not run:

- `wrangler secret put` — no hosted Supabase staging credentials available in session
- `smoke:web:topup -IncludeApiMode` against staging — would use local Supabase
- `smoke:all:local` — not required (config/scripts changed; typecheck/build sufficient)
- Payment live smokes — Mode A policy

## Results

### Pre-deploy audit

- `[env.staging]` missing → added
- No `_redirects` → added
- Cloudflare OAuth: logged in (account moxsenna@gmail.com)
- Hosted Supabase staging: not configured

### API deploy

- **SUCCESS** — `https://vibenovel-api-staging.moxsenna.workers.dev`
- Health Mode A: PASS (`appEnv=staging`, `creditTopupEnabled=false`, `paymentProviderMock=true`, `paymentProvider=mock`, `aiGenerationEnabled=false`)
- `hasSupabaseUrl=false` (secrets not set)

### Web deploy

- **SUCCESS** — `https://vibenovel-web-staging.pages.dev`
- Root + `/credits/topup`: HTTP 200
- `_redirects` uploaded

### CORS

- `Access-Control-Allow-Origin: https://vibenovel-web-staging.pages.dev` — PASS

### Secrets

- SUPABASE_* not set — operator action required
- No payment/AI secrets — correct Mode A

### Go/No-Go

**GO Mode A** for deploy shell. **PARTIAL** for auth/full API smoke until hosted Supabase.

## Decisions

1. Set `ALLOWED_ORIGINS` to `https://vibenovel-web-staging.pages.dev` before Pages deploy (predictable Pages URL).
2. Deploy API without Supabase secrets — health works; data routes blocked until secrets set.
3. Build web with staging `VITE_API_URL` only; skip Supabase env until hosted project exists.
4. Did not run staging web Playwright smoke — local Supabase coupling would be misleading.
5. Production Worker/Pages not touched.

## Limitations

- Hosted Supabase staging not provisioned
- Worker secrets not set
- Web rebuild needed after Supabase staging available
- Full auth/project/topup API-mode smoke deferred to 11.2

## Next recommended task

**Task 11.2** — staging smoke harness + operator Supabase staging secrets + web rebuild with `VITE_SUPABASE_*`.