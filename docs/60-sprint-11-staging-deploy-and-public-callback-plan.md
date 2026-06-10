# 60 — Sprint 11 Staging Deploy & Public Callback Plan (Task 11.0)

**Date:** 2026-06-09  
**Status:** Plan complete — **Mode A deployed** (Task 11.1); **smoke harness** (Task 11.2)  
**Sprint:** 11 (staging readiness)  
**Related:** [`docs/64`](64-staging-smoke-harness-and-supabase-report.md) (Task 11.2 smoke harness), [`docs/61`](61-roadmap-and-sprint-number-reconciliation.md) (sprint numbering map), [`docs/53`](53-sprint-10-verification-report.md), [`docs/59`](59-duitku-sandbox-live-smoke-report.md), [`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md), [`.agent-logs/sprint-11/task-11.0-staging-deploy-public-callback-preparation.md`](../.agent-logs/sprint-11/task-11.0-staging-deploy-public-callback-preparation.md)

> **Note:** Actual Sprint 11 = staging readiness. Old product roadmap Sprint 11 = Voice Learning — see docs/61.

> **Update 2026-06-09 (post Task 11.6):** Brand = **Narraza**. Staging API = `https://api-staging.narraza.web.id` (AWS HTTPS). Web = `https://vibenovel-web-staging.pages.dev` → AWS API. Domain `narraza.web.id` = temporary MVP; `narraza.id` later. See [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md).

Task 11.0 prepares **staging deploy architecture**, **public callback URL strategy**, **env/secret checklist**, **deploy steps**, **smoke plan**, and **rollback** so Duitku and/or Mayar sandbox payment can be tested without enabling production payment.

**No remote deploy executed.** **No secrets committed.** Production payment remains **NOT ENABLED**.

---

## 1. Purpose

### Why staging is required now

Sprint 10 post-closure payment work is **fixture-verified locally** but **live-blocked**:

| Provider | Blocker |
|---|---|
| Duitku | No sandbox credentials + no public `DUITKU_CALLBACK_URL` ([`docs/59`](59-duitku-sandbox-live-smoke-report.md)) |
| Mayar | No sandbox `MAYAR_API_KEY` + no public webhook URL ([`docs/54`](54-mayar-staging-live-execution-report.md)) |

Duitku and Mayar **cannot POST** to `127.0.0.1` or `localhost`. A **public HTTPS API endpoint** is required for server-side grant paths:

- Duitku: `POST /api/payments/duitku/callback` (form-urlencoded)
- Mayar: `POST /api/payments/mayar/webhook` (JSON)

Return URLs (`/credits/topup/return`) are **UX only** — they never grant credits.

### Task 11.0 scope

| In scope | Out of scope |
|---|---|
| Deploy readiness audit | Production deploy |
| Staging env naming + URL plan | New product features |
| Secret/env checklist (names only) | Migration push |
| Safe / payment-sandbox modes | Live payment execution |
| Deploy + smoke + rollback plans | `CREDIT_TOPUP_ENABLED=true` in production |
| Blocked/deferred register update | AI staging live tests |

---

## 2. Current deploy readiness audit

### Repo structure

| Component | Path | Runtime target |
|---|---|---|
| API | `apps/api` | **Cloudflare Workers** (Hono + Wrangler) |
| Web | `apps/web` | **Static SPA** (Vite + React) — deploy target **Cloudflare Pages** (recommended) |
| Shared types | `packages/shared` | Built before API/web |
| Database | `supabase/` | Local dev today; **hosted Supabase project required for staging** |

### API deployment

| Item | Status |
|---|---|
| `apps/api/wrangler.toml` | ✅ Exists — single worker `vibenovel-api`, `APP_ENV=development`, local origins only |
| `[env.staging]` / `[env.production]` | ❌ **Not defined** — Task 11.1 |
| `wrangler deploy` script | ⚠️ `build` = `wrangler deploy --dry-run` only; no `deploy:staging` npm script |
| Secrets in wrangler | ❌ Not configured — use `wrangler secret put` per env |
| Local secrets | ✅ `.dev.vars` (gitignored) + `.dev.vars.example` |

### Web deployment

| Item | Status |
|---|---|
| `vite build` → `apps/web/dist` | ✅ Works (`npm run build:web`) |
| Cloudflare Pages config | ❌ No `_redirects` / `wrangler.toml` for Pages in repo |
| SPA routing | React Router — Pages needs `/* → /index.html` fallback |
| Env at build time | `VITE_*` baked into bundle — staging build needs CI/env per deploy |
| `preview` script | ✅ `vite preview` for local post-build check |

### Build / typecheck / smoke scripts (root `package.json`)

| Script | Purpose |
|---|---|
| `typecheck` / `typecheck:api` / `typecheck:web` | Pre-deploy gate |
| `build:shared` / `build:api` / `build:web` | Artifact build |
| `smoke:all:local` | 14-phase local regression |
| `smoke:api:sprint10:duitku` | Duitku precheck + fixture |
| `smoke:api:sprint10:mayar-live` | Mayar live precheck |
| `smoke:web:topup` | Topup UI mock/API-mode |

**No `deploy:staging` or `smoke:staging` npm scripts yet** — Task 11.1/11.2.

### Smoke script base URL support (audit)

Most API smoke scripts accept **`-ApiBaseUrl`**:

| Script | `-ApiBaseUrl` | `-WebBaseUrl` | Notes |
|---|---|---|---|
| `sprint2-smoke-api.ps1` | ✅ | — | Full Sprint 2 regression |
| `sprint10-smoke-api.ps1` | ✅ | — | Mock topup + webhook |
| `sprint10-duitku-smoke-api.ps1` | ✅ | — | Fixture + `-LiveCreate` |
| `sprint10-mayar-live-smoke.ps1` | ✅ | — | Live Mayar precheck |
| `sprint10-smoke-web.ps1` | ✅ | ✅ | `-IncludeApiMode` for API E2E |
| `smoke-all-local.ps1` | ✅ | ✅ | Forwards to child scripts |

**Gap:** Staging smoke needs **hosted Supabase** credentials in scripts (today scripts read local `supabase status`). Task 11.2: add optional `-SupabaseUrl` / `-SupabaseAnonKey` params or env file for staging runs.

**Gap:** No dedicated `smoke:staging` orchestrator — document manual invocation with base URLs until 11.2.

### Payment webhook routes (no JWT — public)

From `apps/api/src/routes/payment-webhooks.ts`:

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/payments/mayar/webhook` | None | JSON |
| POST | `/api/payments/duitku/callback` | None | `application/x-www-form-urlencoded` |

Grant only via these routes + `grantCreditsForPaymentSession`. Return page does not grant.

### Health preflight booleans (`GET /api/health`)

Safe flags for staging verification (no secret values):

`creditTopupEnabled`, `paymentProviderMock`, `paymentProvider`, `duitkuEnv`, `hasDuitkuMerchantCode`, `hasDuitkuMerchantKey`, `hasDuitkuCallbackUrl`, `duitkuCallbackUrlIsPublic`, `hasMayarApiKey`, `aiGenerationEnabled`, `aiProviderMock`

---

## 3. Proposed staging environments

### Naming convention

| Resource | Proposed name | Notes |
|---|---|---|
| API Worker (staging) | `vibenovel-api-staging` | Separate from production `vibenovel-api` |
| Web Pages (staging) | `vibenovel-web-staging` | Separate project |
| Supabase | `vibenovel-staging` (hosted project) | Not local Docker |
| Production (unchanged) | `vibenovel-api`, `vibenovel-web` | **Do not enable payment** until ops Go/No-Go |

### URL examples (operator chooses domain)

Replace `<domain>` with owned domain or use default `*.workers.dev` / `*.pages.dev`.

| Surface | Example URL |
|---|---|
| API staging (primary) | `https://api-staging.narraza.web.id` (AWS EC2 HTTPS — Task 11.6) |
| API staging (fallback) | `https://vibenovel-api-staging.moxsenna.workers.dev` |
| Web staging | `https://vibenovel-web-staging.pages.dev` (→ AWS API) |

### Payment callback URLs (staging API)

| Provider | Callback URL |
|---|---|
| **Duitku** | `POST https://<api-staging>/api/payments/duitku/callback` |
| **Mayar (direct)** | `POST https://<api-staging>/api/payments/mayar/webhook` |
| **Mayar (via Siklusio router)** | Mayar → Siklusio staging → forward to VibeNovel staging webhook (production-like; optional) |

Set in Worker secrets:

- `DUITKU_CALLBACK_URL=https://<api-staging>/api/payments/duitku/callback`
- For Mayar direct: register `<api-staging>/api/payments/mayar/webhook` in **sandbox** dashboard only

### Return URLs (staging web — UX only)

| Path | Purpose |
|---|---|
| `https://<web-staging>/credits/topup/return` | Real provider redirect after payment |
| `https://<web-staging>/credits/topup/mock-return` | **Mock/local only** — not for live Duitku/Mayar |

Worker vars:

- `DUITKU_RETURN_URL=https://<web-staging>`
- `MAYAR_REDIRECT_BASE_URL=https://<web-staging>`
- `PAYMENT_RETURN_BASE_URL=https://<web-staging>` (optional alias)

### CORS (`ALLOWED_ORIGINS`)

Staging Worker must include web staging origin:

```
ALLOWED_ORIGINS=https://<web-staging>,https://staging.vibenovel.<domain>
```

---

## 4. API staging environment checklist

**Names only — never commit values.** Set via `wrangler secret put` (secrets) or `[vars]` / `[env.staging.vars]` (non-secrets).

### Required (all staging deploys)

| Variable | Type | Staging default | Notes |
|---|---|---|---|
| `SUPABASE_URL` | secret/var | hosted project URL | Not `127.0.0.1` |
| `SUPABASE_ANON_KEY` | secret | hosted anon key | JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | hosted service role | Server-only; never web |
| `APP_ENV` | var | `staging` | Distinguish from production |
| `ALLOWED_ORIGINS` | var | web staging URL(s) | Comma-separated |

### Payment — Mode A (safe default)

| Variable | Value |
|---|---|
| `CREDIT_TOPUP_ENABLED` | `false` |
| `PAYMENT_PROVIDER` | `mock` |
| `PAYMENT_PROVIDER_MOCK` | `true` |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` |

### Payment — Mode B (sandbox live smoke only)

Enable **only** during Task 10.13b / 11.1 with operator approval:

| Variable | Value |
|---|---|
| `CREDIT_TOPUP_ENABLED` | `true` |
| `PAYMENT_PROVIDER` | `duitku` or `mayar` |
| `PAYMENT_PROVIDER_MOCK` | `false` |
| `DUITKU_ENV` | `sandbox` |
| `DUITKU_MERCHANT_CODE` | secret | sandbox portal |
| `DUITKU_MERCHANT_KEY` | secret | sandbox portal |
| `DUITKU_BASE_URL` | `https://api-sandbox.duitku.com` | var |
| `DUITKU_CALLBACK_URL` | `https://<api-staging>/api/payments/duitku/callback` | must be public |
| `DUITKU_RETURN_URL` | `https://<web-staging>` | var |
| `MAYAR_API_KEY` | secret | only if testing Mayar |
| `MAYAR_BASE_URL` | `https://api.mayar.club/hl/v1` | sandbox |
| `MAYAR_ENV` | `sandbox` | var |
| `MAYAR_REDIRECT_BASE_URL` | `https://<web-staging>` | var |

### AI — disabled on staging default (Mode C deferred)

| Variable | Staging default |
|---|---|
| `AI_GENERATION_ENABLED` | `false` |
| `AI_PROVIDER_MOCK` | `true` |
| `OPENROUTER_API_KEY` | unset unless separate AI live task |

### Secret rules

- All payment/DB/AI secrets → **Cloudflare Worker secrets** (or gitignored local `.dev.vars` for tunnel dev only).
- **Never** put `SUPABASE_SERVICE_ROLE_KEY`, `DUITKU_MERCHANT_KEY`, `MAYAR_API_KEY`, or `OPENROUTER_API_KEY` in web env or repo.
- **Never** log secret values in smoke output, docs, or work logs.

---

## 5. Web staging environment checklist

Set at **build time** (Cloudflare Pages env / CI):

| Variable | Staging value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | hosted Supabase URL | Public anon — OK in web |
| `VITE_SUPABASE_ANON_KEY` | hosted anon key | Public anon — OK in web |
| `VITE_API_URL` | `https://<api-staging>` | Must match deployed Worker |
| `VITE_USE_MOCKS` | `false` | API-mode staging |

**Forbidden in web env:**

- `SUPABASE_SERVICE_ROLE_KEY`
- `DUITKU_MERCHANT_*`, `MAYAR_API_KEY`, `OPENROUTER_API_KEY`

---

## 6. Safe staging modes

### Mode A — Safe Staging Default (recommended first deploy)

Use to verify deploy, health, auth, and basic app without payment or AI spend.

| Layer | Settings |
|---|---|
| API | `CREDIT_TOPUP_ENABLED=false`, `PAYMENT_PROVIDER_MOCK=true`, `AI_GENERATION_ENABLED=false` |
| Web | `VITE_USE_MOCKS=false`, `VITE_API_URL=<api-staging>` |

**Verify:**

```powershell
curl.exe -s https://<api-staging>/api/health
# Expect: creditTopupEnabled=false, paymentProviderMock=true, aiGenerationEnabled=false
```

### Mode B — Payment Sandbox Staging

Use **only** during controlled live sandbox smoke (Task 10.13b / 11.1):

| Layer | Settings |
|---|---|
| API | Mode B payment vars (§4); `duitkuCallbackUrlIsPublic=true` on health |
| Web | Same as Mode A |
| Provider dashboards | Register **sandbox** callback/webhook URL only |

**Pre-smoke:** Run fixture callback matrix locally PASS before live payment.

**Post-smoke:** Rollback to Mode A (§9).

### Mode C — AI Staging

**Out of scope Task 11.0.** See [`docs/46`](46-live-openrouter-staging-verification-plan.md). Keep AI disabled on staging unless separate approved task.

---

## 7. Public callback readiness checklist

Before registering Duitku/Mayar sandbox callbacks:

| # | Requirement | Status |
|---|---|---|
| 1 | API staging URL is public **HTTPS** | ⏸ Pending deploy |
| 2 | `GET /api/health` returns `ok: true` | ⏸ After deploy |
| 3 | `POST /api/payments/duitku/callback` does **not** require JWT | ✅ Implemented |
| 4 | Duitku callback accepts `application/x-www-form-urlencoded` | ✅ Implemented |
| 5 | Mayar webhook accepts JSON body | ✅ Implemented |
| 6 | `DUITKU_CALLBACK_URL` host is not localhost (`duitkuCallbackUrlIsPublic=true`) | ⏸ After secret set |
| 7 | Return URL does **not** grant credits | ✅ API + UI design |
| 8 | Fixture callback smoke PASS locally | ✅ 15/15 ([`docs/58`](58-duitku-callback-idempotent-grant-report.md)) |
| 9 | `CREDIT_TOPUP_ENABLED=false` on first staging deploy | ✅ Planned default |
| 10 | Production payment dashboards untouched | ✅ Policy |

**Duitku portal:** Set callback URL to staging API path in **sandbox** merchant settings.

**Mayar sandbox:** Register webhook at `https://<api-staging>/api/payments/mayar/webhook` in `web.mayar.club` only. Do **not** change production Siklusio dashboard without ops approval ([`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md) §C).

---

## 8. Proposed deploy steps (PowerShell-friendly)

**Do not run until Cloudflare account, hosted Supabase, and operator approval are ready.** No secrets in commands below.

### Phase 0 — Prerequisites

1. Cloudflare account with Workers + Pages enabled
2. Hosted Supabase project `vibenovel-staging` with migrations `00001`–`00009` applied (backup first)
3. Custom domain or accept `*.workers.dev` / `*.pages.dev` URLs
4. `npx wrangler login` (operator machine — not CI secret in repo)

### Phase 1 — Build verification (local)

```powershell
cd D:\Coding\vibenovel-unified-blueprint
npm install
npm run typecheck
npm run build:shared
npm run build:api
npm run build:web
```

### Phase 2 — API staging (Task 11.1)

1. Add `[env.staging]` to `apps/api/wrangler.toml` with `name = "vibenovel-api-staging"` and staging `APP_ENV` / `ALLOWED_ORIGINS` (non-secrets only)
2. Set secrets (names only — run interactively):

```powershell
cd apps\api
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_ANON_KEY --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
# Mode A only first — do NOT set payment secrets until Mode B smoke approved
```

3. Deploy:

```powershell
npx wrangler deploy --env staging
```

4. Record staging API URL from deploy output (e.g. `https://vibenovel-api-staging.<account>.workers.dev`)

5. Verify:

```powershell
curl.exe -s https://<api-staging>/api/health
```

### Phase 3 — Web staging (Task 11.1)

1. Create Cloudflare Pages project `vibenovel-web-staging`
2. Build command: `npm run build:web` (from repo root with workspaces)
3. Output directory: `apps/web/dist`
4. Set build env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL=https://<api-staging>`, `VITE_USE_MOCKS=false`
5. Configure SPA fallback: `/* /index.html 200`
6. Deploy and verify web loads + login works against staging Supabase

### Phase 4 — Payment sandbox secrets (Mode B — Task 11.1 / 10.13b)

Only after Mode A health PASS:

```powershell
# Example names — operator supplies values interactively
npx wrangler secret put DUITKU_MERCHANT_CODE --env staging
npx wrangler secret put DUITKU_MERCHANT_KEY --env staging
# Set vars: DUITKU_CALLBACK_URL, DUITKU_RETURN_URL, CREDIT_TOPUP_ENABLED=true, etc.
npx wrangler deploy --env staging
```

Register callback URL in Duitku sandbox merchant portal.

### Phase 5 — Staging smoke (Task 11.2)

```powershell
# Health
curl.exe -s https://<api-staging>/api/health

# API smoke against staging (fixture/local Supabase gap — see §11.2)
npm run smoke:api:sprint10:duitku -- -ApiBaseUrl "https://<api-staging>"

# Web API-mode (staging web must be running/deployed)
npm run smoke:web:topup -- -WebBaseUrl "https://<web-staging>" -ApiBaseUrl "https://<api-staging>" -IncludeApiMode
```

**Note:** Full API smokes that create users need staging Supabase credentials in script — Task 11.2.

---

## 9. Staging smoke plan

### Layer A — Health smoke (first after deploy)

| Step | Command / check | Expected |
|---|---|---|
| API up | `GET https://<api-staging>/api/health` | `ok: true` |
| Safe defaults | `creditTopupEnabled=false`, `paymentProviderMock=true` | Mode A |
| No secret leak | Response JSON has flag names only | No keys in body |
| Web up | Load `https://<web-staging>` | 200, app shell |

### Layer B — Auth / project smoke

| Step | Approach |
|---|---|
| Manual | Create test user in staging Supabase; login via web |
| Automated | Extend smoke scripts with staging Supabase URL (Task 11.2) |
| Minimum | `GET /api/me` with staging JWT after manual login |

### Layer C — Payment fixture smoke

| Context | Approach |
|---|---|
| Local | `npm run smoke:api:sprint10:duitku` — fixture matrix PASS (current) |
| Staging Mode A | `CREDIT_TOPUP_ENABLED=false` → checkout returns `TOPUP_DISABLED` |
| Staging Mode B | Run fixture callback tests only if `DUITKU_SMOKE_CALLBACK_FIXTURE` allowed in staging (default: use real sandbox callback instead) |

**Rule:** Fixture smoke PASS locally before any live sandbox payment.

### Layer D — Payment live sandbox smoke

**Task 10.13b or 11.1 only** — operator approval, Mode B:

1. `npm run smoke:api:sprint10:duitku -- -ApiBaseUrl "https://<api-staging>" -LiveCreate`
2. Complete sandbox payment (starter only, max 12 attempts)
3. Capture sanitized callback payload → update report doc
4. Verify grant + duplicate replay
5. Mayar parallel: `npm run smoke:api:sprint10:mayar-live -- -ApiBaseUrl "https://<api-staging>"`

### Layer E — Web smoke

| Step | Command |
|---|---|
| Mock | `npm run smoke:web:topup` (local dev) |
| Staging API-mode | `npm run smoke:web:topup -- -WebBaseUrl "https://<web-staging>" -ApiBaseUrl "https://<api-staging>" -IncludeApiMode` |
| Return page | After live payment: confirm pending state, Refresh Saldo only, no grant from URL |

---

## 10. Rollback plan

### Immediate payment kill (staging or local)

| Action | Effect |
|---|---|
| `CREDIT_TOPUP_ENABLED=false` | Checkout + webhooks return disabled; instant kill |
| `PAYMENT_PROVIDER_MOCK=true` | Mock provider wins; no live provider network |
| `PAYMENT_PROVIDER=mock` | Safe default selector |
| Redeploy Worker | Apply var changes |

```powershell
# After updating staging vars/secrets
cd apps\api
npx wrangler deploy --env staging
```

### If secrets leaked

1. Rotate keys in Duitku/Mayar/Supabase dashboards
2. `wrangler secret put <NAME> --env staging` with new values
3. Remove old secrets from any local `.dev.vars` copies
4. Document incident in ops log (no secret values)

### Infrastructure rollback

| Action | When |
|---|---|
| Disable Cloudflare route / pause Pages deploy | Staging misconfigured |
| Revert Worker to previous deployment | Wrangler rollback / redeploy prior version |
| **Do not** touch production Worker/Pages | Always |

### Data policy

- **Do not** delete `credit_topup_orders`, `payment_webhook_events`, or `credit_ledger` rows unless approved test cleanup policy
- Production database **untouched**

---

## 11. Script gaps and Task 11.1/11.2 follow-ups

| Gap | Proposed task | Effort |
|---|---|---|
| No `[env.staging]` in `wrangler.toml` | 11.1 | Small |
| No `deploy:staging` npm scripts | 11.1 | Small |
| No Cloudflare Pages config in repo | 11.1 | Small (`_redirects` or Pages wrangler) |
| Smoke scripts assume local `supabase status` | 11.2 | Medium — add `-SupabaseUrl` / key params |
| No `smoke:staging` orchestrator | 11.2 | Medium |
| No staging health check in CI | 11.2+ | Deferred |

**Existing capability (no change needed for 11.0):** `-ApiBaseUrl` and `-WebBaseUrl` already work on key sprint10 scripts.

---

## 12. Blocked / non-blocking register (summary)

See [`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md) for full update.

### Currently blocked

| Item | Blocker | Unblock |
|---|---|---|
| Duitku live sandbox | No credentials + no public callback | Task 11.1 deploy + Mode B secrets |
| Mayar live sandbox | No sandbox key + no public webhook | Task 11.1 deploy + Mode B secrets |
| Production payment | Ops gates not met | All staging smokes PASS + legal/SOP |

### Currently deferred (fix later)

| Item | Priority |
|---|---|
| True DB RPC atomic grant | P1 before production |
| Refund/chargeback SOP | P2 |
| Admin payment dashboard | P2 |
| `GET /api/credits/topup/orders/:id` | P2 |
| CI E2E / automated staging smoke | P1 |
| Live AI spot checks on staging | P2 |
| Remote migration push / production deploy | Manual approval |
| Mayar webhook HMAC verification | P2 |
| Siklusio → VibeNovel staging router replay | P1 before prod router |

---

## 13. Go / No-Go (staging deploy)

### Task 11.0 (this plan)

| Criterion | Status |
|---|---|
| Architecture documented | ✅ |
| Env checklist documented | ✅ |
| Callback URL strategy documented | ✅ |
| Deploy steps documented | ✅ |
| Smoke + rollback documented | ✅ |
| Production payment enabled | ❌ **NOT** |
| Secrets committed | ❌ **NOT** |
| Staging actually deployed | ✅ **Task 11.1** — see [`docs/62`](62-staging-deploy-mode-a-report.md) |

### Staging GO — Task 11.1 result

Staging is **GO for Mode A** (deploy shell) when:

- API + web deploy succeed
- `/api/health` PASS with safe defaults
- Web loads with `VITE_USE_MOCKS=false`
- CORS allows web staging origin

Staging is **GO for Mode B payment smoke** when:

- Mode A GO
- `duitkuCallbackUrlIsPublic=true` (or Mayar webhook registered)
- Operator sandbox credentials set via secrets
- Fixture smoke PASS locally
- Rollback procedure understood

**Production payment:** remains **NOT READY** until [`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md) §C gates PASS.

---

## 14. Next recommended tasks

| Task | Focus |
|---|---|
| **11.0b** | ✅ Roadmap reconciliation — [`docs/61`](61-roadmap-and-sprint-number-reconciliation.md) |
| **11.1** | ✅ Closed — [`docs/62`](62-staging-deploy-mode-a-report.md) |
| **11.2** | Staging smoke harness + hosted Supabase secrets + web rebuild |
| **10.13b** | Duitku sandbox live smoke (Mode B, after 11.2) |
| **10.8b** | Mayar sandbox live smoke (Mode B, after 11.2) |

---

*Authored Task 11.0 — 9 Juni 2026. Task 11.1 addendum: Mode A deployed; production payment NOT ENABLED.*