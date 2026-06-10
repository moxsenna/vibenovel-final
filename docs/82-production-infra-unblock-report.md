# 82 — Production Infra Unblock for API/App/Homepage Mode A (Task 10.23a)

**Date:** 2026-06-10  
**Status:** **GO** (superseded) — domain model corrected; completed by Tasks **10.23b** + **10.23c** ([`docs/83`](83-production-ec2-api-mode-a-deploy-report.md), [`docs/84`](84-production-app-custom-domain-verify-report.md))  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/81`](81-production-api-web-mode-a-deploy-report.md), [`docs/80`](80-production-api-web-dns-mode-a-preflight-report.md), [`docs/78`](78-production-environment-foundation-plan.md), [`.agent-logs/sprint-10/task-10.23a-production-infra-unblock.md`](../.agent-logs/sprint-10/task-10.23a-production-infra-unblock.md)

Task 10.23a unblocks infrastructure for production launch with **separated domains**. **Payment NOT enabled.** **Migration `00010` NOT applied.** **No Duitku production setup.**

---

## Final summary

```txt
Task 10.23a — Production Infra Unblock for API/App/Homepage Mode A
Status: PARTIAL GO

Domain model corrected (homepage / app / API split).
AWS credentials: BLOCKED (NoCredentials)
EC2/EIP: NOT provisioned
DNS api/app: NXDOMAIN
Pages preview: PASS
Staging regression: PASS Mode A
Payment: OFF | 00010: NOT APPLIED
```

---

## 1. Domain model (corrected)

| Role | URL | Host |
|---|---|---|
| **Homepage / landing / SEO** | `https://narraza.web.id` | Placeholder/redirect (Option A) — **not dashboard** |
| **App / dashboard** | `https://app.narraza.web.id` | Cloudflare Pages `narraza-web-production` |
| **API** | `https://api.narraza.web.id` | AWS EC2 + Caddy (new instance) |
| Staging API | `https://api-staging.narraza.web.id` | `13.212.245.32` (unchanged) |
| Staging app preview | `https://vibenovel-web-staging.pages.dev` | Unchanged |

**Decision (Option A — Fast MVP):** Attach dashboard to `app.narraza.web.id`. Root `narraza.web.id` remains homepage/landing plan (placeholder or redirect to app until dedicated landing project exists). **Do not** deploy dashboard to apex.

**Option B (deferred):** Separate `narraza-landing-production` (apex) + `narraza-app-production` (app subdomain).

---

## 2. AWS credentials

| Check | Result |
|---|---|
| `aws sts get-caller-identity` | **BLOCKED** — `NoCredentials` |
| `~/.aws/credentials` | **Not present** |
| AWS CLI | Installed (`C:\Program Files\Amazon\AWSCLIV2\aws.exe`) |

**Operator action (no secrets in chat/logs):**

```powershell
aws configure
# or: aws login
aws sts get-caller-identity
```

Expected after valid: account id + ARN visible (document sanitized only).

**EC2 provision STOPPED** until credentials valid.

---

## 3. EC2 / EIP

| Item | Status |
|---|---|
| Production EC2 | **NOT provisioned** |
| Elastic IP | **TBD** |
| Region (planned) | `ap-southeast-1` (per docs/78) |
| Instance name/tag | `narraza-production-api` (recommended) |
| AMI/OS | Ubuntu 24.04 LTS |
| Security group | 22, 80, 443 |
| Staging EC2 reuse | **FORBIDDEN** — `13.212.245.32` |

**Bootstrap (after EC2 exists):**

```bash
sudo bash /opt/vibenovel/deploy/ec2/bootstrap-ubuntu.sh
```

---

## 4. DNS

| Host | Status (2026-06-10) | Target |
|---|---|---|
| `api.narraza.web.id` | **NXDOMAIN** | `<PRODUCTION_EIP>` (A, DNS-only, TTL 300) |
| `app.narraza.web.id` | **NXDOMAIN** | Cloudflare Pages custom domain |
| `narraza.web.id` | **Resolvable** (apex in zone) | Homepage placeholder/redirect plan |
| `api-staging.narraza.web.id` | **PASS** → `13.212.245.32` | **Not touched** |

**Manual DNS (Cloudflare Dashboard):**

1. Zone `narraza.web.id` → DNS → Add record: **A** `api` → production EIP (DNS only).
2. Pages → `narraza-web-production` → Custom domains → `app.narraza.web.id`.
3. Apex `narraza.web.id`: redirect rule or future landing project (not dashboard).

Wrangler OAuth: `zone (read)` only — DNS edit requires Dashboard or API token with DNS edit scope.

---

## 5. Env correction (Mode A)

