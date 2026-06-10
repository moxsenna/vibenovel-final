# 78 — Production Environment Foundation Plan (Task 10.20)

**Date:** 2026-06-10  
**Status:** Closed — **GO** (plan complete; **no production execution**)  
**Update (Task 10.22):** Preflight + Phases 3–7 execution checklist in [`docs/80`](80-production-api-web-dns-mode-a-preflight-report.md); Supabase Phase 1–2 **GO** per [`docs/79`](79-production-supabase-baseline-setup-report.md).  
**Update (Task 10.23):** Production **launch** domain is **`narraza.web.id`** / **`api.narraza.web.id`** — not `narraza.id` (reserved for future migration).
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/77`](77-production-payment-preflight-migration-approval-gate.md), [`docs/73`](73-duitku-production-payment-enable-plan.md), [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md), [`docs/76`](76-redeploy-staging-api-rpc-grant-integration-report.md), [`.agent-logs/sprint-10/task-10.20-production-environment-foundation-plan.md`](../.agent-logs/sprint-10/task-10.20-production-environment-foundation-plan.md)

Docs-only planning task: define production topology, operator checklists, env matrix, deployment sequence, and risk register so Tasks 10.19+ and docs/73 enablement have clear targets. **Production NOT deployed.** **Production payment OFF.**

---

## 1. Environment separation audit (current state)

### 1.1 Env files

| File | Purpose | Committed | Notes |
|---|---|---|---|
| `.env.staging.example` | Staging template (Mode A) | Yes | Operator copies → `.env.staging` |
| `.env.staging.duitku.example` | Duitku Mode B template | Yes | Sandbox only |
| `.env.staging` | EC2/Docker staging secrets | **No** (gitignored) | Supabase ref `jdxyhrnibmmwlbtbokqo` |
| `.env.staging.duitku` | Duitku sandbox keys | **No** | Task 10.13b operator file |
| `apps/web/.env.example` | Local web template | Yes | `VITE_*` only; no service role |
| `apps/web/.env.local` | Local/staging web build | **No** | Currently staging Supabase |
| `apps/api/.dev.vars` / `.dev.vars.example` | Local API Worker | example yes | Development only |
| `.env.production` | Production secrets | **Operator file** (gitignored) | Created Task 10.21; never commit |

### 1.2 Cloudflare (staging only)

| Asset | Name / URL | Production |
|---|---|---|
| Worker API | `vibenovel-api-staging` → `vibenovel-api-staging.moxsenna.workers.dev` | **Not configured** |
| Pages web | `vibenovel-web-staging` → `vibenovel-web-staging.pages.dev` | **Not configured** |
| Wrangler env | `[env.staging]` in `apps/api/wrangler.toml` | No `[env.production]` |
| Deploy scripts | `deploy:api:staging`, `deploy:web:staging` | No `deploy:*:production` |

### 1.3 AWS / Caddy (staging only)

| Item | Staging | Production |
|---|---|---|
| EC2 | `13.212.245.32` (dedicated staging) | **Not provisioned** |
| App dir | `/opt/vibenovel` + `.env.staging` | Planned `/opt/vibenovel` on **separate** instance |
| Compose | `docker-compose.staging.yml` | Planned `docker-compose.production.yml` (future) |
| Caddy | `api-staging.narraza.web.id` (Let's Encrypt) | Planned `api.narraza.web.id` |
| Operator scripts | `operator-aws-*` (all staging-targeted) | **None** for production |

### 1.4 Supabase

| Item | Staging | Production |
|---|---|---|
| Project ref | `jdxyhrnibmmwlbtbokqo` | `qjmb…njct` (**GO** Task 10.21) |
| CLI link | Linked staging (`00001`–`00010`) | May be linked production — relink for staging ops |
| Local dev | `project_id = vibenovel-local` in `config.toml` | N/A |
| Operator scripts | `operator:staging:supabase-gate`, `operator:staging:atomic-grant` | **None** |

### 1.5 Deploy / operator scripts (staging vs production)

| Script / npm command | Target |
|---|---|
| `deploy:api:staging` | Cloudflare Worker staging |
| `deploy:web:staging` | Cloudflare Pages staging |
| `operator:aws:staging:smoke` | AWS staging API |
| `operator:aws:https:gate` | Staging HTTPS + web rebuild |
| `operator:aws:duitku:gate` | Staging Mode B Duitku |
| `operator:staging:supabase-gate` | Hosted staging Supabase |
| `smoke:staging` | Portable staging smoke harness |
| **Production equivalents** | **Do not exist yet** |

### 1.6 Current staging (healthy — read-only verified)

| Surface | URL |
|---|---|
| API | `https://api-staging.narraza.web.id` |
| Web | `https://vibenovel-web-staging.pages.dev` |
| Supabase | `jdxyhrnibmmwlbtbokqo` |
| Mode A | `creditTopupEnabled=false`, `paymentProviderMock=true`, `paymentProvider=mock`, `aiGenerationEnabled=false` |

