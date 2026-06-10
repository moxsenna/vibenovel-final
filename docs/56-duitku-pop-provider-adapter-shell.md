# 56 — Duitku POP Provider Env + Adapter Shell (Task 10.10)

**Date:** 2026-06-08  
**Status:** Closed  
**Related:** [`docs/55`](55-duitku-provider-spike-and-migration-feasibility.md), [`.agent-logs/sprint-10/task-10.10-duitku-pop-provider-env-adapter-shell.md`](../.agent-logs/sprint-10/task-10.10-duitku-pop-provider-env-adapter-shell.md)

Task 10.10 implements **Duitku POP adapter shell** — env bindings, provider selector, `createInvoice` client, signature helper, response mapper, smoke precheck. **No callback grant.** Production payment **NOT ENABLED**.

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| `PAYMENT_PROVIDER` selector (`mock` \| `mayar` \| `duitku`) | Callback route / grant (Task 10.12) |
| `duitku-pop-client.ts` createInvoice | V2 API |
| Health booleans | Admin dashboard |
| `smoke:api:sprint10:duitku` precheck | Live transaction by default |
| Mayar + mock regression | Production enable |

---

## 2. Founder clarification: POP selected; V2 deferred

| Choice | Reason |
|---|---|
| **POP** ✅ | Mirrors Mayar/topup UI: `createInvoice` → `paymentUrl` redirect; `paymentMethod` optional |
| **V2** deferred | Requires `paymentMethod` upfront + per-method response handling; custom selector later |

See [`docs/55` §2 addendum](55-duitku-provider-spike-and-migration-feasibility.md).

---

## 3. Env variables

| Variable | Purpose |
|---|---|
| `PAYMENT_PROVIDER` | `mock` \| `mayar` \| `duitku` (when `PAYMENT_PROVIDER_MOCK=false`) |
| `PAYMENT_PROVIDER_MOCK` | `true` → mock always wins |
| `PAYMENT_RETURN_BASE_URL` | Optional generic return base |
| `DUITKU_ENV` | `sandbox` \| `production` (default sandbox) |
| `DUITKU_MERCHANT_CODE` | Merchant project code |
| `DUITKU_MERCHANT_KEY` | API key (server-only) |
| `DUITKU_BASE_URL` | Override POP base (default sandbox `https://api-sandbox.duitku.com`) |
| `DUITKU_CALLBACK_URL` | Future callback: `/api/payments/duitku/callback` |
| `DUITKU_RETURN_URL` | Web return origin |
| `PAYMENT_TIMEOUT_MS` | Shared timeout (Mayar + Duitku) |

Names in `apps/api/.dev.vars.example` only — never commit values.

---

## 4. Provider selector behavior

```
PAYMENT_PROVIDER_MOCK=true  → mock provider (unchanged)
PAYMENT_PROVIDER_MOCK=false →
  PAYMENT_PROVIDER=mayar   → mayar-client
  PAYMENT_PROVIDER=duitku  → duitku-pop-client
  PAYMENT_PROVIDER=mock    → mock success
  (unset)                  → mayar (backward compatible)
```

Health exposes: `paymentProvider`, `duitkuEnv`, `hasDuitkuMerchantCode`, `hasDuitkuMerchantKey`, `hasDuitkuCallbackUrl`, `duitkuCallbackUrlIsPublic` — no secrets, no URL values.

---

## 5. Duitku POP createInvoice mapping

`POST {DUITKU_BASE_URL}/api/merchant/createInvoice`

| VibeNovel input | Duitku field |
|---|---|
| `amountIdr` | `paymentAmount` |
| `orderId` | `merchantOrderId` |
| `productName` | `productDetails` + `itemDetails[0].name` |
| `customerEmail` | `email`, `merchantUserInfo` |
| `customerName` | `customerVaName` (max 20 chars) |
| `customerMobile` | `phoneNumber` |
| `redirectUrl` | `returnUrl` |
| env `DUITKU_CALLBACK_URL` | `callbackUrl` |
| `expiresAt` | `expiryPeriod` (10–60 min clamp) |
| — | `paymentMethod=""` (user picks on Duitku page) |

---

## 6. Create signature implementation

Per [Duitku POP docs](https://docs.duitku.com/pop/id/#create-invoice):

```
stringToSign = merchantCode + timestamp
signature = HMAC_SHA256(stringToSign, merchantKey)  // hex lowercase
```

Headers: `x-duitku-merchantcode`, `x-duitku-timestamp`, `x-duitku-signature`.

Implemented in `generateDuitkuPopCreateSignature()` via Web Crypto `HMAC-SHA-256`.

**Note:** Official PHP library uses `hash('sha256', concat)` for create — verify against sandbox in Task 10.11/10.13 if API rejects signature.

---

## 7. Response mapping

| Result field | Source |
|---|---|
| `provider` | `"duitku"` |
| `providerInvoiceId` | `orderId` / `merchantOrderId` |
| `providerTransactionId` | `reference` |
| `paymentUrl` | `paymentUrl` |
| `payloadSafe` | `reference`, `merchantOrderId`, `statusCode`, `paymentUrlDomain` |

Validation: `statusCode === "00"`, `reference` and `paymentUrl` present — else `PAYMENT_PROVIDER_INVALID_RESPONSE`.

---

## 8. Callback / grant deferred (Task 10.12)

**Not implemented in 10.10.**

Planned route: `POST /api/payments/duitku/callback`

| Item | Planned behavior |
|---|---|
| Content-Type | `application/x-www-form-urlencoded` |
| Paid | `resultCode === "00"` |
| Grant | Reuse `grantCreditsForPaymentSession` |
| Signature | Verify per Duitku callback docs (PHP lib: `md5(merchantCode+amount+merchantOrderId+key)` — confirm in 10.12) |
| Redirect | **Never grants** — UX only |

---

## 9. Redirect is UX only; callback grants

`returnUrl` / `/credits/topup/return` — pending copy + Refresh Saldo only. Credit grant remains webhook/callback-only (Task 10.12).

---

## 10. Smoke / precheck commands

```powershell
npm run smoke:api:sprint10:duitku
# Optional explicit sandbox invoice (requires keys + PAYMENT_PROVIDER=duitku):
npm run smoke:api:sprint10:duitku -- -LiveCreate
```

| Mode | Behavior |
|---|---|
| Default | Health booleans, no secret leak, live steps NOT RUN |
| Mock (`PAYMENT_PROVIDER_MOCK=true`) | SKIP duitku-specific; sprint10 mock unchanged |
| `-LiveCreate` | One sandbox invoice if credentials + `PAYMENT_PROVIDER=duitku` + sandbox env |

---

## 11. Known limitations

- No callback route or grant
- No `transactionStatus` poll helper yet
- Create signature may need sandbox tuning vs PHP lib
- `DUITKU_CALLBACK_URL` must be public for real callbacks (Task 10.12+)
- V2 API not implemented

---

## 12. Next task

**Task 10.11 — Duitku Checkout Integration** — ✅ closed. See [`docs/57`](57-duitku-checkout-integration-report.md).

**Task 10.12 — Duitku Callback + Idempotent Grant** — ✅ closed. See [`docs/58`](58-duitku-callback-idempotent-grant-report.md).

**Task 10.13 — Duitku Sandbox Live Smoke** — ✅ closed **BLOCKED**. LiveCreate **NOT RUN**. See [`docs/59`](59-duitku-sandbox-live-smoke-report.md).

---

*Authored Task 10.10 — 8 Juni 2026. Checkout integration verified Task 10.11. Task 10.13 addendum: sandbox live BLOCKED.*