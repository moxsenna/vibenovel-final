# 58 — Duitku Callback + Idempotent Grant Report (Task 10.12)

**Date:** 2026-06-09  
**Status:** Closed  
**Related:** [`docs/57`](57-duitku-checkout-integration-report.md), [`.agent-logs/sprint-10/task-10.12-duitku-callback-idempotent-grant.md`](../.agent-logs/sprint-10/task-10.12-duitku-callback-idempotent-grant.md)

Task 10.12 implements **Duitku POP server callback** as the sole grant path for Duitku topup. Redirect/return page does not grant. Production payment **NOT ENABLED**.

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| `POST /api/payments/duitku/callback` | Production enablement |
| Form-urlencoded parse + MD5 signature | Live Duitku sandbox payment |
| Reuse `grantCreditsForPaymentSession` | Mayar webhook changes |
| Smoke fixture callback matrix | Admin dashboard |
| Idempotent duplicate handling | UI redesign |

---

## 2. Callback endpoint

`POST /api/payments/duitku/callback`

- Public route (no JWT)
- Content-Type: `application/x-www-form-urlencoded`
- Returns safe JSON summary (no secrets, no raw callback dump)
- Compatible with Duitku retry (payload_hash dedupe)

---

## 3. Form-urlencoded parser

`parseDuitkuCallbackRequest()` in `duitku-callback.ts` extracts:

| Field | Required |
|---|---|
| `merchantCode` | yes |
| `amount` | yes (positive integer string) |
| `merchantOrderId` | yes |
| `resultCode` | yes |
| `signature` | yes |
| `reference` | yes when `resultCode=00` |
| `productDetail`, `paymentCode`, `additionalParam`, `merchantUserId` | optional |

Malformed / wrong content-type → `400 BAD_REQUEST`, no grant.

---

## 4. Signature formula

Per [Duitku PHP lib `Pop::isSignatureValid`](https://github.com/duitkupg/duitku-php/blob/master/Duitku/Pop.php):

```
stringToSign = merchantCode + amount + merchantOrderId + merchantKey
expectedSignature = md5(stringToSign)   // lowercase hex
```

Implemented in `validateDuitkuCallbackSignature()` via `md5HexLower()`. Comparison uses length-checked constant-time string compare. Merchant key never logged.

---

## 5. Paid detection

| `resultCode` | Behavior |
|---|---|
| `"00"` | Paid — eligible for grant after signature/order/amount checks |
| other | Ignored — `payment_not_paid`, no grant |

Browser redirect `resultCode` is never used for grant.

---

## 6. Grant path reuse

Paid + valid checks → `grantCreditsForPaymentSession()` (unchanged from Sprint 10 Mayar path):

- `merchantOrderId` maps to `credit_topup_orders.id`
- `reference` stored as `provider_transaction_id`
- Amount must match `order.amount_idr`
- Order must be `provider=duitku`, `status=pending`, with `payment_url`

Audit actions (existing enums): `payment_webhook_received`, `payment_webhook_processed`, `payment_webhook_failed`, `credit_topup_granted`.

---

## 7. Idempotency and duplicate handling

| Mechanism | Behavior |
|---|---|
| `payment_webhook_events.payload_hash` | Duplicate identical callback → terminal replay |
| `grantCreditsForPaymentSession` | `alreadyGranted` when order paid / ledger exists |
| Duplicate paid replay | Balance unchanged, ledger count unchanged |

---

## 8. Safety test matrix (smoke fixtures)

| Case | Expected | Smoke |
|---|---|---|
| A. paid_success | grant +100, ledger +1 | PASS |
| B. duplicate_paid | no double grant | PASS |
| C. invalid_signature | no grant | PASS |
| D. amount_mismatch | no grant, order pending | PASS |
| E. unknown_order | no grant | PASS |
| F. resultCode≠00 | ignored, no grant | PASS |
| G. malformed_form | 400, no grant | PASS |
| H. wrong_merchant_code | no grant | PASS |

Fixtures use development smoke credentials (`SMOKE01` / local fixture key) when real Duitku keys unset.

---

## 9. Live Duitku status

| Item | Status |
|---|---|
| Sandbox live payment + callback | **NOT RUN** — no real Duitku credentials |
| Fixture callback grant | **PASS** |
| Production Duitku GO | **NO-GO** |

---

## 10. Known limitations

- Live Duitku sandbox end-to-end not verified (Task 10.13+)
- Callback fixture auto-enabled in development when real keys unset
- Create-invoice signature (HMAC) differs from callback (MD5) — both per official lib
- `DUITKU_CALLBACK_URL` must be publicly reachable for real Duitku callbacks

---

## 11. Next task

**Task 10.13 — Duitku Sandbox Live Smoke** — ✅ closed **BLOCKED**. See [`docs/59`](59-duitku-sandbox-live-smoke-report.md). Live callback **NOT RUN** (no credentials, no public callback URL). Fixture regression PASS.

**Task 10.13b** — operator-driven live execution when credentials + public `DUITKU_CALLBACK_URL` available.

---

*Authored Task 10.12 — 9 Juni 2026. Callback grant implemented; production NOT READY. Task 10.13 addendum: live sandbox BLOCKED.*