# 69 — AWS HTTPS Domain & Web-to-AWS API Report (Task 11.6)

**Date:** 2026-06-09  
**Status:** **COMPLETE / GO FULL** — AWS HTTPS + Web-to-AWS staging  
**Verdict:** HTTPS live; web staging rebuilt to AWS API; full smoke + Cloudflare regression **PASS**  
**Related:** [`docs/68`](68-aws-ec2-api-staging-deploy-report.md), [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md), [`docs/63`](63-updated-product-roadmap-after-sprint-11.md), [`.agent-logs/sprint-11/task-11.6-aws-https-domain-web-to-aws-api.md`](../.agent-logs/sprint-11/task-11.6-aws-https-domain-web-to-aws-api.md)

Task 11.6 enables **HTTPS** on `api-staging.narraza.web.id`, verifies smoke, rebuilds **Cloudflare Pages web** to point at AWS API, and confirms Cloudflare Worker API fallback remains healthy. **Mode A only.** **No payment/AI live.**

---

## Brand & domain (founder decision 2026-06-09)

| Item | Value |
|---|---|
| **Product brand (user-facing)** | **Narraza** |
| **Tagline** | Build long fiction without losing the plot. |
| **Historical names** | VibeNovel / Novory — repo/code identifiers only; **not** product-facing brand |
| **Staging apex (temporary)** | `narraza.web.id` — MVP/staging phase; **not** final production domain |
| **Future production domain** | `narraza.id` (planned after product traction) |

### Staging endpoints (current)

