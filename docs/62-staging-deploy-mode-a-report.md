# 62 — Staging Deploy Mode A Report (Task 11.1)

**Date:** 2026-06-09  
**Status:** Closed — **GO Mode A** (deploy + health + web shell); **PARTIAL** (hosted Supabase secrets not set)  
**Related:** [`docs/60`](60-sprint-11-staging-deploy-and-public-callback-plan.md), [`docs/64`](64-staging-smoke-harness-and-supabase-report.md) (Task 11.2 smoke harness), [`docs/61`](61-roadmap-and-sprint-number-reconciliation.md), [`docs/63`](63-updated-product-roadmap-after-sprint-11.md), [`.agent-logs/sprint-11/task-11.1-execute-staging-deploy-mode-a.md`](../.agent-logs/sprint-11/task-11.1-execute-staging-deploy-mode-a.md)

Task 11.1 executes **first staging deploy** in **Mode A safe default**: Cloudflare Worker staging + Cloudflare Pages staging. No payment sandbox, no live Duitku/Mayar, no production changes.

**No secrets committed or logged.** Production payment remains **NOT ENABLED**.

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| `[env.staging]` + Mode A vars | `CREDIT_TOPUP_ENABLED=true` |
| API Worker deploy | Payment sandbox (Mode B) |
| Pages web deploy + SPA fallback | Duitku/Mayar live smoke |
| Health + CORS + web load verify | Production deploy |
| `smoke:staging:health` | Remote migration push |

---

## 2. Pre-deploy audit

| Item | Before 11.1 | After 11.1 |
|---|---|---|
| `apps/api/wrangler.toml` | Single `vibenovel-api` dev env | `[env.staging]` added |
| `[env.staging]` | ❌ Missing | ✅ `vibenovel-api-staging` |
| Pages SPA fallback | ❌ None | ✅ `apps/web/public/_redirects` |
| Deploy npm scripts | ❌ None | ✅ `deploy:api:staging`, `deploy:web:staging`, `smoke:staging:health` |
| Cloudflare auth | ✅ OAuth logged in | Used for deploy |
| Hosted Supabase staging | ❌ Not configured in repo | ❌ Secrets **not set** on Worker |
| Production Worker/Pages | Untouched | ✅ Untouched |

---

## 3. Config changes

### `apps/api/wrangler.toml` — `[env.staging]`

Non-secret vars only:

