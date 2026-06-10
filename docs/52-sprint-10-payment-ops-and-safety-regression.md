# 52 — Sprint 10 Payment Ops & Safety Regression (Task 10.6)

**Date:** 2026-06-08  
**Status:** Closed  
**Production payment status:** **NOT PRODUCTION READY** / **PARTIAL GO** (unchanged from Task 10.5)  
**Related:** [`docs/50`](50-sprint-10-production-readiness-mayar-monetization-plan.md), [`docs/51`](51-mayar-sandbox-live-smoke-report.md), [`.agent-logs/sprint-10/task-10.6-ops-minimal-payment-safety-regression.md`](../.agent-logs/sprint-10/task-10.6-ops-minimal-payment-safety-regression.md)

Task 10.6 delivers **ops runbook**, **support checklist**, **smoke consolidation**, and **safety regression matrix**. It does **not** enable production Mayar or change the production dashboard.

---

## A. Local safe smoke mode

Use for daily dev and `npm run smoke:all:local` (14 phases).

| Variable | Value | Notes |
|---|---|---|
| `CREDIT_TOPUP_ENABLED` | `true` | Local topup test only — production default remains **`false`** |
| `PAYMENT_PROVIDER_MOCK` | **`true`** | No Mayar network |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` | Deterministic checkout + webhook simulation |
| `AI_GENERATION_ENABLED` | **`false`** | No OpenRouter spend |
| `AI_PROVIDER_MOCK` | `true` | Sprint 8/9 baseline |
| `VITE_USE_MOCKS` | **`true`** | Web mock; restart `dev:web` after change |
| Siklusio `MAYAR_MULTI_APP_ROUTER_ENABLED` | **`false`** | Router off unless explicit dual-app test |

**Commands (repo root):**

```powershell
npm run dev:api
npm run dev:web
npm run smoke:api:sprint10
npm run smoke:web:topup
npm run smoke:all:local
```

**Dual-app (separate — requires Siklusio `dev:backend`):**

```powershell
npm run smoke:api:sprint10:dual-app
```

**Never commit:** `apps/api/.dev.vars`, `apps/web/.env.local`, Siklusio `.dev.vars`.

---

## B. Sandbox / live smoke mode

For operator verification before production enable. See [`docs/51`](51-mayar-sandbox-live-smoke-report.md).

| Variable | Value |
|---|---|
| `MAYAR_API_KEY` | Sandbox key in gitignored `.dev.vars` or Worker secret — **never log/commit** |
| `PAYMENT_PROVIDER_MOCK` | **`false`** |
| `MAYAR_ENV` | `sandbox` |
| `MAYAR_BASE_URL` | `https://api.mayar.club/hl/v1` |
| `CREDIT_TOPUP_ENABLED` | `true` (test env only) |

**Prerequisites:**

1. Restart `dev:api` after env change.
2. **Public webhook URL** — staging Worker or tunnel; Mayar cannot POST to `127.0.0.1` alone.
3. Register webhook in **sandbox** dashboard (`web.mayar.club`) only — **do not** change production Siklusio dashboard URL without explicit approval.
4. One controlled starter payment max; capture **sanitized** webhook into `docs/51` appendix (no PII/secrets).

**Command:**

```powershell
npm run smoke:api:sprint10:mayar-live
```

**Rollback after test:**

- `PAYMENT_PROVIDER_MOCK=true`
- `PAYMENT_PROVIDER_MOCK_MODE=success`
- Optional: `CREDIT_TOPUP_ENABLED=false`
- Siklusio: `MAYAR_MULTI_APP_ROUTER_ENABLED=false`
- Restart `dev:api` / Siklusio backend
- Do **not** delete `credit_topup_orders`, `payment_webhook_events`, or `credit_ledger` rows

---

## C. Production enable prerequisites

**All must PASS before `CREDIT_TOPUP_ENABLED=true` in production:**