| Surface | URL | Notes |
|---|---|---|
| **API (primary)** | `https://api-staging.narraza.web.id` | AWS EC2 + Caddy + Let's Encrypt |
| **Web** | `https://vibenovel-web-staging.pages.dev` | Cloudflare Pages; **`VITE_API_URL` → AWS HTTPS API** |
| **API fallback** | `https://vibenovel-api-staging.moxsenna.workers.dev` | Cloudflare Worker — regression baseline only |

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| DNS A → `13.212.245.32` | Duitku/Mayar callback registration |
| Caddy auto-HTTPS (Let's Encrypt) | `CREDIT_TOPUP_ENABLED=true` |
| Web `VITE_API_URL` → AWS HTTPS | Production deploy |
| Full staging smoke (HTTPS + web-to-AWS) | Hermes instance |

---

## 2. Preflight result (EC2)

Verified **2026-06-09** (Task 11.5 baseline + 11.6 post-Caddy):

| Check | Result |
|---|---|
| Docker local `127.0.0.1:8787` | **PASS** — healthy |
| Port 8787 binding | **PASS** — `127.0.0.1:8787` only (not public) |
| UFW | **PASS** — OpenSSH, 80, 443 |
| Caddy | Hostname HTTPS (`api-staging.narraza.web.id`) |
| Mode A flags | **PASS** |

**Note:** After hostname-only Caddy config, `http://13.212.245.32/api/health` is **no longer valid**. Use HTTPS hostname or SSH docker health (see script fixes §15).

---

## 3. DNS record

**Required (operator):**

| Field | Value |
|---|---|
| Type | A |
| Name | `api-staging` |
| Value | `13.212.245.32` |
| TTL | 300 or Auto |

**Configured (2026-06-09):**

| Host | A record |
|---|---|
| `api-staging.narraza.web.id` | `13.212.245.32` |

Apex domain: `narraza.web.id`

Verify:

```powershell
nslookup api-staging.<domain>
# Expected: 13.212.245.32
```

**Cloudflare DNS tip:** start **DNS only** (grey cloud) for Let's Encrypt; enable proxy later if desired.

---

## 4. Caddy HTTPS config

Template (deployed by gate script):

```caddy
api-staging.narraza.web.id {
	reverse_proxy 127.0.0.1:8787
}
```

**Caddyfile rule:** space required before `{` (`hostname {` not `hostname{`).

Manual on EC2:

```bash
sudo nano /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 5. HTTPS health result

| Target | Status |
|---|---|
| `https://api-staging.narraza.web.id/api/health` | **PASS** |

Live flags: `ok=true`, `appEnv=staging`, Supabase flags true, `creditTopupEnabled=false`, `paymentProviderMock=true`.

---

## 6. Task 11.6 verification checklist (founder acceptance)

| # | Check | Result |
|---|---|---|
| 1 | DNS `api-staging.narraza.web.id` → `13.212.245.32` | **PASS** |
| 2 | Caddy + Let's Encrypt HTTPS | **PASS** |
| 3 | `https://api-staging.narraza.web.id/api/health` Mode A safe | **PASS** |
| 4 | AWS HTTPS smoke | **PASS** |
| 5 | Web rebuild `VITE_API_URL` → AWS | **PASS** |
| 6 | Web-to-AWS smoke (after Pages propagation) | **PASS** |
| 7 | Cloudflare Worker API regression | **PASS** |

## 7. AWS HTTPS smoke result

| Command | Status |
|---|---|
| `operator:aws:staging:smoke` HTTPS | **PASS** |
| `operator:aws:https:gate` full | **PASS** (web-to-AWS retry after Pages propagation) |

---

## 8. Web rebuild result

| Item | Status |
|---|---|
| `VITE_API_URL=https://api-staging.narraza.web.id` | **PASS** |
| `wrangler pages deploy` (vibenovel-web-staging) | **PASS** |

Web staging now targets **AWS HTTPS API**.

---

## 9. Web-to-AWS smoke result

**PASS** — full `smoke-staging.ps1` against AWS API + Pages web (retry after deploy propagation).

---

## 10. Cloudflare fallback regression

Baseline (HTTP AWS from 11.5):

- `operator:aws:staging:smoke` against `http://13.212.245.32` — **PASS** (prior session)
- `smoke:staging:health` Cloudflare Worker — **PASS** (preflight this session)

Full CF `IncludeApiMode` regression after web→AWS: **PASS** (`vibenovel-api-staging.moxsenna.workers.dev`).

---

## 11. Security checks

| Check | Status |
|---|---|
| Port 8787 not public on SG | **PASS** (Docker binds localhost) |
| `.env.staging` chmod 600 on EC2 | **Assumed** (11.5) |
| No secrets in repo/docs | **PASS** |
| Payment/AI disabled | **PASS** |
| Cloudflare Worker still deployed | **PASS** |

---

## 12. Limitations still in force

| Item | Status |
|---|---|
| Production payment | **NOT READY** |
| Duitku sandbox live | **NOT RUN** — next: Task 10.13b |
| Mayar live | **NOT RUN** |
| Production payment/provider dashboards | **Do not enable** |
| Domain `narraza.web.id` | **Temporary** staging/MVP — migrate to `narraza.id` when ready |
| Mode A safe flags | `CREDIT_TOPUP_ENABLED=false`, `PAYMENT_PROVIDER_MOCK=true`, `AI_GENERATION_ENABLED=false` |

---

## 13. Go / No-Go

| Level | Verdict |
|---|---|
| **COMPLETE / GO FULL AWS web-to-AWS** | **YES** — founder accepted 2026-06-09 |
| **PARTIAL GO** | N/A — full gate complete |
| **BLOCKED** | **NO** |

---

## 14. Script fixes (recorded)

| Fix | Detail |
|---|---|
| Caddyfile spacing | Space before `{` required (`api-staging.narraza.web.id {`) |
| Preflight fallbacks | HTTPS hostname → SSH `curl 127.0.0.1:8787/api/health` when IP-only HTTP invalid |
| PowerShell TLS | `[Net.ServicePointManager]::SecurityProtocol = Tls12` |
| Let's Encrypt wait | 20s sleep after Caddy reload on first issuance |

Gate script: `scripts/operator-aws-https-web-gate.ps1` · `npm run operator:aws:https:gate`

---

## 15. Operator one-command gate (re-run)

```powershell
cd D:\Coding\vibenovel-unified-blueprint

npm run operator:aws:https:gate -- `
  -Domain "narraza.web.id" `
  -TestEmail "staging-smoke@vibenovel.test"
```

Steps automated: DNS check → Caddy HTTPS → HTTPS health → AWS smoke → web rebuild → web-to-AWS smoke → Cloudflare API regression.

Health only:

```powershell
npm run operator:aws:https:gate -- -Domain "<domain>" -HealthOnly
```

---

## 16. Next recommended task — 10.13b (BLOCKED)

**Task 10.13b** — Duitku Mode B live sandbox callback. Status: **BLOCKED** — see [`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md).

**Register in Duitku sandbox dashboard:**

```
https://api-staging.narraza.web.id/api/payments/duitku/callback
```

**Scope (sandbox-only — do not enable production):**

| Check | Required |
|---|---|
| `createInvoice` live sandbox | Success |
| `paymentUrl` valid | Yes |
| Callback reaches AWS HTTPS endpoint | Yes |
| `paid_success` grants credits **exactly once** | Yes |
| Duplicate callback | No double grant |
| Invalid signature / amount mismatch / unknown order | No grant |
| Rollback to Mode A safe | Documented |

Credentials: Duitku **sandbox** merchant code + key only. Keep `CREDIT_TOPUP_ENABLED` gated per ops runbook until explicit Go/No-Go.

---

## Files added (Task 11.6)

- `scripts/operator-aws-https-web-gate.ps1`
- `npm run operator:aws:https:gate`
- `docs/69-aws-https-domain-and-web-to-aws-api-report.md`