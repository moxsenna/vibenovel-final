# 51 — Mayar Sandbox Live Smoke Report (Task 10.5)

**Date:** 2026-06-08  
**Status:** Closed — **PARTIAL GO**  
**Sprint:** 10  
**Related:** [`docs/50`](50-sprint-10-production-readiness-mayar-monetization-plan.md), [`.agent-logs/sprint-10/task-10.5-mayar-sandbox-live-smoke.md`](../.agent-logs/sprint-10/task-10.5-mayar-sandbox-live-smoke.md)

---

## 1. Environment used (no secrets)

| Item | Value |
|---|---|
| API | Local `http://127.0.0.1:8787` (`wrangler dev`) |
| Database | Local Supabase `http://127.0.0.1:54321` |
| Mayar env | `sandbox` (default when `MAYAR_ENV` unset) |
| Mayar API base | `https://api.mayar.club/hl/v1` |
| Mayar dashboard (testing) | `https://web.mayar.club` per Mayar docs |
| Siklusio router live | **NOT RUN** — no staging tunnel + no production dashboard change |
| Public webhook URL | **NOT CONFIGURED** locally — Mayar cannot POST to `127.0.0.1` without tunnel |

### Pre-check booleans (`GET /api/health`)

| Flag | Observed |
|---|---|
| `hasMayarApiKey` | **false** |
| `creditTopupEnabled` | **true** |
| `paymentProviderMock` | **true** |
| `mayarEnv` | `sandbox` |

Live Mayar invoice create was **blocked** because `MAYAR_API_KEY` is not present in gitignored `apps/api/.dev.vars`. Keys are never logged or committed.

---

## 2. Invoice create result

| Step | Result | Detail |
|---|---|---|
| Live `POST /api/credits/topup/checkout` (starter, Mayar provider) | **NOT RUN** | `hasMayarApiKey=false` |
| Mock checkout regression | **PASS** | `npm run smoke:api:sprint10 -- -MockMode success` |
| Pre-grant balance/ledger guard | **PASS** | No grant before webhook in mock regression |

**Safe error when key missing:** checkout with `PAYMENT_PROVIDER_MOCK=false` returns `503 PAYMENT_PROVIDER_NOT_CONFIGURED` (no balance mutation).

**To run live invoice create (operator, local only):**

1. Obtain sandbox API key from `web.mayar.club` (never commit).
2. Set in `apps/api/.dev.vars`: `MAYAR_API_KEY`, `PAYMENT_PROVIDER_MOCK=false`, `CREDIT_TOPUP_ENABLED=true`, `MAYAR_ENV=sandbox`.
3. Restart `dev:api`.
4. Run `npm run smoke:api:sprint10:mayar-live`.

Expected on success: `provider=mayar`, real `provider_invoice_id`, `provider_transaction_id`, `paymentUrl` host ≠ `mock-return`, order `pending`, no ledger/balance change.

---

## 3. Invoice detail / paymentUrl result

| Step | Result |
|---|---|
| Mayar `GET /invoice/{id}` | **NOT RUN** — no live invoice id captured |
| Checkout `paymentUrl` domain check | **NOT RUN** — live checkout blocked |
| Stored order fields (mock regression) | **PASS** — `provider_invoice_id`, `provider_transaction_id`, `payment_url` persisted |

---

## 4. Webhook payload result (sanitized)

### Source