| # | Gate |
|---|---|
| 1 | Live/sandbox invoice create PASS (`provider=mayar`, real ids, `paymentUrl`) |
| 2 | Real `payment.received` webhook captured (sanitized) and parser compatible |
| 3 | Paid webhook grants **exactly once** (+correct credits) |
| 4 | Duplicate webhook / retry → no double grant |
| 5 | Amount mismatch → no grant |
| 6 | Foreign `app` / legacy Siklusio payload → no VibeNovel grant |
| 7 | Siklusio **staging** router replay PASS (forward → VibeNovel grant once) |
| 8 | Operator rollback tested (`CREDIT_TOPUP_ENABLED=false` instant kill) |
| 9 | Mayar dashboard / webhook URL decision documented (router Go/No-Go) |
| 10 | Legal/refund copy + support SOP ready |
| 11 | Worker secrets reviewed (names only in docs) |
| 12 | Remote migration `00009+` applied with backup |

**Current status (Task 10.8):** gates 3–6 PASS on **mock/dual-app** only; gates 1–2 **NOT RUN** live (`hasMayarApiKey=false` per [`docs/54`](54-mayar-staging-live-execution-report.md)); gate 7 staging **NOT RUN**; production **blocked**.

---

## D. Rollback procedure

| Action | Setting |
|---|---|
| Disable checkout + webhook grant | `CREDIT_TOPUP_ENABLED=false` |
| Restore local mock checkout | `PAYMENT_PROVIDER_MOCK=true`, `PAYMENT_PROVIDER_MOCK_MODE=success` |
| Disable Siklusio forwarder | `MAYAR_MULTI_APP_ROUTER_ENABLED=false` |
| Mayar production dashboard | **Unchanged** unless ops explicitly approves router switch |
| Data | **No** manual deletion of orders, webhook events, or ledger rows |
| Balance fixes | **Never** direct SQL balance edit — use webhook replay or approved RPC only |

Verify rollback: `GET /api/health` → `creditTopupEnabled=false` (when rolled back), checkout returns `TOPUP_DISABLED`.

---

## E. Support checklist — paid but no credit visible

Docs-only SOP (no admin dashboard). Run against **Supabase SQL** or service-role tools — never expose to end users.

1. **Identify user** — email / `user_id` from support ticket.
2. **Find order** — `credit_topup_orders` by `user_id`, `id` (orderId from return URL), `provider_transaction_id`, or `provider_invoice_id`.
3. **Order status** — expect `pending` (unpaid), `paid` (granted or should be), `failed`/`expired` per enum.
4. **Webhook events** — `payment_webhook_events` by `provider_transaction_id`, `provider_invoice_id`, or `payload_hash`; check `processing_status` (`processed`, `failed`, `ignored`, `duplicate`).
5. **Ledger** — `credit_ledger` where `direction=credit`, `reason=credit_topup`, `metadata->>'orderId'` or payment session metadata.
6. **Balance** — `credit_balances.balance` for `user_id`.
7. **Mayar paid, no webhook** — confirm via Mayar dashboard / `GET /invoice/{id}` (operator with API key). Manual webhook replay to VibeNovel **only** after amount + order correlation verified; use sanitized payload; log in audit.
8. **Never** edit `credit_balances` directly without audit + approved procedure.
9. **Escalate** if amount mismatch, unknown invoice, or duplicate grant suspected.

### Example SQL (local ops — redact in tickets)

```sql
-- Orders for user
SELECT id, status, amount_idr, credits_to_grant, provider, provider_invoice_id,
       provider_transaction_id, paid_at, created_at
FROM credit_topup_orders
WHERE user_id = '<user-uuid>'
ORDER BY created_at DESC
LIMIT 10;

-- Webhook events
SELECT id, event_type, processing_status, provider_transaction_id, provider_invoice_id, created_at
FROM payment_webhook_events
WHERE user_id = '<user-uuid>' OR provider_transaction_id = '<txn-id>'
ORDER BY created_at DESC
LIMIT 20;

-- Topup ledger credits
SELECT id, amount, balance_after, metadata, created_at
FROM credit_ledger
WHERE user_id = '<user-uuid>' AND reason = 'credit_topup' AND direction = 'credit'
ORDER BY created_at DESC;
```

---

## F. User order status endpoint decision

**Decision: DEFERRED (Task 10.6)**

`GET /api/credits/topup/orders/:orderId` was considered for return-page polling. **Not implemented** because:

