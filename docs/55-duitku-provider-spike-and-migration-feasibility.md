# 55 — Duitku Provider Spike & Migration Feasibility (Task 10.9)

**Date:** 2026-06-08  
**Status:** Closed — feasibility spike (docs only)  
**Sprint:** 10 (post-closure)  
**Related:** [`docs/54`](54-mayar-staging-live-execution-report.md), [`docs/53`](53-sprint-10-verification-report.md), [`docs/50`](50-sprint-10-production-readiness-mayar-monetization-plan.md), [`.agent-logs/sprint-10/task-10.9-duitku-provider-spike-feasibility.md`](../.agent-logs/sprint-10/task-10.9-duitku-provider-spike-feasibility.md)

Task 10.9 evaluates **Duitku Payment Gateway** as an alternative/supplement to Mayar for VibeNovel credit topup. **Mayar code is not removed.** Production payment remains **NOT ENABLED**. No live transactions run in this task.

**Duitku docs consulted:**

- [Payment Gateway overview](https://docs.duitku.com/payment-gateway/overview/)
- [API V2 (ID)](https://docs.duitku.com/api/id/)
- [API V2 (EN)](https://docs.duitku.com/api/en/)
- [POP (ID)](https://docs.duitku.com/pop/id/)
- [POP (EN)](https://docs.duitku.com/pop/en/)
- Official PHP library: [duitkupg/duitku-php](https://github.com/duitkupg/duitku-php) (callback params + signature reference)

---

## 1. Executive Summary

| Area | Status |
|---|---|
| Mayar integration | ✅ Implemented — data model, checkout, webhook grant, topup UI, mock/dual-app PASS |
| Mayar live | **BLOCKED** — no sandbox key clarity, no public webhook ([`docs/54`](54-mayar-staging-live-execution-report.md)) |
| Duitku evaluation | **Feasible** as second provider via existing abstraction |
| Production payment | **NOT ENABLED** — no GO claim |

**Context:** User reports Mayar account lacks clear sandbox option. User has an idle legacy Duitku merchant account. Duitku public docs expose **explicit sandbox URLs**, **callback signature validation**, and **sandbox test credentials** (credit card, VA, QRIS, e-money).

**Goal of spike:** Confirm provider abstraction can absorb Duitku with **minimal schema change** (likely zero migration) and **reuse** `credit-topup-grant.ts` unchanged. Mayar remains in codebase for Siklusio compatibility and future retry.

**Preliminary recommendation:** Proceed with **Duitku POP** integration (Tasks 10.10–10.13) as staging-first path; keep Mayar disabled until operator unblocks 10.8.

---

## 2. Duitku Integration Options

### A. Duitku POP (Payment Page)

| Aspect | Detail |
|---|---|
| Flow | Server `createInvoice` → `reference` + `paymentUrl` → user redirected to Duitku hosted checkout → server **callback** (grant) + **returnUrl** (UX only) |
| Sandbox endpoint | `POST https://api-sandbox.duitku.com/api/merchant/createInvoice` |
| Production endpoint | `POST https://api-prod.duitku.com/api/merchant/createInvoice` |
| Auth | Headers: `x-duitku-merchantcode`, `x-duitku-timestamp`, `x-duitku-signature` |
| `paymentMethod` | Optional — empty = user picks method on Duitku page |
| Frontend JS | Optional `checkout.process(reference)` — **not required** if using `paymentUrl` redirect |
| Sandbox testing | Documented: credit card, VA, QRIS, e-money, paylater ([POP §Uji Coba](https://docs.duitku.com/pop/id/#uji-coba)) |
| Demo | [POP demo](https://api-sandbox.duitku.com/demoduitku/) |

**Fit for VibeNovel:** High — mirrors current Mayar flow (`paymentUrl` redirect, webhook-only grant). Topup UI unchanged.

### B. Duitku V2 API

| Aspect | Detail |
|---|---|
| Flow | `getPaymentMethod` (optional) → `v2/inquiry` with **required** `paymentMethod` code → VA number / payment URL per method |
| Sandbox endpoint | `POST https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry` |
| Production endpoint | `POST https://passport.duitku.com/webapi/api/merchant/v2/inquiry` |
| Auth | `signature` in JSON body |
| Complexity | Higher — must handle per-method response shapes (`vaNumber`, `paymentUrl`, OVO H2H, etc.) |
| Demo | [API demo page](https://sandbox.duitku.com/payment/demopage.aspx) |

**Fit for VibeNovel:** Medium — more control, more code paths. Useful later for embedded method picker; not needed for MVP topup.

### Comparison

| Criterion | POP | V2 API |
|---|---|---|
| Time to MVP | **Fastest** | Slower |
| UI change | None (redirect) | None if still redirect; optional custom method UI |
| Payment method UX | Duitku-hosted picker | Merchant picks method code upfront |
| Callback model | Same (`resultCode`) | Same (`resultCode`) |
| Signature on callback | MD5 (documented in PHP lib) | Same formula |
| Sandbox docs | Explicit | Explicit |

### Recommendation

**Choose Duitku POP** for Tasks 10.10–10.12 unless product requires custom payment-method page. Defer V2 to post-MVP if method-specific UX is needed.

---

## 3. Required Credentials / Env

Proposed env (names only — never commit values):

| Variable | Purpose |
|---|---|
| `PAYMENT_PROVIDER` | `mock` \| `mayar` \| `duitku` (new selector) |
| `DUITKU_MERCHANT_CODE` | Project merchant code from [passport.duitku.com](https://passport.duitku.com/merchant/Project) |
| `DUITKU_MERCHANT_KEY` | API key / merchant key (server-only) |
| `DUITKU_ENV` | `sandbox` \| `production` |
| `DUITKU_BASE_URL` | POP base: sandbox `https://api-sandbox.duitku.com`, prod `https://api-prod.duitku.com` |
| `DUITKU_CALLBACK_URL` | Public URL: `POST /api/payments/duitku/callback` |
| `DUITKU_RETURN_URL` | Web return base (or reuse `MAYAR_REDIRECT_BASE_URL` → rename to `PAYMENT_RETURN_BASE_URL`) |
| `PAYMENT_PROVIDER_MOCK` | Unchanged — `true` for local smoke |
| `PAYMENT_PROVIDER_MOCK_MODE` | Unchanged |
| `CREDIT_TOPUP_ENABLED` | Unchanged gate |

**Health booleans (safe):**

- `hasDuitkuMerchantCode`
- `hasDuitkuMerchantKey`
- `paymentProvider` (enum string, no secrets)
- `duitkuEnv`

**Mayar env vars remain** — no deletion.

---

## 4. Mapping to Existing Schema

Migration `00009` uses `provider text` — **no DB migration required** for `provider='duitku'`.

| Column | Duitku mapping |
|---|---|
| `credit_topup_orders.provider` | `duitku` |
| `provider_invoice_id` | **`merchantOrderId`** (merchant-side correlation id) |
| `provider_transaction_id` | **`reference`** (Duitku transaction reference) |
| `payment_url` | `paymentUrl` from createInvoice response |
| `amount_idr` | `paymentAmount` (server-fixed from product catalog) |
| `provider_payload_safe` | `{ reference, merchantOrderId, statusCode, paymentUrlDomain }` — no keys |
| `metadata` | Store internal `orderId` (UUID), `productSlug`, `flow=credit_topup` |

| Webhook table | Mapping |
|---|---|
| `payment_webhook_events.provider` | `duitku` |
| `provider_invoice_id` | `merchantOrderId` |
| `provider_transaction_id` | `reference` |
| `payload_hash` | SHA-256 of sanitized callback fields (reuse pattern) |
| `event_type` | `duitku.callback` or `resultCode=00` |

### `merchantOrderId` strategy

Duitku limit: **string(50)**. VibeNovel order UUID = 36 chars — **fits**.

**Recommended:** `merchantOrderId = credit_topup_orders.id` (UUID string). No prefix required.

**Alternative:** `VN_<uuid-no-dashes>` (35 chars) if operator prefers human scan — optional.

Duitku has **no `extraData`** like Mayar. Correlation is **`merchantOrderId` + `reference` + amount**. Store UUID in `merchantOrderId`; use `reference` for provider transaction idempotency.

### Shared types (Task 10.10)

Extend `PAYMENT_PROVIDERS` in `packages/shared/src/enums.ts`:

```ts
export const PAYMENT_PROVIDERS = {
  mayar: "mayar",
  duitku: "duitku",
} as const;
```

Extend `PaymentProviderCreateInvoiceResult.provider` union: `"mayar" | "duitku" | "mock"`.

---

## 5. Duitku Request Transaction Mapping (POP)

### `createDuitkuPopInvoice(bindings, input: PaymentProviderCreateInvoiceInput)`

| Input field | Duitku POP field |
|---|---|
| `orderId` | `merchantOrderId` |
| `amountIdr` | `paymentAmount` |
| `productName` | `productDetails` |
| `customerEmail` | `email` |
| `customerName` | `customerVaName` / `customerDetail.firstName` |
| `customerMobile` | `phoneNumber` |
| `redirectUrl` | `returnUrl` |
| `expiresAt` | `expiryPeriod` (minutes; derive from TTL) |
| — | `callbackUrl` from `DUITKU_CALLBACK_URL` env |
| — | `itemDetails` single line item (name, price, qty 1) |

### Output → `PaymentProviderCreateInvoiceResult`

| Result field | Source |
|---|---|
| `provider` | `"duitku"` |
| `providerInvoiceId` | `merchantOrderId` (our order UUID) |
| `providerTransactionId` | `reference` |
| `paymentUrl` | `paymentUrl` |
| `payloadSafe` | sanitized response fields |

### Create request signature (POP)

Per [POP docs](https://docs.duitku.com/pop/id/#create-invoice):

```
stringToSign = merchantCode + timestamp
signature = HMAC_SHA256(stringToSign, merchantKey)
```

Headers: `x-duitku-signature`, `x-duitku-timestamp` (ms), `x-duitku-merchantcode`.

**Open question:** Official PHP library uses `hash('sha256', merchantCode . timestamp . apiKey)` (concatenation, not HMAC). **Verify against sandbox** in Task 10.10 — follow sandbox acceptance, document divergence.

### Success response

`statusCode === "00"` → use `reference`, `paymentUrl`.

---

## 6. Duitku Callback Parser Mapping

### Transport

- **HTTP POST**
- **Content-Type:** `application/x-www-form-urlencoded` (not JSON — differs from Mayar)
- Worker route must parse form body, not only JSON

### Callback parameters (from Duitku PHP `Config::$callbackParams`)

| Field | Use |
|---|---|
| `merchantCode` | Validate matches env |
| `amount` | Must match `order.amount_idr` |
| `merchantOrderId` | Primary order lookup (= `credit_topup_orders.id`) |
| `productDetail` | Log safe only |
| `additionalParam` | Optional metadata round-trip (could encode `orderId` if needed) |
| `paymentCode` | Payment method code — observability only |
| `resultCode` | **`00` = paid success**, `01` = pending/failed per lib |
| `reference` | Provider transaction id |
| `signature` | Validate before grant |
| `merchantUserId`, `spUserHash` | Ignore / safe log |

### Paid detection

```
isPaid = (resultCode === "00")
```

Ignore `01` and other codes for grant (same as non-paid Mayar events).

### Callback signature validation

Per [duitku-php `Pop::isSignatureValid`](https://github.com/duitkupg/duitku-php/blob/master/Duitku/Pop.php):

```
expectedSignature = md5(merchantCode + amount + merchantOrderId + merchantKey)
```

Reject callback if signature mismatch — **fail closed, no grant**.

### Parser output → reuse grant path

Map to internal shape compatible with `findCreditTopupOrderForWebhook`:

- `orderId` ← `merchantOrderId`
- `providerTransactionId` ← `reference`
- `providerInvoiceId` ← `merchantOrderId`
- `amountIdr` ← `amount`
- `isPaid` ← `resultCode === "00"`

**Grant:** Reuse `grantCreditsForPaymentSession` — **no grant logic change**.

**Idempotency:** `payload_hash` on sanitized callback + order `paid` status + ledger `metadata.orderId`.

### Proposed route

`POST /api/payments/duitku/callback` — separate from Mayar webhook (different content-type + signature).

---

## 7. Security Comparison: Mayar vs Duitku

| Dimension | Mayar (current) | Duitku (evaluated) |
|---|---|---|
| Sandbox availability | User reports unclear; docs mention `web.mayar.club` | **Explicit** sandbox hosts + test credentials |
| Callback signature | **Not found** in public Mayar docs | **MD5 formula documented** (PHP lib + callback params) |
| Create request auth | Bearer API key | HMAC/timestamp headers (POP) |
| Redirect vs callback | Redirect ≠ paid; webhook grants | Same — `returnUrl` ≠ grant; **callback** grants |
| Payment methods | Invoice link | POP: multi-method hosted page |
| Webhook format | JSON | **Form-urlencoded** |
| Multi-app routing | Siklusio Mayar router needed | **Direct VibeNovel callback** — no Siklusio dependency |
| Check transaction | GET invoice (Mayar) | `transactionStatus` by `merchantOrderId` (POP + V2) |
| Operational complexity | Medium (Siklusio conflict) | **Lower** for VibeNovel-only topup |

**Conclusion:** Duitku improves **sandbox testability** and **callback authentication** vs current Mayar interim guards. Does not replace need for amount/order validation and idempotent grant (already built).

---

## 8. Migration Strategy

### Option A — Add Duitku as second provider ✅ **Recommended**

- `PAYMENT_PROVIDER=duitku` for VibeNovel staging/production topup
- Mayar code path remains; `PAYMENT_PROVIDER=mayar` still valid
- No schema migration (provider is `text`)
- Mock provider unchanged

### Option B — Replace Mayar operationally

- Set default provider to Duitku in ops docs
- Leave Mayar code dormant
- Higher doc churn; not needed now

### Option C — Multi-provider fallback

- Auto-failover between Mayar/Duitku
- **Not recommended** — ops complexity, double reconciliation

### Code touch points (Task 10.10+)

| File | Change |
|---|---|
| `payment-provider.ts` | Switch on `PAYMENT_PROVIDER` |
| `payment-provider-types.ts` | Add `duitku` to provider union |
| `env.ts` | Duitku env + health flags |
| `credit-topup.ts` | Provider-agnostic redirect URL helper |
| `payment-webhooks.ts` | New Duitku callback route |
| New: `duitku-client.ts`, `duitku-callback.ts`, `process-duitku-payment-callback.ts` | Adapter + parser |
| **Unchanged:** `credit-topup-grant.ts`, UI pages, migration `00009` |

---

## 9. Impact on Siklusio Router

If VibeNovel uses Duitku for topup:

| Item | Impact |
|---|---|
| Siklusio Mayar multi-app router | **Not needed** for VibeNovel credit topup |
| Siklusio Mayar legacy flow | **Untouched** — membership/AI topup unchanged |
| Mayar dashboard webhook URL | Stays on Siklusio — no change required for VibeNovel Duitku |
| VibeNovel callback URL | **Duitku-specific** public URL on VibeNovel Worker |
| `MAYAR_MULTI_APP_ROUTER_ENABLED` | Keep **false** for VibeNovel path; preserve patch for future Mayar retry |

**Benefit:** Eliminates Task 10.8 blocker (Siklusio staging router replay) for Duitku path.

---

## 10. Proposed Task Breakdown (if Duitku chosen)

| Task | Scope |
|---|---|
| **10.10** Duitku env + adapter shell | `PAYMENT_PROVIDER`, `duitku-client.ts` createInvoice POP, health flags, `.dev.vars.example`; **no callback grant** |
| **10.11** Duitku checkout integration | Wire `payment-provider.ts`; checkout returns `paymentUrl`; pending order only |
| **10.12** Duitku callback + signature + grant | `POST /api/payments/duitku/callback`; MD5 verify; reuse `grantCreditsForPaymentSession` |
| **10.13** Duitku sandbox smoke | `smoke:api:sprint10:duitku`; sandbox payment; callback capture; duplicate replay |
| **10.14** Payment provider decision report | Mayar vs Duitku GO/NO-GO; production gates |

---

## 11. Smoke Plan

New script: `scripts/sprint10-duitku-smoke-api.ps1` → `npm run smoke:api:sprint10:duitku`

| Case | Expected |
|---|---|
| Checkout (mock) | PASS — unchanged baseline |
| Checkout (duitku sandbox) | Pending order, `paymentUrl`, no grant |
| Callback paid `resultCode=00` | Grant +100 once |
| Duplicate callback | No double grant |
| Wrong signature | No grant, safe error |
| Amount mismatch | No grant |
| `resultCode=01` / unpaid | No grant |
| Secret leak in API response | FAIL if detected |
| `smoke:web:topup` | PASS unchanged — same redirect UX |
| `smoke:api:sprint10` (Mayar mock) | Regression PASS — Mayar path intact |

---

## 12. Open Questions

| # | Question | Owner / timing |
|---|---|---|
| 1 | Is user's legacy Duitku account still active? | User — check [merchant portal](https://passport.duitku.com/merchant) |
| 2 | Is project sandbox or production mode? | User — per-project setting in portal |
| 3 | POP create signature: HMAC vs SHA256 concat (docs vs PHP lib)? | Task 10.10 sandbox probe |
| 4 | Exact sandbox `merchantCode` + key for VibeNovel project? | User — gitignored `.dev.vars` only |
| 5 | Callback URL: per-project in portal or per-request `callbackUrl`? | Docs: per-request in `createInvoice` body ✅ |
| 6 | Can `merchantOrderId` be UUID? | Yes — 36 chars ≤ 50 limit |
| 7 | Sandbox simulator for Rp39k starter package? | POP §Uji Coba — QRIS/VA/CC test creds |
| 8 | Fee/payment method for Rp39k–399k? | Check `getPaymentMethod` in sandbox; QRIS/VA often lowest friction |
| 9 | Worker form-urlencoded parsing — Hono compatibility? | Task 10.12 spike |
| 10 | Legacy account production-only? | If yes — **user approval** before any real-money test |
| 11 | Rename `MAYAR_REDIRECT_BASE_URL` → generic payment return URL? | Task 10.10 — optional alias |

---

## 13. Recommendation

| Decision | Recommendation |
|---|---|
| Proceed with Duitku? | **YES** — feasibility confirmed; sandbox + callback signature stronger than current Mayar live path |
| Integration choice | **Duitku POP** |
| Mayar code | **Keep** — disabled via `PAYMENT_PROVIDER=mayar` or unset |
| Production enable | **NO** — until Task 10.13 sandbox smoke PASS |
| Real-money test on legacy prod account | **Requires explicit user approval** |
| If Duitku account inactive | Fall back to Task 10.8b (Mayar) or Task 11.0 (staging deploy) |

**Next task:** **Task 10.10 — Duitku Provider Data/Env + Adapter Shell**

---

## 14. Verification for Task 10.9

| Criterion | Status |
|---|---|
| Docs-only — no product code changes | ✅ |
| No build/smoke run | ✅ |
| No secrets in docs/log | ✅ |
| No live transactions | ✅ |
| No production payment claim | ✅ |
| Mayar not removed | ✅ |

---

---

## 15. Addendum — Task 10.10 founder clarification (2026-06-08)

**POP selected for MVP implementation.** V2 deferred.

| Founder question | Resolution |
|---|---|
| "V2 lebih fleksibel?" | V2 requires explicit `paymentMethod` and handles VA/QRIS/e-wallet response shapes per method — more flexible for **custom payment UI**, not needed for MVP topup redirect. |
| Why POP | Same flow as Mayar + existing Topup UI: checkout → `paymentUrl` → return pending → callback grants (10.12). |
| `paymentMethod` | POP allows empty string — user chooses on Duitku hosted page. |
| V2 when | Post-MVP if VibeNovel needs embedded method picker or H2H VA display. |

**Task 10.10 delivered:** [`docs/56`](56-duitku-pop-provider-adapter-shell.md) — env + `duitku-pop-client.ts` shell; no callback grant.

---

*Report authored Task 10.9 — 8 Juni 2026. Task 10.10 POP shell complete. Duitku feasible; production NOT READY.*