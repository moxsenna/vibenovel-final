# 57 — Duitku Checkout Integration Report (Task 10.11)

**Date:** 2026-06-09  
**Status:** Closed  
**Related:** [`docs/56`](56-duitku-pop-provider-adapter-shell.md), [`.agent-logs/sprint-10/task-10.11-duitku-checkout-integration.md`](../.agent-logs/sprint-10/task-10.11-duitku-checkout-integration.md)

Task 10.11 verifies **end-to-end Duitku POP checkout** through existing `POST /api/credits/topup/checkout` — pending order, `createInvoice`, `paymentUrl`, audit logs, idempotency — **without callback/grant**. Production payment **NOT ENABLED**.

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| Checkout via provider abstraction when `PAYMENT_PROVIDER=duitku` | Callback route / grant (Task 10.12) |
| No-credential safe failure | Production enablement |
| Smoke precheck + optional `-LiveCreate` | V2 API |
| UI compatibility (no redesign) | Admin dashboard |
| Mayar/mock regression | Real-money transaction by default |

---

## 2. Environment used

Local verification used `apps/api/.dev.vars` (gitignored). Typical smoke configuration:

| Variable | Smoke default | LiveCreate requirement |
|---|---|---|
| `CREDIT_TOPUP_ENABLED` | `true` (local smoke) | `true` |
| `PAYMENT_PROVIDER_MOCK` | `true` (Mayar mock regression) | `false` |
| `PAYMENT_PROVIDER` | `mock` (via mock flag) | `duitku` |
| `DUITKU_ENV` | `sandbox` (health default) | `sandbox` |
| `DUITKU_MERCHANT_CODE` | unset | required |
| `DUITKU_MERCHANT_KEY` | unset | required |
| `DUITKU_CALLBACK_URL` | unset | required for createInvoice |

**Session result:** precheck PASS with mock mode; **live sandbox checkout NOT RUN** (no Duitku credentials configured locally).

---

## 3. Checkout path status

`POST /api/credits/topup/checkout` flow (unchanged route; verified wiring):

```
auth → product lookup (server price/credits)
     → idempotency check
     → insert credit_topup_orders (pending)
     → createPaymentProviderInvoice → duitku-pop-client
     → update order: provider, reference, paymentUrl, payloadSafe
     → audit: credit_topup_checkout_created + payment_invoice_created
     → return { order, paymentUrl, provider, idempotentReplay }
```

Expected Duitku order fields:

| Field | Value |
|---|---|
| `provider` | `duitku` |
| `status` | `pending` |
| `provider_invoice_id` | VibeNovel order UUID |
| `provider_transaction_id` | Duitku `reference` |
| `payment_url` | Duitku hosted `paymentUrl` |
| `amount_idr` | Server product (starter = 39000) |
| `credits_to_grant` | Server product (starter = 100) |

No balance or `credit_ledger` mutation at checkout.

---

## 4. No-credential behavior

When `PAYMENT_PROVIDER=duitku`, mock off, topup enabled, but merchant code/key missing:

| Behavior | Result |
|---|---|
| HTTP response | `503` `PAYMENT_PROVIDER_NOT_CONFIGURED` |
| Balance | unchanged |
| Ledger | no `credit_topup` credit row |
| Grant | none |

**Order handling:** Provider call fails after order insert. A `pending` row **may** exist without `payment_url`. Retry with the **same** idempotency key returns `409` (documented). Use a **new** idempotency key to retry.

Smoke step `no-credential checkout safe fail` runs only when health shows `paymentProvider=duitku` and `hasDuitkuMerchantCode/key=false`.

---

## 5. Sandbox createInvoice result

| Run | Result |
|---|---|
| `-LiveCreate` this session | **NOT RUN** — no Duitku sandbox credentials in local `.dev.vars` |
| Claim | **No Duitku checkout GO** |

When credentials are configured, run:

```powershell
npm run smoke:api:sprint10:duitku -- -LiveCreate
```

Expected: one starter pending order, Duitku `paymentUrl`, `reference` stored, no grant.

---

## 6. Idempotency result

| Path | Result |
|---|---|
| Mayar/mock `smoke:api:sprint10` | PASS — replay returns same order/paymentUrl |
| Duitku live idempotency | **NOT RUN** — no sandbox credentials |
| Duitku failed-first-call | Documented `409` when `payment_url` missing on replay |

LiveCreate smoke (when run) verifies `idempotentReplay=true` and same `orderId`/`paymentUrl` on second POST.

---

## 7. UI compatibility

No UI redesign. Minor copy updates only:

- `CreditTopupPage` — provider-agnostic payment note (Mayar or Duitku)
- `CreditTopupReturnPage` — grant via server callback/webhook, not browser redirect

Existing behavior preserved:

| Scenario | UI behavior |
|---|---|
| Mock mode (`VITE_USE_MOCKS=true`) | Shows mock notice; no fake checkout |
| Topup disabled | Safe disabled message |
| Checkout success | `window.location.assign(paymentUrl)` — works for Duitku URL |
| Provider not configured | `PAYMENT_PROVIDER_NOT_CONFIGURED` → "Pembayaran belum dikonfigurasi." |
| Return page | Pending copy + Refresh Saldo only; no grant |

**Duitku UI live redirect:** NOT RUN (mock web smoke only).

---

## 8. No-grant safety

| Check | Status |
|---|---|
| Checkout grants credits | ❌ never |
| Redirect grants credits | ❌ never |
| Return page grants credits | ❌ never |
| `credit_ledger` topup row before callback | ❌ none |
| Secrets in API response | ❌ none (payloadSafe domain only) |
| Callback route | ❌ not implemented (10.12) |

---

## 9. Remaining callback/grant work

**Task 10.12** — `POST /api/payments/duitku/callback`:

- `application/x-www-form-urlencoded`
- `resultCode=00` → grant via existing `credit-topup-grant.ts`
- Verify callback signature per Duitku docs
- Redirect `resultCode` must never grant

---

## 10. Go/No-Go

| Criterion | Status |
|---|---|
| Checkout path wired | ✅ |
| No-credential safe fail | ✅ (when `PAYMENT_PROVIDER=duitku` without keys) |
| Smoke precheck PASS | ✅ |
| Sandbox live checkout verified | ⏸ NOT RUN (no credentials) |
| Mayar/mock regression | ✅ |
| Callback/grant | ❌ deferred |
| Production payment | ❌ NOT READY |

**Go/No-Go:** **NO-GO for production Duitku** — shell + checkout wiring verified; sandbox live create and callback still required.

---

## 11. Next task

**Task 10.12 — Duitku Callback + Idempotent Grant** — ✅ closed. See [`docs/58`](58-duitku-callback-idempotent-grant-report.md).

**Task 10.13 — Duitku Sandbox Live Smoke** — ✅ closed **BLOCKED**. LiveCreate **NOT RUN** (no credentials). See [`docs/59`](59-duitku-sandbox-live-smoke-report.md).

---

*Authored Task 10.11 — 9 Juni 2026. Checkout integration verified. Task 10.13 addendum: sandbox live BLOCKED.*