- Mayar integration docs: [`docs.mayar.id/integration/webhook`](https://docs.mayar.id/integration/webhook)
- Mock + dual-app regression (Tasks 10.3–10.3d)
- New docs-shaped fixture in `sprint10-smoke-api.ps1` (Task 10.5)

### Documented Mayar shape (sanitized example)

```json
{
  "event": "payment.received",
  "id": "…webhook-root-id…",
  "data": {
    "id": "…webhook-data-row-id…",
    "status": true,
    "amount": 39000,
    "transactionId": "…redacted…",
    "merchantId": "…redacted…",
    "productId": "…redacted…",
    "extraData": {
      "app": "vibenovel",
      "flow": "credit_topup",
      "orderId": "…redacted…",
      "productSlug": "starter",
      "idProd": "starter"
    }
  }
}
```

### Field paths (parser)

| Field | Path(s) | Notes |
|---|---|---|
| Event name | `event`, `eventType`, `type` | Grant on `payment.received` |
| Paid signal | `data.status` (boolean `true`, or string `paid`/`success`) | If absent on `payment.received`, parser infers paid (Mayar: event = after payment) |
| Amount | `data.amount` | Must match order `amount_idr` |
| Transaction | `data.transactionId` | Order lookup fallback |
| Invoice correlation | `data.invoiceId`, `data.paymentLinkId` only | **`data.id` is webhook row id** (not invoice) — order match via `extraData.orderId` + `transactionId` |
| Routing | `extraData.app`, `extraData.flow` | `vibenovel` + `credit_topup` only |

### Real payload capture from Mayar network

**NOT RUN** — no public webhook URL registered; no sandbox payment completed in this session.

---

## 5. Webhook headers observed

| Header | Mayar documented | Siklusio layer | VibeNovel |
|---|---|---|---|
| `Content-Type: application/json` | Yes | Yes | Yes |
| `X-Callback-Token` | Not in Mayar public webhook docs | Yes (Siklusio custom) | **No** validation today |
| HMAC / signature header | **Not found** in Mayar public docs | N/A | **Deferred** |
| Retry | Mayar has `/webhook/retry` API | Unknown live behavior | Idempotency via `payload_hash` |

**Signature supported:** **no/unknown** in public Mayar docs. **Recommended hardening:** keep `payload_hash` + amount/order validation; optional shared forward token Siklusio→VibeNovel (deferred); consider route-level secret on VibeNovel webhook before production.

---

## 6. Grant / idempotency result

| Test | Result |
|---|---|
| Mock webhook grant (+100) | **PASS** |
| Duplicate webhook (no double grant) | **PASS** |
| Amount mismatch (no grant) | **PASS** |
| Foreign app / legacy Siklusio (no grant) | **PASS** |
| Mayar docs-shaped fixture (boolean `status`, `data.id` ≠ invoice id) | **PASS** after parser hardening |
| Dual-app Siklusio→VibeNovel forward | **PASS** (`smoke:api:sprint10:dual-app`) |
| **Live sandbox paid webhook grant** | **NOT RUN** — no payment + no public URL |
| Live duplicate replay | **NOT RUN** |

---

## 7. Parser / code changes (Task 10.5)

| File | Change |
|---|---|
| `apps/api/src/services/mayar-webhook.ts` | Infer `isPaid=true` when `payment.received` and `status` absent; **exclude `data.id` from invoice correlation** (Mayar docs: webhook row id); use `invoiceId`/`paymentLinkId` only |
| `scripts/sprint10-dual-app-smoke.ps1` | Webhook fixture uses `invoiceId` + separate `data.id` webhook row |
| `apps/web/e2e/sprint10-topup-flow.spec.ts` | Webhook fixture `invoiceId` field |
| `scripts/sprint10-smoke-api.ps1` | Added `mayar docs-shaped webhook grant` regression step |
| `scripts/sprint10-mayar-live-smoke.ps1` | **New** — live smoke orchestrator (booleans only, no key logging) |
| `package.json` | `smoke:api:sprint10:mayar-live` |

No grant logic changes. No pricing/migration/UI changes.

---

## 8. Regression result

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run smoke:api:sprint10 -- -MockMode success` | **PASS** 25/25 (incl. docs-shaped fixture) |
| `npm run smoke:api:sprint10:dual-app` | **PASS** 13/13 |
| `npm run smoke:api:sprint10:mayar-live` | **PASS** (pre-check; live NOT RUN without key) |
| `npm run smoke:web:topup` | **PASS** |
| `npm run smoke:all:local` | At verification |
| `npm run smoke:api:sprint10:mayar-live` | **PASS** (pre-check + NOT RUN live steps — expected without key) |
| `npm run smoke:api:sprint10:dual-app` | Run at verification time |
| `npm run smoke:web:topup` | Run at verification time |
| `npm run smoke:all:local` | Run at verification time |

---

## 9. Rollback result

Current local `.dev.vars` (gitignored) remains safe default for dev:

| Variable | Recommended rollback |
|---|---|
| `CREDIT_TOPUP_ENABLED` | `true` for local smoke OK; use `false` before any shared/staging |
| `PAYMENT_PROVIDER_MOCK` | **`true`** (restores mock checkout) |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` |
| `MAYAR_MULTI_APP_ROUTER_ENABLED` (Siklusio) | **`false`** — unchanged |
| Mayar production dashboard URL | **Unchanged** — still Siklusio |

No payment/order rows deleted. Test orders from mock/dual-app smoke remain in local DB (acceptable).

---

## 10. Go / No-Go decision

### **PARTIAL GO**

| Criterion | Status |
|---|---|
| Live invoice create works | **NOT VERIFIED** — `hasMayarApiKey=false` |
| paymentUrl works | **NOT VERIFIED** live |
| Webhook payload captured from Mayar network | **NOT RUN** — needs tunnel/staging |
| Parser supports documented + fixture shapes | **PASS** |
| Paid event grants exactly once | **PASS** (mock + dual-app); **NOT RUN** live paid |
| Amount/order validation | **PASS** (regression) |
| Duplicate no double grant | **PASS** |
| No secret leak | **PASS** |
| Rollback safe | **PASS** |

### Production gates (still required)

1. Operator runs live smoke with sandbox key: `npm run smoke:api:sprint10:mayar-live`.
2. Register **staging** webhook URL (tunnel or Worker staging); capture **one** real `payment.received` payload (redacted into this doc).
3. Replay dual-app smoke on **Siklusio staging + VibeNovel staging** before `MAYAR_MULTI_APP_ROUTER_ENABLED=true` in production.
4. Ops Go/No-Go on router + `CREDIT_TOPUP_ENABLED` production enable.

### NO-GO triggers (none observed in regression)

- Invoice create failure with valid key
- Wrong-order grant
- Duplicate double grant
- Secret leak in API response

---

## 11. Remaining risks

| Risk | Mitigation |
|---|---|
| Real `data.id` is webhook row id, not invoice id | Match via `extraData.orderId` + `transactionId` (tested in docs-shaped fixture) |
| Mayar `data.status` boolean vs string | Parser handles both; infers paid on `payment.received` if status absent |
| No Mayar HMAC in public docs | `payload_hash` + amount validation + order state machine |
| Local webhook unreachable | Staging/tunnel required for live capture |
| Siklusio router production | Staging replay mandatory (10.3d local PASS only) |

---

## 12. Next recommended task

**Task 10.8** — Mayar staging live execution — see [`docs/54`](54-mayar-staging-live-execution-report.md).

**Task 10.8 result (2026-06-08):** **BLOCKED** — `hasMayarApiKey=false`, no public webhook URL. Live invoice/webhook **NOT RUN**. Mock regression still PASS.

**Ops follow-up:** [`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md) — runbook, support checklist, smoke matrix.

---

*Report authored Task 10.5 — 8 Juni 2026. Task 10.8 addendum in `docs/54`.*