### 1.7 Missing production setup

- Production Supabase project
- Production EC2 (or alternate API host) + Elastic IP
- DNS for production launch `narraza.web.id` / `api.narraza.web.id` (`api` record pending Task 10.23); `narraza.id` reserved future
- `.env.production`, `docker-compose.production.yml`, `[env.production]` wrangler block
- `deploy:api:production`, `deploy:web:production`, `operator:*:production` scripts
- Duitku production callback registration (deferred)

### 1.8 Risk if production shares staging resources

| Shared resource | Consequence |
|---|---|
| Same Supabase project | Staging smoke/test orders pollute production; migration mistakes affect live users |
| Same EC2 instance | Env flip could expose payment on wrong domain; deploy rollback affects both |
| Same API URL in web build | Users pay against staging DB; callbacks misrouted |
| Same Duitku merchant/callback | Sandbox callbacks on production URL or vice versa |
| Copy-paste `.env.staging` → production | Wrong DB + leaked staging keys in prod |

### 1.9 Required separation (mandatory)

```txt
Staging                          Production
─────────────────────────────────────────────────────────
jdxyhrnibmmwlbtbokqo      ≠     <new-production-ref>
api-staging.narraza.web.id ≠     api.narraza.web.id
narraza.web.id (staging)   ≠     narraza.id
EC2 13.212.245.32          ≠     new EC2 + EIP
.env.staging               ≠     .env.production
Duitku sandbox             ≠     Duitku production (later)
```

---

## 2. Production topology (target)

```mermaid
flowchart TB
  subgraph users [Users]
    U[Browser / mobile web]
  end
  subgraph cf [Cloudflare]
    W[Pages: narraza.web.id]
    WF[Optional Worker fallback — defer unless needed]
  end
  subgraph aws [AWS — separate EC2 from staging]
    C[Caddy TLS :443]
    D[Docker API Node :8787]
    E[/opt/vibenovel/.env.production]
  end
  subgraph sb [Supabase hosted]
    P[(narraza-production DB)]
  end
  subgraph pay [Payment — later only]
    DK[Duitku POP production]
  end
  U --> W
  W -->|VITE_API_URL| C
  C --> D
  D --> P
  DK -.->|callback later| C
```

| Layer | Target | Host choice | Notes |
|---|---|---|---|
| **Homepage** | `https://narraza.web.id` | Cloudflare Pages or static placeholder | Marketing/SEO — **not** the dashboard (Task 10.23a) |
| **App** | `https://app.narraza.web.id` | **Cloudflare Pages** (`narraza-web-production`) | `VITE_API_URL=https://api.narraza.web.id`; `VITE_APP_URL=https://app.narraza.web.id` |
| **API** | `https://api.narraza.web.id` | **AWS EC2 + Docker + Caddy** (recommended — proven staging path) | **New instance** — not `13.212.245.32`; container binds `127.0.0.1:8787` only |
| **DB** | Dedicated Supabase | Hosted Supabase new project | **Never** `jdxyhrnibmmwlbtbokqo` |
| **Payment** | Duitku POP BCA VA-first | Deferred | Callback: `https://api.narraza.web.id/api/payments/duitku/callback`; **OFF** until docs/73 §7 |

**Cloudflare Worker fallback:** Optional for production. Staging keeps Worker as regression baseline only. Production MVP can be AWS-primary without Worker unless founder wants dual-path.

---

## 3. Production Supabase — operator checklist

> **Gate:** Founder must approve **Phase 0** (§6) before any step below. Do **not** create project without explicit approval.

### A. Create / designate production project

| Step | Action | Verification |
|---|---|---|
| A1 | In Supabase dashboard, create project name e.g. **`narraza-production`** | Name visible in dashboard only |
| A2 | Choose region — **recommend `ap-southeast-1` (Singapore)** or same region as staging for operator familiarity | Document choice in ops log |
| A3 | Record project ref — **must NOT be `jdxyhrnibmmwlbtbokqo`** | Write ref to gitignored operator notes only |
| A4 | Set strong DB password → store in password manager only | Never commit |
| A5 | Enable Auth (email) + required settings per product | Match staging auth patterns |
| A6 | Confirm billing/organization is production-ready | Founder sign-off |