| Variable | Value |
|---|---|
| `name` | `vibenovel-api-staging` |
| `APP_ENV` | `staging` |
| `ALLOWED_ORIGINS` | `https://vibenovel-web-staging.pages.dev` |
| `CREDIT_TOPUP_ENABLED` | `false` |
| `PAYMENT_PROVIDER` | `mock` |
| `PAYMENT_PROVIDER_MOCK` | `true` |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` |
| `AI_GENERATION_ENABLED` | `false` |
| `AI_PROVIDER_MOCK` | `true` |

### `apps/web/public/_redirects`

```
/*    /index.html   200
```

Copied to `dist/` on Vite build; uploaded to Pages on deploy.

### Root `package.json` scripts

| Script | Command |
|---|---|
| `deploy:api:staging` | `build:shared` + `wrangler deploy --env staging` |
| `deploy:web:staging` | `build:web` + `wrangler pages deploy` |
| `smoke:staging:health` | `scripts/staging-health-smoke.ps1` |

### Web staging build (operator, not committed)

For Pages deploy, build with staging API URL baked in:

```powershell
set VITE_API_URL=https://vibenovel-api-staging.moxsenna.workers.dev
set VITE_USE_MOCKS=false
npm run build:web
npm run deploy:web:staging
```

When hosted Supabase staging exists, add at build time (names only):

```powershell
set VITE_SUPABASE_URL=https://<project>.supabase.co
set VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## 4. Secrets status

| Secret | Staging Worker | Notes |
|---|---|---|
| `SUPABASE_URL` | **Not set** | Hosted Supabase staging project required |
| `SUPABASE_ANON_KEY` | **Not set** | Operator: `wrangler secret put --env staging` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Not set** | Required for API data routes |
| Payment / AI secrets | **Not set** | Correct for Mode A |

**Health impact:** `hasSupabaseUrl=false`, `hasSupabaseAnonKey=false`, `hasSupabaseServiceRoleKey=false` — expected until operator configures hosted Supabase.

**No secret values printed or stored in repo/docs.**

---

## 5. API staging deploy result

| Item | Result |
|---|---|
| Command | `npm run deploy:api:staging` |
| Outcome | **SUCCESS** |
| Worker name | `vibenovel-api-staging` |
| URL | `https://vibenovel-api-staging.moxsenna.workers.dev` |
| Version ID | `c0c5304b-ecec-469b-bdb8-add152cf370d` (at deploy time) |
| Production worker | **Not modified** |

---

## 6. Web staging deploy result

| Item | Result |
|---|---|
| Pages project | `vibenovel-web-staging` (created) |
| Command | `npx wrangler pages deploy apps/web/dist --project-name vibenovel-web-staging --branch main` |
| Outcome | **SUCCESS** |
| Production URL | `https://vibenovel-web-staging.pages.dev` |
| Preview deployment | `https://bb688872.vibenovel-web-staging.pages.dev` |
| `_redirects` | Uploaded ✅ |

**Note:** First deploy built with `VITE_API_URL` pointing to staging API; `VITE_SUPABASE_*` not set — Supabase client null, integration/auth flows blocked until operator rebuilds with hosted anon env.

---

## 7. Health / CORS / web verification

### `GET /api/health` (Mode A)

```json
{
  "ok": true,
  "data": {
    "service": "vibenovel-api",
    "env": {
      "appEnv": "staging",
      "creditTopupEnabled": false,
      "paymentProviderMock": true,
      "paymentProvider": "mock",
      "aiGenerationEnabled": false,
      "aiProviderMock": true,
      "hasSupabaseUrl": false,
      "duitkuSmokeCallbackFixture": false
    }
  }
}
```

(Sanitized — no secret values in response.)

### `npm run smoke:staging:health`

**PASS** — all Mode A flag checks.

### CORS

Request with `Origin: https://vibenovel-web-staging.pages.dev`:

```
Access-Control-Allow-Origin: https://vibenovel-web-staging.pages.dev
Access-Control-Allow-Credentials: true
```

Matches `ALLOWED_ORIGINS` in staging Worker vars.

### Web load

| URL | HTTP | Notes |
|---|---|---|
| `https://vibenovel-web-staging.pages.dev/` | **200** | App shell loads |
| `https://vibenovel-web-staging.pages.dev/credits/topup` | **200** | SPA fallback works |

---

## 8. Smoke result

| Smoke | Result | Detail |
|---|---|---|
| `smoke:staging:health` | **PASS** | Mode A flags verified |
| `smoke:web:topup -IncludeApiMode` | **NOT RUN** | Would use local `supabase status` — wrong for staging; needs Task 11.2 + hosted Supabase |
| Payment live smokes | **NOT RUN** | Mode A policy |
| `smoke:all:local` | **NOT RUN** | No code regression required beyond typecheck/build |

### Build verification (pre-deploy)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run build:web` | **PASS** |

---

## 9. Rollback / safe state

Current staging state is **already Mode A safe**:

| Setting | Staging value |
|---|---|
| `CREDIT_TOPUP_ENABLED` | `false` |
| `PAYMENT_PROVIDER_MOCK` | `true` |
| `PAYMENT_PROVIDER` | `mock` |
| `AI_GENERATION_ENABLED` | `false` |
| Payment provider secrets | unset |
| Production | untouched |

**Instant kill:** vars already safe; redeploy only if vars change.

```powershell
npm run deploy:api:staging
```

**If rollback needed after accidental Mode B:** revert `wrangler.toml` staging vars, remove payment secrets via dashboard, redeploy.

---

## 10. Go / No-Go for Mode A

### GO criteria (Task 11.1 acceptance A)

| # | Criterion | Status |
|---|---|---|
| 1 | `[env.staging]` exists | ✅ |
| 2 | API staging deploy succeeds | ✅ |
| 3 | Web staging deploy succeeds | ✅ |
| 4 | `/api/health` safe Mode A flags | ✅ |
| 5 | Web staging loads | ✅ |
| 6 | `/credits/topup` loads (SPA) | ✅ |
| 7 | No secrets committed | ✅ |
| 8 | Production untouched | ✅ |

### Verdict: **GO Mode A** (deploy shell)

Staging infrastructure is live for health, CORS, and static web shell.

### Partial blockers (not Mode A deploy failures)

| Blocker | Impact | Unblock |
|---|---|---|
| No hosted Supabase staging secrets | Auth, `/api/me`, full API smoke blocked | Operator creates project + `wrangler secret put` ×3 |
| Web build without `VITE_SUPABASE_*` | Login/API-mode UI blocked | Rebuild web with hosted anon env |
| Migrations on hosted DB | Data routes fail until applied | Operator `supabase db push` with approval |

**Payment sandbox (Mode B):** still **NOT RUN** — correct for 11.1.

**Production payment:** **NOT ENABLED** / **NOT READY**.

---

## 11. Remaining blockers

1. Create/configure **hosted Supabase staging** project
2. Apply migrations `00001`–`00009` (operator approval)
3. Set Worker secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. Rebuild + redeploy web with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_USE_MOCKS=false`
5. Task **11.2** — staging smoke harness (`-SupabaseUrl`, `smoke:staging` orchestrator)
6. Task **10.13b / 10.8b** — Mode B payment sandbox (after 11.2 + public callback registration)

---

## 12. Next recommended task

**Task 11.2** — Staging smoke harness: Supabase params for smoke scripts, `smoke:staging` orchestrator, auth/project smoke against hosted DB.

**Operator parallel** — Provision hosted Supabase staging + set Worker secrets + rebuild web.

**Then** — Task 10.13b (Duitku Mode B) or 10.8b (Mayar Mode B) with `DUITKU_CALLBACK_URL=https://vibenovel-api-staging.moxsenna.workers.dev/api/payments/duitku/callback`.

---

## Operator checklist (secrets — never commit values)

```powershell
cd apps\api
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_ANON_KEY --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
npm run deploy:api:staging

# Rebuild web with hosted Supabase + staging API URL, then:
npm run deploy:web:staging
npm run smoke:staging:health -- -ApiBaseUrl "https://vibenovel-api-staging.moxsenna.workers.dev"
```

---

*Authored Task 11.1 — 9 Juni 2026. Staging Mode A deployed; hosted Supabase pending; production NOT ENABLED.*