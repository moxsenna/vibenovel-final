# 81 — Production API/Web Mode A Deploy on narraza.web.id (Task 10.23)

**Date:** 2026-06-10  
**Status:** **GO** (superseded) — initial Pages deploy; completed by Tasks **10.23b** ([`docs/83`](83-production-ec2-api-mode-a-deploy-report.md)) + **10.23c** ([`docs/84`](84-production-app-custom-domain-verify-report.md))  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/80`](80-production-api-web-dns-mode-a-preflight-report.md), [`docs/78`](78-production-environment-foundation-plan.md), [`docs/79`](79-production-supabase-baseline-setup-report.md), [`.agent-logs/sprint-10/task-10.23-production-api-web-mode-a-deploy.md`](../.agent-logs/sprint-10/task-10.23-production-api-web-mode-a-deploy.md)

Task 10.23 rerun #2 with founder approval. **Domain model superseded by Task 10.23a** — see [`docs/82`](82-production-infra-unblock-report.md): homepage `narraza.web.id`, app `app.narraza.web.id`, API `api.narraza.web.id`.

**Payment NOT enabled.** **Migration `00010` NOT applied.** **No Duitku callback.** **No live payment.**

---

## 1. Domain correction

| Role | URL |
|---|---|
| Homepage / landing | `https://narraza.web.id` (not dashboard — see docs/82) |
| App / dashboard | `https://app.narraza.web.id` |
| Production API | `https://api.narraza.web.id` |
| Future reserved | `narraza.id` / `api.narraza.id` |
| Staging API | `https://api-staging.narraza.web.id` |
| Staging web | `https://vibenovel-web-staging.pages.dev` |

---

## 2. Approval gate

| Item | Result |
|---|---|
| Required text | `APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY` |
| **Approval received** | **YES** — verbatim in session rerun #2 |
| EC2 provision | **NOT executed** — `aws sts get-caller-identity` → `NoCredentials`; no `~/.aws/credentials` |
| DNS `api` record | **NOT created** — `api.narraza.web.id` → NXDOMAIN (`nslookup 8.8.8.8`); wrangler OAuth has `zone (read)` only |

---

## 3. Preflight (rerun #2)

| Check | Result |
|---|---|
| `.env.production` gitignored | **PASS** |
| Production Supabase `qjmb…njct` | **PASS** (≠ staging `jdxyhrnibmmwlbtbokqo`) |
| Mode A env flags | **PASS** |
| `ALLOWED_ORIGINS` | **PASS** — `narraza.web.id` |
| `api.narraza.web.id` DNS | **FAIL** — non-existent domain |
| AWS credentials | **Missing** |
| Staging regression | **PASS** — Mode A |
| Staging EC2 reuse | **NO** — `api-staging` still → `13.212.245.32` only |

---

## 4. Production API (not deployed)

| Item | Value |
|---|---|
| EC2 | **Not provisioned** — operator must create new instance (≠ `13.212.245.32`) |
| EIP/IP | **TBD** |
| DNS | `api.narraza.web.id` — **no A record** (NXDOMAIN) |
| HTTPS/Caddy | **Not configured** |
| `GET https://api.narraza.web.id/api/health` | **Unreachable** |

### Operator script (ready)

```powershell
# After EC2 + EIP + DNS api -> EIP + SSH key on production host:
npm run operator:production:aws:deploy -- `
  -Ec2Ip <PRODUCTION_EIP> `
  -ApprovalText "APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY"
```

Artifacts: `docker-compose.production.yml`, `deploy/caddy/Caddyfile.production.example`, `deploy/ec2/deploy-app-production.sh`, `scripts/operator-production-aws-deploy.ps1`.

---

## 5. Production web (deployed — apex domain pending)

| Item | Value |
|---|---|
| Pages project | **`narraza-web-production`** |
| Latest deployment URL | `https://03f5654d.narraza-web-production.pages.dev` |
| Build script | `scripts/build-production-web.ps1` → `npm run build:web:production` |
| Build `VITE_API_URL` | `https://api.narraza.web.id` |
| Build Supabase ref | `qjmb…njct` (production) |
| Build uses staging API | **NO** — bundle grep: no `api-staging`, no `jdxyhrnibmmwlbtbokqo` |
| `narraza.web.id` custom domain | **Pending** — attach in Cloudflare Dashboard → Pages → `narraza-web-production` → Custom domains |
| Load check (Pages URL) | **PASS** — HTTP 200 |

```powershell
npm run deploy:web:production
```

**Fix (rerun #2):** prior deploy accidentally baked `apps/web/.env.local` (staging Supabase). `build-production-web.ps1` now forces production `VITE_*` from `.env.production`.

---

## 6. Final production flags

| Flag | Target | Current |
|---|---|---|
| `creditTopupEnabled` | `false` | N/A (API not live) |
| `paymentProviderMock` | `true` | N/A |
| `paymentProvider` | `mock` | N/A |
| `aiGenerationEnabled` | `false` | N/A |

Web build configured for production API URL; integration smoke **blocked** until API HTTPS live.

---

## 7. Staging regression

| Check | Result |
|---|---|
| `api-staging.narraza.web.id/api/health` | **PASS** Mode A |
| Staging DB | **Not touched** |
| Staging EC2 | **Not reused** for production |

---

## 8. Verification

| Item | Result |
|---|---|
| Payment enabled | **NO** |
| Migration `00010` | **NO** |
| Secrets in repo/logs | **NO** |
| `.env.production` committed | **NO** |

---

## 9. Rollback

| Layer | Action |
|---|---|
| Pages web | Cloudflare → `narraza-web-production` → rollback deployment |
| API (future) | `docker compose -f docker-compose.production.yml down` on prod EC2 |
| DNS | Remove `api` A record when rolling back API |

---

## 10. Remaining blockers (full GO)

| # | Blocker | Owner |
|---|---|---|
| 1 | Configure **AWS credentials** on operator machine (`aws configure` or `aws login`) | Operator |
| 2 | Provision **new** production EC2 + EIP in `ap-southeast-1` (≠ `13.212.245.32`) | Operator |
| 3 | DNS A `api.narraza.web.id` → production EIP (Cloudflare dashboard or API token with DNS edit) | Operator |
| 4 | Run `operator:production:aws:deploy` with `-Ec2Ip <PRODUCTION_EIP>` | Operator |
| 5 | Attach `narraza.web.id` to Pages project `narraza-web-production` | Operator (Cloudflare dashboard) |

---

## 11. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **PARTIAL GO** | Approval + corrected web Pages deploy + deploy tooling; API/DNS/apex domain pending |
| NO-GO triggers | **None** — payment OFF; staging intact; no secrets exposed |

---

## Final summary

```txt
Task 10.23 — Production API/Web Mode A Deploy (rerun #2)
Status: PARTIAL GO

Approval: YES
Launch: narraza.web.id + api.narraza.web.id
Production API: NOT DEPLOYED (no AWS creds / no EC2 / no DNS)
Production web: Pages narraza-web-production — corrected build + deploy
Staging: Mode A PASS
Payment: OFF
00010: NOT APPLIED

Next: AWS creds → EC2+EIP → DNS api -> EIP → operator:production:aws:deploy → attach app.narraza.web.id to Pages

Follow-up 10.23b: docs/83 — GO (API live)
Follow-up 10.23c: docs/84 — GO (app.narraza.web.id verified)
```