Updated `.env.production` (gitignored) and `.env.production.example`:

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://narraza.web.id,https://www.narraza.web.id,https://app.narraza.web.id` |
| `CREDIT_TOPUP_ENABLED` | `false` |
| `PAYMENT_PROVIDER` | `mock` |
| `PAYMENT_PROVIDER_MOCK` | `true` |
| `AI_GENERATION_ENABLED` | `false` |
| `VITE_API_URL` | `https://api.narraza.web.id` |
| `VITE_PUBLIC_SITE_URL` | `https://narraza.web.id` |
| `VITE_APP_URL` | `https://app.narraza.web.id` |

Production Supabase ref: `qjmb…njct` (≠ staging). No Duitku production vars.

---

## 6. Cloudflare Pages

| Item | Status |
|---|---|
| Project | `narraza-web-production` |
| Preview URL | `https://03f5654d.narraza-web-production.pages.dev` |
| Preview HTTP | **PASS** 200 |
| App custom domain `app.narraza.web.id` | **PENDING** — Dashboard attach |
| Homepage `narraza.web.id` | **Option A** — placeholder/redirect plan |
| Build script | `scripts/build-production-web.ps1` |
| Bundle staging refs | **NONE** (`api-staging`, staging Supabase absent) |

---

## 7. API deploy

| Item | Status |
|---|---|
| Deploy run | **NOT RUN** — AWS + DNS blockers |
| Task 10.23 approval | Still valid from prior session (verbatim received) |
| `https://api.narraza.web.id/api/health` | **Unreachable** (NXDOMAIN) |

**Deploy command (after infra PASS):**

```powershell
npm run operator:production:aws:deploy -- `
  -Ec2Ip <PRODUCTION_EIP> `
  -ApprovalText "APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY"
```

---

## 8. Staging regression

| Check | Result |
|---|---|
| `GET https://api-staging.narraza.web.id/api/health` | **PASS** Mode A |
| Staging EC2/DB | **Not touched** |

---

## 9. Security notes

| Item | Result |
|---|---|
| Secrets in repo/logs | **NO** |
| `.env.production` committed | **NO** (gitignored) |
| Payment enabled | **NO** |
| Migration `00010` | **NOT applied** |
| Dashboard on root domain | **Prevented** by domain model + docs |

---

## 10. Files changed

| Path | Change |
|---|---|
| `scripts/operator-production-infra-unblock.ps1` | New — Task 10.23a preflight gate |
| `scripts/build-production-web.ps1` | `VITE_PUBLIC_SITE_URL`, `VITE_APP_URL`; app target |
| `scripts/operator-production-aws-deploy.ps1` | App host `app.narraza.web.id`; `build:web:production` |
| `scripts/operator-production-api-web-deploy.ps1` | Three-domain preflight |
| `apps/web/src/vite-env.d.ts` | New VITE env types |
| `.env.production.example` | Domain model + ALLOWED_ORIGINS + VITE_* |
| `.env.production` (gitignored) | `ALLOWED_ORIGINS` includes `app.narraza.web.id` |
| `package.json` | `operator:production:infra:unblock` |
| `scripts/README.md` | Script index |
| `docs/78`, `docs/80`, `docs/81`, `docs/36`, `docs/63`, `README.md` | Domain model updates |

---

## 11. Remaining blockers

| # | Blocker | Owner |
|---|---|---|
| 1 | AWS credentials (`aws configure` / `aws login`) | Operator |
| 2 | Provision production EC2 + EIP (≠ `13.212.245.32`) | Operator |
| 3 | Bootstrap EC2 (`bootstrap-ubuntu.sh`) | Operator |
| 4 | DNS A `api.narraza.web.id` → production EIP | Operator (Cloudflare) |
| 5 | Attach `app.narraza.web.id` to Pages | Operator (Cloudflare) |
| 6 | Apex `narraza.web.id` homepage/redirect | Operator (optional for MVP) |
| 7 | Run `operator:production:aws:deploy` | Operator |

---

## 12. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **PARTIAL GO** | Domain model + env + app build + Pages preview + staging PASS; AWS/EC2/DNS/API pending |
| BLOCKED | AWS credentials; EC2 provision; `api`/`app` DNS |
| NO-GO triggers | **None** — payment OFF; staging intact; no secrets exposed |

---

## Next recommended command

```powershell
# 1. Unblock AWS (operator machine, no secrets in chat)
aws configure
aws sts get-caller-identity

# 2. Re-run infra preflight
npm run operator:production:infra:unblock

# 3. After EC2+EIP+DNS api -> EIP:
npm run operator:production:aws:deploy -- `
  -Ec2Ip <PRODUCTION_EIP> `
  -ApprovalText "APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY"
```

**Follow-up Task 10.23b:** [`docs/83`](83-production-ec2-api-mode-a-deploy-report.md) — **GO** (HTTPS API Mode A live).