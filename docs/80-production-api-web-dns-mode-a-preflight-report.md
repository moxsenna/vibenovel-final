# 80 — Production API/Web/DNS Mode A Plan and Preflight (Task 10.22)

**Date:** 2026-06-10  
**Status:** **GO** (plan + preflight complete; **no production deploy**) — **domain corrected Task 10.23a** — homepage `narraza.web.id`, app `app.narraza.web.id`, API `api.narraza.web.id`; `narraza.id` reserved for future migration. Infra unblock: [`docs/82`](82-production-infra-unblock-report.md)
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/78`](78-production-environment-foundation-plan.md), [`docs/79`](79-production-supabase-baseline-setup-report.md), [`docs/77`](77-production-payment-preflight-migration-approval-gate.md), [`docs/73`](73-duitku-production-payment-enable-plan.md), [`docs/76`](76-redeploy-staging-api-rpc-grant-integration-report.md), [`.agent-logs/sprint-10/task-10.22-production-api-web-dns-mode-a-preflight.md`](../.agent-logs/sprint-10/task-10.22-production-api-web-dns-mode-a-preflight.md)

Planning and read-only preflight for production API/web/DNS in **Mode A safe** state, building on Task 10.21 production Supabase baseline. **Payment NOT enabled.** **Migration `00010` NOT applied.** **No Duitku callback registration.** **No production deploy executed.**

---

## 1. Production readiness audit (preflight)

### 1.1 Production Supabase (Task 10.21)

| Item | Status |
|---|---|
| Task 10.21 | **GO** — [`docs/79`](79-production-supabase-baseline-setup-report.md) §14 |
| Production ref (sanitized) | `qjmb…njct` — **≠** staging `jdxyhrnibmmwlbtbokqo` |
| Migrations `00001`–`00009` | **Applied** on production |
| Migration `00010` | **NOT applied** |
| Baseline schema | **PASS** (REST verification per docs/79) |
| Payment on DB | **OFF** — catalog seed only from `00009` |
| Account | Separate Supabase account from staging |

### 1.2 Operator env

| Item | Result |
|---|---|
| `.env.production` exists | **YES** (operator machine) |
| Gitignored | **YES** — `git check-ignore .env.production` → `.gitignore:14:.env.*` |
| Committed to repo | **NO** |
| Template | `.env.production.example` (names only, committed) |
| Mode A flags in example | `CREDIT_TOPUP_ENABLED=false`, `PAYMENT_PROVIDER=mock`, `PAYMENT_PROVIDER_MOCK=true` |

### 1.3 Supabase CLI link

| Item | Result |
|---|---|
| Current linked ref | `qjmb…njct` (**production**) |
| Warning | Staging CLI ops require relink to staging account + ref `jdxyhrnibmmwlbtbokqo` — see [`docs/79`](79-production-supabase-baseline-setup-report.md) §14 |
| Action this task | **None** — read-only note only |

### 1.4 DNS (read-only lookup)

Lookup via `nslookup` / `8.8.8.8` (2026-06-10):

| Host | Result |
|---|---|
| `narraza.web.id` (homepage/landing) | **Resolvable** — apex in zone; **not** dashboard host |
| `app.narraza.web.id` (app/dashboard) | **Not configured** (Task 10.23a) — Pages custom domain pending |
| `api.narraza.web.id` (API) | **Not configured** (NXDOMAIN) — production EIP A record pending |
| `www.narraza.web.id` | TBD at deploy |
| `narraza.id` | **Reserved future** — not used for current launch |

**Implication:** Domain registration and/or Cloudflare zone setup required before Phases 5–6 execution.

### 1.5 Production API host

| Check | Result |
|---|---|
| `GET https://api.narraza.web.id/api/health` | **Unreachable** — hostname does not resolve |
| Production EC2 | **Not provisioned** (per docs/78; staging EC2 `13.212.245.32` must **not** be reused) |

### 1.6 Cloudflare Pages (production)