### B. Link CLI safely (avoid staging overwrite)

| Step | Action |
|---|---|
| B1 | **Unlink or use separate working directory** if unsure which project is linked |
| B2 | Run `supabase projects list` — identify production ref visually |
| B3 | **STOP** if ref = `jdxyhrnibmmwlbtbokqo` |
| B4 | Link production only: `supabase link --project-ref <PRODUCTION_REF>` |
| B5 | Verify: `supabase migration list --linked` — expect **no rows** or only baseline if fresh |
| B6 | Optional: use `SUPABASE_ACCESS_TOKEN` in CI/operator shell only — never repo |

**Safe placeholder commands (operator fills ref):**

```bash
# VERIFY ref in dashboard first — NOT jdxyhrnibmmwlbtbokqo
supabase link --project-ref <PRODUCTION_PROJECT_REF>
supabase migration list --linked
```

### C. Apply baseline migrations (through `00009` only initially)

| Step | Action |
|---|---|
| C1 | Confirm local migration files `00001`–`00009` present |
| C2 | Apply `00001`–`00009` only — **do not** plain `db push` without excluding `00010` (see [`docs/79`](79-production-supabase-baseline-setup-report.md) §5 Method A) |
| C3 | If `00010` already in remote from mistake — **STOP**, founder incident review |
| C4 | Verify tables: `credit_topup_orders`, `credit_ledger`, `credit_balances`, `payment_webhook_events`, `credit_topup_products` |
| C5 | Verify RLS policies from migrations applied (no manual weakening) |
| C6 | `supabase migration list --linked` — `00009` remote match; `00010` **pending** until approved |

**Migration order:** `00001` → `00002` → … → `00009` → *(gate)* → `00010`

### D. Seed / config

| Rule | Action |
|---|---|
| No staging data copy | Do **not** copy users/orders/ledger from staging unless founder explicitly approves migration project |
| Topup products | Migration `00009` seed provides `starter`, `creator`, `pro`, `studio` — sufficient for MVP |
| No fake payment rows | No test `paid` orders in production before go-live |
| Secrets | Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to `.env.production` only |

---

## 4. Domain / DNS plan

**DNS status (read-only, Task 10.20):** `narraza.id`, `api.narraza.web.id` — **not resolved** (domain likely not registered or DNS not configured).

### 4.1 Records (recommended)

