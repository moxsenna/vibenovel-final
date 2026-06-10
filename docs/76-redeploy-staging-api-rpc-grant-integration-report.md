# 76 — Redeploy Staging API and Verify RPC Grant Integration (Task 10.18)

**Date:** 2026-06-10  
**Status:** Closed — **GO**  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/74`](74-atomic-grant-db-rpc-report.md), [`docs/75`](75-apply-migration-00010-hosted-staging-report.md), [`docs/73`](73-duitku-production-payment-enable-plan.md), [`.agent-logs/sprint-10/task-10.18-redeploy-staging-api-rpc-grant-integration.md`](../.agent-logs/sprint-10/task-10.18-redeploy-staging-api-rpc-grant-integration.md)

Staging-only operator task: redeploy AWS staging API with Task 10.16 RPC grant code and prove end-to-end **API callback → service → `grant_paid_credit_topup_atomic`** on hosted staging Supabase (`jdxyhrnibmmwlbtbokqo`). **Production untouched.** **Production payment NOT ENABLED.**

---

## 1. Preflight

| Check | Result |
|---|---|
| Local git | Dirty working tree (expected); commit `c505a82` recorded at deploy time |
| Staging API reachable | **PASS** — `https://api-staging.narraza.web.id/api/health` |
| Hosted staging target | **PASS** — project ref `jdxyhrnibmmwlbtbokqo` (from `.env.staging`, names only) |
| Migration 00010 | **PASS** — applied Task 10.17 ([`docs/75`](75-apply-migration-00010-hosted-staging-report.md)) |
| Operator Duitku secrets | **PASS** — present in gitignored operator env (values not logged) |
| SSH key | **PASS** — `vibenovel-staging-key.pem` exists locally |

### Preflight health (Mode A)

| Flag | Value |
|---|---|
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

---

## 2. Build and typecheck

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run test:atomic-grant` | **PASS** |
| `npm run test:atomic-grant-hosted` | **PASS** — target `jdxyhrnibmmwlbtbokqo.supabase.co` |

---

## 3. Deploy — AWS staging API

| Item | Value |
|---|---|
| Target | `https://api-staging.narraza.web.id` |
| EC2 | `13.212.245.32` (`/opt/vibenovel`) |
| Method | Tarball `scp` + extract (preserve server `.env.staging`) + `docker compose -f docker-compose.staging.yml up -d --build` |
| Commit | `c505a82` (local HEAD at deploy) |
| Production | **NOT touched** |

Deploy preserved existing server `.env.staging` (Mode A Supabase + safe payment flags). Container rebuilt with latest `apps/api` sources including `credit-topup-grant.ts` RPC path.

---

## 4. Post-deploy health (Mode A, before Mode B)

| Flag | Value |
|---|---|
| `ok` | `true` |
| `appEnv` | `staging` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |
| Docker on EC2 | **Healthy** — container recreated and health endpoint OK |

---

## 5. RPC integration verification (staging API fixture)

Temporary **Mode B** applied for fixture smoke only (`npm run operator:aws:duitku:gate -- -Mode apply -SkipRollback`), then fixture matrix against staging API:

```powershell
npm run smoke:api:sprint10:duitku -- -ApiBaseUrl https://api-staging.narraza.web.id -StagingMode -TestEmail staging-smoke@vibenovel.test
```

Harness: `scripts/sprint10-duitku-smoke-api.ps1` — creates pending Duitku orders on hosted staging, posts signed fixture callbacks to `POST /api/payments/duitku/callback`, verifies ledger/balance/order via hosted Supabase service role (values not logged).

| Case | Result |
|---|---|
| First grant (`paid_success`) | **PASS** — balance +100, ledger +1, order `paid` |
| Duplicate callback | **PASS** — `already_granted`, no double grant |
| Invalid signature | **PASS** — `invalid_signature`, no grant |
| Amount mismatch | **PASS** — `amount_mismatch`, no grant |
| Unknown order | **PASS** — `order_not_found`, no grant |
| Non-paid (`resultCode` ≠ `00`) | **PASS** — `payment_not_paid`, no grant |
| Wrong merchant code | **PASS** — `merchant_code_mismatch`, no grant |
| Malformed form | **PASS** — safe reject |

**Summary:** PASS=17 FAIL=0 (fixture block); live Duitku payment **NOT RUN** (not required for this task).

This proves the **deployed staging API** uses the RPC-backed grant service path against hosted staging DB — not only direct DB/RPC tests from Task 10.17.

---

## 6. Rollback Mode A

```powershell
npm run operator:aws:duitku:gate -- -Mode rollback
```

| Flag | Value |
|---|---|
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

**Cloudflare Worker fallback:** **PASS** — `https://vibenovel-api-staging.moxsenna.workers.dev/api/health` OK (Mode A flags).

---

## 7. Security notes

- No production credentials, migration, callback registration, or payment enablement.
- No secrets logged (merchant keys, service role, env values).
- Mode B was temporary; final state is Mode A safe.
- Fixture smoke left test orders/ledger rows on hosted staging (no destructive cleanup per task rules).

---

## 8. Rollback plan (if needed)

| Failure | Action |
|---|---|
| Deploy breaks health | Restore previous image/container on EC2; keep Mode A `.env.staging` |
| Smoke double-grant | **NO-GO** — do not proceed production; investigate RPC + callback handler |
| Mode B left enabled | Run `operator:aws:duitku:gate -Mode rollback` immediately |

---

## 9. Remaining blockers

- Production migration `00010` — founder approval required ([`docs/73`](73-duitku-production-payment-enable-plan.md) §7)
- Production enable execution — gated; staging E2E RPC path now proven
- Real Duitku live payment on staging — optional; already proven in Tasks 10.13b/10.13c

---

## 10. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | Latest API on AWS staging; RPC fixture grant via API PASS; negatives PASS; Mode A restored; CF fallback PASS |
| Production touched | **NO** |

---

## Final summary

```txt
Task 10.18 — Redeploy Staging API and Verify RPC Grant Integration
Status: GO

Deploy: https://api-staging.narraza.web.id (commit c505a82, tarball scp + docker rebuild)
RPC path: staging API fixture callback → grant_paid_credit_topup_atomic — PASS
Duplicate / negatives: PASS
Final Mode A: safe
Cloudflare fallback: PASS
Production: untouched

Next: production migration 00010 + docs/73 §7 — founder approval required
```