| Item | Result |
|---|---|
| Staging Pages project | `vibenovel-web-staging` → `vibenovel-web-staging.pages.dev` (**active**) |
| Production Pages project | `narraza-web-production` — preview live (Task 10.23) |
| `app.narraza.web.id` custom domain | **Not attached** — dashboard target (not apex) |
| `narraza.web.id` homepage | Placeholder/redirect plan (Option A) — separate from app |

### 1.7 Deploy / operator scripts

| Asset | Staging | Production |
|---|---|---|
| `docker-compose.staging.yml` | ✅ | ❌ `docker-compose.production.yml` **missing** |
| `deploy/caddy/Caddyfile.staging.example` | ✅ | ❌ production Caddyfile example **missing** |
| `deploy/ec2/bootstrap-ubuntu.sh` | ✅ (reusable pattern) | Reuse with prod-specific env |
| `deploy/ec2/deploy-app.sh` | ✅ (staging) | Adapt for `.env.production` |
| `deploy:api:staging` / `deploy:web:staging` | ✅ | ❌ no `deploy:*:production` |
| `operator:aws:*` scripts | Staging-targeted | ❌ no `operator:*:production` |
| `operator:production:supabase:baseline` | N/A | ✅ Task 10.21 |
| `wrangler.toml` `[env.staging]` | ✅ | ❌ no `[env.production]` |

### 1.8 Staging (read-only — unchanged)

| Check | Result |
|---|---|
| `https://api-staging.narraza.web.id/api/health` | **PASS** — Mode A |
| Flags | `creditTopupEnabled=false`, `paymentProvider=mock`, `paymentProviderMock=true`, `aiGenerationEnabled=false` |
| Staging DB | **Not touched** |

---

## 2. Production API Mode A requirements

### 2.1 Required API env (`.env.production` on EC2 only)

| Variable | Required value | Notes |
|---|---|---|
| `APP_ENV` | `production` | |
| `SUPABASE_URL` | Production Supabase URL | Ref `qjmb…njct` |
| `SUPABASE_ANON_KEY` | Production anon key | |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role | Server only; never web |
| `ALLOWED_ORIGINS` | `https://narraza.web.id,https://www.narraza.web.id,https://app.narraza.web.id` | CORS (homepage + app) |
| `CREDIT_TOPUP_ENABLED` | `false` | **Mandatory Mode A** |
| `PAYMENT_PROVIDER` | `mock` | **Mandatory Mode A** |
| `PAYMENT_PROVIDER_MOCK` | `true` | **Mandatory Mode A** |
| `AI_GENERATION_ENABLED` | `false` | Mode A |
| `AI_PROVIDER_MOCK` | `true` | Mode A |
| `PORT` | `8787` | Container internal |

### 2.2 Forbidden until separate approvals

| Variable | Status |
|---|---|
| `DUITKU_MERCHANT_CODE` | **Unset** |
| `DUITKU_MERCHANT_KEY` | **Unset** |
| `DUITKU_CALLBACK_URL` | **Unset** (future: `https://api.narraza.web.id/api/payments/duitku/callback`) |
| `DUITKU_ENV=production` | **Unset** |
| `CREDIT_TOPUP_ENABLED=true` | **Forbidden** |
| `PAYMENT_PROVIDER=duitku` | **Forbidden** |
| `PAYMENT_PROVIDER_MOCK=false` | **Forbidden** |
| `DUITKU_SMOKE_CALLBACK_FIXTURE` | **Must be unset/false** |

### 2.3 Expected health after future deploy

```http
GET https://api.narraza.web.id/api/health
```

| Field | Expected |
|---|---|
| `ok` | `true` |
| `data.env.appEnv` | `production` |
| `data.env.creditTopupEnabled` | `false` |
| `data.env.paymentProviderMock` | `true` |
| `data.env.paymentProvider` | `mock` |
| `data.env.aiGenerationEnabled` | `false` |
| `data.env.hasDuitkuMerchantCode` | `false` |
| `data.env.duitkuSmokeCallbackFixture` | `false` |

---

## 3. Production EC2 / API plan (plan only)