| Host | Type | Target | Proxy | Notes |
|---|---|---|---|---|
| `narraza.id` | A or CNAME | Cloudflare Pages | Proxied OK | Pages custom domain wizard |
| `www.narraza.id` | CNAME | `narraza.id` or Pages | Proxied OK | 301 redirect to apex (recommended) |
| `api.narraza.web.id` | A | `<production-ec2-eip>` | **DNS only** initially | Matches staging LE pattern ([`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md)) |

**Staging contrast (do not reuse for production):**

| Host | Target |
|---|---|
| `api-staging.narraza.web.id` | `13.212.245.32` |
| `narraza.web.id` | Staging apex (temporary) |

### 4.2 HTTPS

| Surface | Method |
|---|---|
| API | Caddy on EC2 — automatic Let's Encrypt for `api.narraza.web.id` |
| Web | Cloudflare Pages — automatic edge TLS for `narraza.id` |

**Caddy snippet (future — on production EC2):**

```caddyfile
api.narraza.web.id {
    reverse_proxy 127.0.0.1:8787
}
```

### 4.3 ACME / callback considerations

| Item | Guidance |
|---|---|
| Caddy ACME | Prefer **DNS-only** (grey cloud) for `api` A record during first cert issuance if orange-cloud breaks HTTP-01 |
| Duitku callback | Must be **public HTTPS** `https://api.narraza.web.id/api/payments/duitku/callback` — register only after API health PASS (docs/73 Phase 4) |
| Do not point production callback at staging host | Separate URL mandatory |

### 4.4 Health check target

```txt
GET https://api.narraza.web.id/api/health
Expected (Mode A initial deploy):
  creditTopupEnabled=false
  paymentProviderMock=true
  paymentProvider=mock
  aiGenerationEnabled=false
```

### 4.5 DNS rollback

| Step | Action |
|---|---|
| 1 | Lower TTL to 300 before cutover |
| 2 | Rollback: point `api.narraza.web.id` A record to previous IP or remove |
| 3 | Rollback web: revert Pages custom domain or point to maintenance page |
| 4 | Keep Supabase project unchanged during DNS rollback |

---

## 5. Production env matrix (names only — no values)

### 5.1 API production (`.env.production` on EC2)

| Variable | Initial safe value | Later payment enable | In repo? |
|---|---|---|---|
| `APP_ENV` | `production` | unchanged | Example template only |
| `PORT` | `8787` | unchanged | Yes (example) |
| `SUPABASE_URL` | *production URL* | unchanged | **Never** |
| `SUPABASE_ANON_KEY` | *production anon* | unchanged | **Never** |
| `SUPABASE_SERVICE_ROLE_KEY` | *production service role* | unchanged | **Never** |
| `ALLOWED_ORIGINS` | `https://narraza.web.id,https://www.narraza.web.id,https://app.narraza.web.id` | Task 10.23a | Homepage + app CORS |
| `CREDIT_TOPUP_ENABLED` | `false` | `true` only after docs/73 Phase 5 Go | Example only |
| `PAYMENT_PROVIDER` | `mock` | `duitku` after Go | Example only |
| `PAYMENT_PROVIDER_MOCK` | `true` | `false` after Go | Example only |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` | n/a when mock off | Example only |
| `AI_GENERATION_ENABLED` | `false` | per separate AI Go | Example only |
| `AI_PROVIDER_MOCK` | `true` | per AI Go | Example only |
| `DUITKU_ENV` | *unset* | `production` | **Never** |
| `DUITKU_MERCHANT_CODE` | *unset* | from Duitku prod dashboard | **Never** |
| `DUITKU_MERCHANT_KEY` | *unset* | from Duitku prod dashboard | **Never** |
| `DUITKU_CALLBACK_URL` | *unset* | `https://api.narraza.web.id/api/payments/duitku/callback` | Example only |
| `DUITKU_RETURN_URL` | *unset* | `https://narraza.web.id/credits/topup/return` | Example only |
| `DUITKU_SMOKE_CALLBACK_FIXTURE` | **must be unset/false** | **never true in production** | — |

**Forbidden in git:** all `SUPABASE_*` keys, `DUITKU_*` secrets, `OPENROUTER_API_KEY`, `MAYAR_API_KEY`.

### 5.2 Web production (build-time)

| Variable | Initial value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://api.narraza.web.id` | Baked at `npm run build:web:production` |
| `VITE_PUBLIC_SITE_URL` | `https://narraza.web.id` | Homepage/marketing URL |
| `VITE_APP_URL` | `https://app.narraza.web.id` | App/dashboard canonical URL |
| `VITE_SUPABASE_URL` | *production Supabase URL* | Public anon key only |
| `VITE_SUPABASE_ANON_KEY` | *production anon* | Never service role |
| `VITE_USE_MOCKS` | `false` | Production must use real API |

**Forbidden in web env:** `SUPABASE_SERVICE_ROLE_KEY`, payment keys, Duitku secrets.

### 5.3 Operator shell (optional, gitignored)

| Variable | Purpose |
|---|---|
| `PRODUCTION_SUPABASE_URL` | Smoke scripts (future) — mirror `STAGING_SUPABASE_*` pattern |
| `PRODUCTION_SUPABASE_ANON_KEY` | Smoke scripts |
| `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` | Operator verification only — never web |

---

## 6. Deployment sequence (plan only — do not execute in 10.20)

| Phase | Action | Owner | Payment state |
|---|---|---|---|
| **0** | Founder approves production **infra** setup (this doc) | Founder | OFF |
| **1** | Create production Supabase (§3A) | Operator | OFF |
| **2** | Link CLI + `db push` migrations `00001`–`00009` (§3C) | Operator | OFF |
| **3** | Provision **new** production EC2 + EIP + security group (22/80/443) | Operator | OFF |
| **4** | DNS `api.narraza.web.id` → production EIP; Caddy + Docker deploy API Mode A | Operator | OFF |
| **5** | `GET /api/health` PASS on production API | Operator | OFF |
| **6** | Cloudflare Pages production project + `narraza.id`; build with prod `VITE_*` | Operator | OFF |
| **7** | Smoke: login, project list, health — web → production API → production DB | Operator | OFF |
| **8** | Rerun **Task 10.19** with approval `"APPROVE TASK 10.19 PRODUCTION MIGRATION 00010 ONLY"` | Founder + Operator | OFF |
| **9** | Continue **docs/73 §7** payment enablement only after 8 + remaining gates | Founder | Gated |

**Explicit non-goals for Phases 0–7:** Duitku production credentials, callback registration, `CREDIT_TOPUP_ENABLED=true`, live payment.

### Go/No-Go criteria for production foundation (Phases 0–7)

| Criterion | Required |
|---|---|
| Production Supabase ref ≠ staging ref | Yes |
| Migrations through `00009` applied | Yes |
| Production API health Mode A | Yes |
| Web uses `VITE_API_URL=https://api.narraza.web.id` | Yes |
| No secrets in git | Yes |
| Staging still Mode A healthy | Yes |
| `00010` applied | **No** — wait for Task 10.19 |
| Payment enabled | **No** |

---

## 7. Risk register

| Risk | Impact | Mitigation | Verification |
|---|---|---|---|
| Staging/prod Supabase confusion | Wrong migration / data leak | Visual ref check; separate `.env.production`; never reuse `jdxyhrnibmmwlbtbokqo` | `migration list --linked` + dashboard ref |
| Wrong project `db push` | Schema damage | Unlink/relink ritual; approval gate; two-person review | Pre-push ref log |
| Secret leak to git | Credential exposure | `.gitignore` `.env.production`; pre-commit review; docs only names | `git grep` for `service_role`, `eyJ` |
| DNS misrouting | Web hits staging API | Separate build job with prod `VITE_API_URL`; smoke asserts API host | curl health Host header |
| Callback URL wrong | Payments lost or to staging | Register only on `api.narraza.web.id` after health; docs/73 checklist | Dashboard screenshot (sanitized) |
| Payment enabled before legal/SOP | Compliance risk | `CREDIT_TOPUP_ENABLED=false` until Phase 5; docs/73 §5 gates | Health endpoint flags |
| Production DB missing migrations | Runtime 500 on payment | Apply `00001`–`00009` before deploy; migration list match | `supabase migration list` |
| Web points to staging API | User data on wrong DB | Dedicated Pages prod project; build log shows `VITE_API_URL` | Network tab / smoke |
| Staging data copied to prod | Test users in production | No copy unless approved; empty prod start | Row count audit |
| Reuse staging EC2 | Env cross-contamination | **New** EC2 for production | Instance ID ≠ `13.212.245.32` |
| `DUITKU_SMOKE_CALLBACK_FIXTURE=true` in prod | Fake grants | Forbidden in production matrix | Health `duitkuSmokeCallbackFixture=false` |

---

## 8. Relationship to Task 10.19

Task 10.19 was **BLOCKED** because production Supabase and domains did not exist ([`docs/77`](77-production-payment-preflight-migration-approval-gate.md)).

**Unblock path:**

1. Execute Phases **0–2** of this doc (infra approval + Supabase + migrations through `00009`).
2. Optionally Phases **3–7** (API/web foundation) before or in parallel with `00010`.
3. Rerun Task 10.19 with founder approval for **`00010` only**.
4. Only then proceed to docs/73 payment enablement.

---

## 9. Remaining TBD (external)

| Item | Owner |
|---|---|
| `narraza.id` domain registration / registrar account | Founder |
| Production EC2 instance size / region (recommend `ap-southeast-1`, t3.small or free-tier) | Operator |
| Cloudflare Pages production project name (suggest `narraza-web-production`) | Operator |
| Whether production needs Worker fallback | Founder |
| Legal/business gates in docs/73 §5A | Founder |

---

## 10. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | Plan, topology, checklists, env matrix, sequence, risks documented; no production touched |
| PARTIAL GO | Some TBDs remain (domain registrar, exact EIP) — expected; plan still actionable |
| NO-GO triggers | None — no deploy, no migration, no secrets exposed |

---

## Final summary

```txt
Task 10.20 — Production Environment Foundation Plan
Status: GO (plan only)

Topology: Pages narraza.id → API api.narraza.web.id (new EC2+Caddy) → new Supabase
Staging: unchanged Mode A (jdxyhrnibmmwlbtbokqo, api-staging.narraza.web.id)
Production: NOT deployed; payment OFF

Next: Founder approval Task 10.23 → execute Phases 3–7 per docs/80 (Phases 1–2 GO per docs/79)
Then: Task 10.19 for migration 00010 (separate approval)
```