- `CreditTopupReturnPage` intentionally shows pending copy + **Refresh Saldo** (`GET /api/credits/balance`) only.
- UI must not mark paid from redirect; order status poll is optional UX, not required for MVP safety.
- Adding owner-read endpoint is low risk but out of minimal ops scope; defer to post–production-enable UX if support volume warrants.

**Future endpoint contract (if added later):** auth required, owner-only, safe `CreditTopupOrderSummary` fields only — no `provider_payload_safe`, webhook body, ledger rows, or admin fields.

---

## G. Smoke matrix (Task 10.6 regression)

| Command | Purpose | Expected (local default env) |
|---|---|---|
| `npm run typecheck` | TS safety | PASS |
| `npm run build:shared` / `build:web` / `build:api` | Build | PASS |
| `npm run smoke:api:sprint10` | Topup checkout + webhook grant | PASS (mock auto when topup+mock on) |
| `npm run smoke:web:topup` | Topup UI mock | PASS |
| `npm run smoke:api:sprint10:mayar-live` | Live precheck | PASS precheck; live steps NOT RUN without key |
| `npm run smoke:api:sprint10:dual-app` | Siklusio router | PASS if both backends up; else NOT RUN |
| `npm run smoke:api` | Sprint 2 base | PASS |
| `npm run smoke:api:sprint5`–`sprint9` | Regression | PASS |
| `npm run smoke:all:local` | Orchestrator **14 phases** | **PASS** 14/14 (Task 10.6 verified) |

**Not in `smoke:all:local` by design:** live Mayar, dual-app (requires Siklusio), API-mode web E2E (`smoke:all:local:full`).

---

## H. Safety assertions (confirmed)

| Assertion | Verified by |
|---|---|
| UI does not grant credit | Task 10.4 E2E; no webhook call from product UI |
| Redirect does not mark paid | Return page copy + no grant API |
| Webhook grants only known order | `smoke:api:sprint10` unknown-order case |
| Duplicate webhook → no double grant | sprint10 + dual-app smoke |
| Amount mismatch → no grant | sprint10 smoke |
| Foreign app / legacy → no VibeNovel grant | sprint10 smoke |
| Siklusio router does not process VibeNovel as Siklusio payment | dual-app smoke (`routed=vibenovel`) |
| No Mayar key in API response / DOM | leak guards in web E2E + smoke sanitizers |
| No raw provider/webhook payload in UI | CreditTopup pages + E2E patterns |
| No credit ledger in UI | No ledger API exposed to web |
| No AI/canon mutation from payment | Payment routes isolated from write/publish |
| Topup disabled default for production | `CREDIT_TOPUP_ENABLED` default false in `env.ts` |

---

## I. Production readiness status

| Label | Meaning |
|---|---|
| **PARTIAL GO** | Mock + dual-app + parser hardening sufficient for continued dev |
| **NOT PRODUCTION READY** | Live Mayar invoice, real webhook capture, staging router replay incomplete |

Production Mayar / `CREDIT_TOPUP_ENABLED=true` on production Workers remains **blocked** until Task 10.5 operator gates complete.

---

## J. Remaining non-blocking (post–10.6)

| Item | Priority | Notes |
|---|---|---|
| `GET /api/credits/topup/orders/:id` owner read | P2 | Deferred — balance refresh sufficient for MVP |
| Admin credit dashboard | P2 | Out of scope |
| Mayar webhook HMAC | P1 | Not in public docs — idempotency + validation interim |
| True Postgres RPC grant atomicity | P1 | Compensation runner today |
| `smoke:all:local:full` Sprint 10 API-mode topup | P2 | Manual env switch |
| CI smoke job | P1 | Local-only today |

---

## K. Next recommended task

**Task 10.8b** — Operator Mayar sandbox live run: add `MAYAR_API_KEY` to gitignored `.dev.vars`, set `PAYMENT_PROVIDER_MOCK=false`, provision public webhook (tunnel or staging), re-run [`docs/54`](54-mayar-staging-live-execution-report.md) checklist.

**Task 10.8 result:** **BLOCKED** — see [`docs/54`](54-mayar-staging-live-execution-report.md).

---

*Authored Task 10.6 — 8 Juni 2026. Task 10.8 addendum in `docs/54`.*