Mirror staging pattern from [`docs/68`](68-aws-ec2-api-staging-deploy-report.md) / [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md) on a **new** instance.

### 3.1 Instance checklist

| Step | Action |
|---|---|
| E1 | Launch **new** Ubuntu 24.04 LTS EC2 in `ap-southeast-1` (Singapore) |
| E2 | **Do not** reuse staging `13.212.245.32` unless founder explicit override |
| E3 | Instance type: **t3.small** recommended (2 vCPU / 2 GiB); **t3.micro** acceptable for Mode A low traffic |
| E4 | Allocate and attach **Elastic IP** (stable target for DNS) |
| E5 | Security group: inbound **22** (operator IP only), **80**, **443**; deny public **8787** |
| E6 | SSH key: founder/operator key pair; **never commit** private key |
| E7 | Run `deploy/ec2/bootstrap-ubuntu.sh` (Docker, Compose plugin, Caddy, UFW) |
| E8 | Create `/opt/vibenovel`; copy repo tarball or git clone; place **gitignored** `.env.production` |
| E9 | Add `docker-compose.production.yml` (future) — bind `127.0.0.1:8787:8787` like staging |
| E10 | Caddy hostname block for `api.narraza.web.id` → `reverse_proxy 127.0.0.1:8787` |
| E11 | `docker compose -f docker-compose.production.yml up -d --build` |
| E12 | Verify local health via SSH: `curl -s http://127.0.0.1:8787/api/health` |

### 3.2 Caddy target

```caddyfile
# deploy/caddy/Caddyfile.production.example (future)
api.narraza.web.id {
    reverse_proxy 127.0.0.1:8787
}
```

Let's Encrypt requires **DNS A record** pointing to EIP before HTTPS succeeds. Initially use DNS-only / grey-cloud if operator needs direct A for LE (same lesson as docs/69).

### 3.3 Rollback (API)

| Scenario | Action |
|---|---|
| Bad deploy | `docker compose down`; redeploy previous image tarball |
| Wrong env | Stop container; fix `.env.production`; restart — **never** flip payment flags without approval |
| Caddy misconfig | Restore previous `/etc/caddy/Caddyfile`; `systemctl reload caddy` |
| Wrong instance | **STOP**; do not point DNS; terminate only after founder review |

### 3.4 Cost warning

| Item | Estimate |
|---|---|
| EC2 t3.small + EIP | Low but **non-zero** monthly AWS bill |
| Egress | Traffic to Supabase + users |
| Cloudflare Pages | Free tier likely sufficient initially |
| **Recommendation** | Tag instance `narraza-production`; set billing alarm |

---

## 4. DNS plan

### 4.1 Prerequisites

1. Founder controls **`narraza.web.id`** zone (shared with staging subdomain).
2. Add **`api`** A record for production EIP — separate from `api-staging` → `13.212.245.32`.
3. Production EC2 **EIP** allocated.

### 4.2 Records — `api.narraza.web.id`

| Type | Name | Value | TTL | Proxy |
|---|---|---|---|---|
| A | `api` | `<production-eip>` | 300 (or Auto) | DNS only recommended for first LE issuance |

**Order:** EIP live → A record → wait propagation → Caddy HTTPS → `curl https://api.narraza.web.id/api/health`.

**Verify:**

```powershell
nslookup api.narraza.web.id 8.8.8.8
Invoke-RestMethod https://api.narraza.web.id/api/health
```

### 4.3 Records — `narraza.web.id` (web)

| Type | Name | Value | Notes |
|---|---|---|---|
| CNAME or CF Pages | `@` / `narraza.web.id` | Cloudflare Pages production target | Apex via CF flattening |
| CNAME | `www` | `narraza.web.id` or Pages URL | Optional redirect www → apex |

Cloudflare Pages: attach custom domain `narraza.web.id` (+ `www` if desired). **`narraza.id`** reserved for future migration — not current launch.

### 4.4 DNS rollback

| Action | When |
|---|---|
| Remove A record for `api` | API deploy failed / wrong EIP |
| Point `api` back to previous IP | Only if rollback instance exists |
| Detach Pages custom domain | Bad web deploy |
| Keep TTL 300 during cutover | Faster rollback |

---

## 5. Production app plan (Cloudflare Pages) — Task 10.23a

**Domain split:** Dashboard on **`app.narraza.web.id`**. Apex **`narraza.web.id`** = homepage/landing only (not dashboard).

### 5.1 Project setup

| Step | Action |
|---|---|
| W1 | Pages project **`narraza-web-production`** (preview live — Task 10.23) |
| W2 | Build: `npm run build:web:production` (`scripts/build-production-web.ps1`) |
| W3 | Output directory: `apps/web/dist` |
| W4 | **Build-time env** (from `.env.production` via build script): |

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://api.narraza.web.id` |
| `VITE_PUBLIC_SITE_URL` | `https://narraza.web.id` |
| `VITE_APP_URL` | `https://app.narraza.web.id` |
| `VITE_SUPABASE_URL` | Production Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Production anon key only |
| `VITE_USE_MOCKS` | `false` |

| Step | Action |
|---|---|
| W5 | **Never** set service role or Duitku keys in Pages env |
| W6 | Attach **`app.narraza.web.id`** custom domain (dashboard) |
| W7 | Apex `narraza.web.id`: placeholder/redirect until landing built (Option A) |

### 5.2 Post-deploy smoke (Mode A)

| Check | Expected |
|---|---|
| App loads at `https://app.narraza.web.id` | 200 |
| Browser calls `https://api.narraza.web.id/api/health` | Mode A flags |
| Login / safe read endpoints | Work against production Supabase |
| `/credits/topup` | UI may render; checkout **disabled** (`CREDIT_TOPUP_ENABLED=false`) |
| No payment redirect to Duitku | N/A in Mode A |

### 5.3 Web rollback

| Action | Command / path |
|---|---|
| Redeploy previous Pages deployment | Cloudflare Dashboard → Deployments → Rollback |
| Revert `VITE_API_URL` | Rebuild if API URL wrong |
| Detach domain | If catastrophic misroute to staging API |

---

## 6. Future execution checklist (Phases 3–7)

**Gate:** Founder explicit approval required before any phase execution.

```txt
APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY

Scope:
- Provision new production EC2 (not 13.212.245.32)
- Deploy production API Mode A (payment OFF)
- Configure api.narraza.web.id DNS + HTTPS
- Deploy production web narraza.web.id (Cloudflare Pages)
- Integration smoke only

Forbidden:
- CREDIT_TOPUP_ENABLED=true
- PAYMENT_PROVIDER=duitku
- Migration 00010
- Duitku callback registration
- Live payment
```

### Phase 3 — Provision production EC2

| Item | Detail |
|---|---|
| Preflight | Domain registered; founder approval; `.env.production` complete; ref `qjmb…njct` verified |
| Commands | AWS console/CLI: launch instance, EIP, SG; SSH; `sudo bash deploy/ec2/bootstrap-ubuntu.sh` |
| Expected | Docker + Caddy + UFW ready; **no** public 8787 |
| Rollback | Terminate instance if wrong region/account (founder approval) |
| GO/NO-GO | GO when SSH + UFW + Docker PASS |

### Phase 4 — Deploy production API Mode A

| Item | Detail |
|---|---|
| Preflight | `docker-compose.production.yml` + Caddyfile exist; `.env.production` on server |
| Commands | `deploy/ec2/deploy-app.sh` (adapt); `docker compose -f docker-compose.production.yml up -d --build` |
| Expected | `curl http://127.0.0.1:8787/api/health` → Mode A |
| Rollback | `docker compose down`; restore previous tarball |
| GO/NO-GO | GO when local health PASS; NO-GO if payment flags not Mode A |

### Phase 5 — DNS `api.narraza.web.id` + HTTPS

| Item | Detail |
|---|---|
| Preflight | EIP known; A record planned |
| Commands | Create A `api` → EIP; install Caddyfile; `systemctl reload caddy` |
| Expected | `https://api.narraza.web.id/api/health` PASS public |
| Rollback | Remove A record; revert Caddy |
| GO/NO-GO | GO when HTTPS health PASS |

### Phase 6 — Deploy production web `narraza.web.id`

| Item | Detail |
|---|---|
| Preflight | API health public PASS; Pages project created |
| Commands | `npm run build:web` with prod `VITE_*`; `wrangler pages deploy` or CF Git integration |
| Expected | `https://narraza.web.id` serves app |
| Rollback | Pages deployment rollback |
| GO/NO-GO | GO when web build log shows `VITE_API_URL=https://api.narraza.web.id` |

### Phase 7 — Web/API integration smoke

| Item | Detail |
|---|---|
| Preflight | Phases 3–6 GO |
| Commands | Future `operator:production:smoke` or manual: health, auth login, project list |
| Expected | Web → API → production Supabase; payment still OFF |
| Rollback | Revert web API URL or API env |
| GO/NO-GO | GO when smoke PASS; staging still Mode A |

---

## 7. Guardrails (future execution)

Production API/web deploy **cannot proceed** unless:

| Guard | Required |
|---|---|
| Founder approval | `"APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY"` (or successor task) |
| Production Supabase ref | `qjmb…njct` — **not** `jdxyhrnibmmwlbtbokqo` |
| `.env.production` | Gitignored; server-only secrets |
| Payment flags | Mode A OFF |
| Migration `00010` | **Not applied** unless Task 10.19 approval |
| Duitku production vars | **Unset** |
| Domain | `narraza.web.id` zone active; `api.narraza.web.id` A record pending |
| EC2 | **New** instance; not staging `13.212.245.32` |
| Staging | Remains Mode A healthy |

---

## 8. Repo artifacts to add (future task — not 10.22)

| Artifact | Purpose |
|---|---|
| `docker-compose.production.yml` | Production API container |
| `deploy/caddy/Caddyfile.production.example` | `api.narraza.web.id` |
| `scripts/operator-production-api-deploy.ps1` | Operator gate (optional) |
| `scripts/operator-production-smoke.ps1` | Phase 7 smoke |
| `npm run deploy:web:production` | Pages deploy |
| `.env.production.example` web section | Document `VITE_*` for build |

---

## 9. Remaining blockers / TBD

| # | Blocker | Owner |
|---|---|---|
| 1 | `api.narraza.web.id` A record + production EC2 EIP | Operator |
| 2 | Production EC2 + EIP not provisioned | Operator |
| 3 | `docker-compose.production.yml` and prod deploy scripts missing | Engineering |
| 4 | Cloudflare Pages production project not created | Operator |
| 5 | Founder approval for infra execution (Task 10.23) | Founder |
| 6 | Migration `00010` still pending (Task 10.19) — **not** blocker for Mode A deploy | Separate gate |
| 7 | CLI linked to production — relink for staging ops | Operator |

---

## 10. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | Mode A plan, env matrix, EC2/DNS/web plans, Phases 3–7 checklist, rollback, guardrails documented; preflight run; no deploy/migration/payment |
| PARTIAL GO (execution) | Domain + EC2 + Pages project TBD until founder/operator action — expected |
| NO-GO triggers | **None** — staging intact; no secrets in repo/logs; no unauthorized deploy |

---

## Final summary

```txt
Task 10.22 — Production API/Web/DNS Mode A Plan and Preflight
Status: GO

Production Supabase: GO (qjmb…njct, 00001-00009, 00010 excluded)
.env.production: exists, gitignored
CLI link: production (qjmb…njct) — staging relink note documented
DNS api.narraza.web.id: NOT CONFIGURED; narraza.web.id zone exists; narraza.id reserved future
Production API: NOT DEPLOYED
Cloudflare Pages prod: NOT CONFIGURED
Staging: Mode A PASS, untouched

Next: Founder approval → Task 10.23 execute Phases 3-7 (Mode A only)
Then (optional parallel): Task 10.19 for migration 00010 only
Payment enable: still blocked (docs/73)
```