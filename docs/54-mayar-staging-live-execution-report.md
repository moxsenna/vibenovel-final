# 54 — Mayar Staging Live Execution Report (Task 10.8)

**Date:** 2026-06-08  
**Status:** Closed — **BLOCKED** (live steps not executed)  
**Sprint:** 10 (post-closure operational task)  
**Related:** [`docs/51`](51-mayar-sandbox-live-smoke-report.md), [`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md), [`docs/53`](53-sprint-10-verification-report.md), [`.agent-logs/sprint-10/task-10.8-mayar-staging-live-execution.md`](../.agent-logs/sprint-10/task-10.8-mayar-staging-live-execution.md)

Task 10.8 attempts **live/staging Mayar verification** beyond Task 10.5: sandbox invoice create, invoice detail, real `payment.received` webhook capture, parser validation against real payload, live duplicate/idempotency, and Siklusio staging router replay.

**No secrets committed or logged.** Production payment remains **NOT ENABLED**.

---

## 1. Environment used

| Item | Value |
|---|---|
| API | Local `http://127.0.0.1:8787` (`wrangler dev`) |
| Database | Local Supabase `http://127.0.0.1:54321` |
| Web | Local `http://localhost:5173` (regression only) |
| Siklusio backend | Local `http://127.0.0.1:3000` (mock dual-app regression only) |
| Mayar env | `sandbox` (default) |
| Mayar API base | `https://api.mayar.club/hl/v1` |
| Mayar dashboard (testing) | `https://web.mayar.club` per Mayar docs |
| VibeNovel staging deploy | **NOT AVAILABLE** — no staging Worker URL in repo |
| Siklusio staging deploy | **NOT AVAILABLE** — not configured for this session |
| Public webhook URL / tunnel | **NOT CONFIGURED** |

### Pre-check booleans (`GET /api/health`)

| Flag | Observed |
|---|---|
| `creditTopupEnabled` | **true** |
| `paymentProviderMock` | **true** |
| `mayarEnv` | `sandbox` |
| `hasMayarApiKey` | **false** |
| `aiGenerationEnabled` | **false** |
| `aiProviderMock` | **true** |

### `.dev.vars` inspection (names only — gitignored, not committed)

| Variable | Present |
|---|---|
| `MAYAR_API_KEY` | **No** — empty or unset |
| `CREDIT_TOPUP_ENABLED=true` | Yes |
| `PAYMENT_PROVIDER_MOCK=true` | Yes (blocks live Mayar network) |
| `PAYMENT_PROVIDER_MOCK=false` | No |

**Live execution stopped** per Task 10.8 preflight: `hasMayarApiKey=false`. No live steps faked.

---

## 2. Public webhook / staging URL decision

| Option | Path | Decision |
|---|---|---|
| **A** — VibeNovel staging direct | Mayar sandbox → `POST /api/payments/mayar/webhook` on staging Worker | **NOT AVAILABLE** — no staging deploy plan executed |
| **B** — Siklusio staging router | Mayar sandbox → Siklusio staging → forward to VibeNovel staging | **NOT AVAILABLE** — no staging URLs configured |
| **C** — Temporary tunnel | Local API via ngrok/cloudflared | **NOT CONFIGURED** |

**Mayar production dashboard:** unchanged (not touched).

**Sandbox webhook registration:** not attempted — requires public URL + operator sandbox key.

**Preferred path when unblocked:** Option B (Siklusio staging router) for production-like multi-app routing; Option A acceptable for direct VibeNovel-only sandbox test.

---

## 3. Invoice create result

| Step | Result | Detail |
|---|---|---|
| `npm run smoke:api:sprint10:mayar-live` | **BLOCKED** | `hasMayarApiKey=false` + `PAYMENT_PROVIDER_MOCK=true` |
| Live `POST /api/credits/topup/checkout` (starter, Mayar) | **NOT RUN** | Requires `MAYAR_API_KEY` + `PAYMENT_PROVIDER_MOCK=false` + restart `dev:api` |
| Mock checkout regression | **PASS** | `npm run smoke:api:sprint10` — mock checkout + no pre-grant |

**Operator unblock steps (local, never commit secrets):**

1. Obtain sandbox API key from `https://web.mayar.club`
2. Set in `apps/api/.dev.vars`: `MAYAR_API_KEY`, `PAYMENT_PROVIDER_MOCK=false`, `CREDIT_TOPUP_ENABLED=true`, `MAYAR_ENV=sandbox`, `MAYAR_BASE_URL=https://api.mayar.club/hl/v1`, `MAYAR_REDIRECT_BASE_URL=http://localhost:5173`
3. Restart `dev:api`
4. Register public webhook URL (tunnel or staging) in Mayar **sandbox** dashboard
5. Re-run `npm run smoke:api:sprint10:mayar-live`

---

## 4. Invoice detail result

| Step | Result |
|---|---|
| Mayar `GET /invoice/{id}` | **NOT RUN** — no live invoice id captured |
| `mayar-client.ts` GET detail helper | **Not implemented** — create-only client today |
| Stored order correlation | N/A — no live order |

**Note:** GET detail is non-critical if invoice create + webhook capture succeed; blocked here because invoice create did not run.

---

## 5. PaymentUrl / sandbox payment result

| Step | Result |
|---|---|
| Open live `paymentUrl` | **NOT RUN** |
| Complete sandbox payment | **NOT RUN** |
| Mayar dashboard webhook test button | **NOT RUN** — no public URL registered |

Mayar docs: sandbox testing uses `https://web.mayar.club`; webhook test available from Integration → Webhook after URL registration.

---

## 6. Webhook payload sanitized shape

### Real Mayar network capture

**NOT CAPTURED** — no public webhook URL, no sandbox payment, no `MAYAR_API_KEY`.

### Docs + regression reference shape (sanitized — not from live network)

```json
{
  "event": "payment.received",
  "data": {
    "id": "<redacted; Mayar docs: webhook row id, NOT invoice id>",
    "invoiceId": "<redacted>",
    "paymentLinkId": "<redacted>",
    "transactionId": "<redacted>",
    "amount": 39000,
    "status": true,
    "extraData": {
      "app": "vibenovel",
      "flow": "credit_topup",
      "orderId": "<redacted>",
      "productSlug": "starter"
    }
  }
}
```

**Parser field paths confirmed** against docs + mock fixture (`scripts/sprint10-smoke-api.ps1` step `mayar docs-shaped webhook grant`): **PASS**.

---

## 7. Webhook headers / signature finding

Inspected Mayar public docs ([webhook integration](https://docs.mayar.id/integration/webhook), [register URL hook](https://docs.mayar.id/api-reference/webhook/registerurlhook)):

| Header / mechanism | Mayar documented | Observed live |
|---|---|---|
| `Content-Type: application/json` | Yes | **NOT OBSERVED** (no live webhook) |
| HMAC / signature header | **Not found** in public docs | **NOT OBSERVED** |
| Timestamp header | **Not found** | **NOT OBSERVED** |
| Event id / retry count header | **Not found** | **NOT OBSERVED** |
| `X-Callback-Token` | **Not in Mayar docs** | Siklusio custom layer only |

**Current guards (interim):** `payload_hash` dedupe, `orderId` / invoice / transaction correlation, amount match, `app`/`flow` routing, idempotent grant.

**Recommended next hardening (if live headers show no signature):** optional `X-VibeNovel-Forward-Token` validation; route-level shared secret on VibeNovel webhook.

---

## 8. Grant result

| Test | Result |
|---|---|
| Live paid webhook grant | **NOT RUN** |
| Mock webhook grant (+100) | **PASS** — `smoke:api:sprint10` |
| Docs-shaped fixture grant | **PASS** |
| Dual-app mock forward grant | **PASS** — `smoke:api:sprint10:dual-app` 13/13 |
| Order `paid`, `paid_at`, ledger `credit_topup` ×1 | **PASS** (mock/dual-app only) |
| Audit `payment_webhook_processed` + `credit_topup_granted` | **PASS** (mock/dual-app only) |
| No AI/canon mutation | ✅ |
| No secret/raw payload in API response | ✅ |

**Siklusio side effects (VibeNovel payload):** not exercised on live path. Local dual-app confirms: `routed=vibenovel`, no VibeNovel grant on non-vibenovel payloads.

---

## 9. Duplicate / idempotency replay

| Test | Result |
|---|---|
| Live duplicate replay (exact captured payload) | **NOT RUN** — no captured live payload |
| Mock duplicate replay | **PASS** — `smoke:api:sprint10` |
| Dual-app duplicate replay | **PASS** — `smoke:api:sprint10:dual-app` |

**Do not claim live duplicate verified.** Mock evidence remains valid for regression only.

---

## 10. Amount mismatch result

| Test | Result |
|---|---|
| Live-style mismatch on real paid order | **NOT RUN** — no live order |
| Mock amount mismatch (no grant) | **PASS** — `smoke:api:sprint10` `webhook amount mismatch no grant` |

---

## 11. Siklusio staging router replay

| Test | Result |
|---|---|
| Staging Siklusio → VibeNovel with real-shape payload | **NOT RUN** — no staging URLs |
| Local mock dual-app replay | **PASS** 13/13 (regression, not live) |
| `MAYAR_MULTI_APP_ROUTER_ENABLED` in production | **Blocked** until staging replay |

---

## 12. Parser / code changes

| Item | Status |
|---|---|
| Parser changes in Task 10.8 | **None** — no real payload failure observed |
| `mayar-webhook.ts` | Unchanged |
| `sprint10-mayar-live-smoke.ps1` | Report pointer updated to `docs/54` (Task 10.8 label) |

---

## 13. Regression result

No product code changed. Commands run:

| Command | Result |
|---|---|
| `npm run smoke:api:sprint10:mayar-live` | **PASS** precheck; live steps **NOT RUN** (blocked) |
| `npm run smoke:api:sprint10` | **PASS** 25/25 |
| `npm run smoke:api:sprint10:dual-app` | **PASS** 13/13 |
| `npm run smoke:web:topup` | **PASS** |
| `npm run smoke:all:local` | **NOT RUN** — skipped (14 phases; mock matrix already covered by sprint10 + web:topup) |
| `npm run typecheck` / `build:*` | **NOT RUN** — no code changes |

---

## 14. Rollback result

Current local env remains **safe default** (no live changes applied):

| Variable | Current / recommended |
|---|---|
| `CREDIT_TOPUP_ENABLED` | `true` (local dev) — production default remains `false` |
| `PAYMENT_PROVIDER_MOCK` | `true` |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` |
| `AI_GENERATION_ENABLED` | `false` |
| `MAYAR_MULTI_APP_ROUTER_ENABLED` (Siklusio) | `false` unless dual-app test |
| Mayar production dashboard | **Unchanged** |

`GET /api/health` after session: `hasMayarApiKey=false`, `paymentProviderMock=true` — safe.

No ledger/order rows deleted.

---

## 15. Go / No-Go decision

### Criteria assessment

| Criterion | Result |
|---|---|
| Live sandbox invoice create PASS | **NOT RUN** |
| Invoice detail PASS | **NOT RUN** |
| Real `payment.received` webhook captured | **NOT RUN** |
| Parser supports real payload | **PARTIAL** — docs/fixture PASS only |
| Paid event grants exactly once (live) | **NOT RUN** |
| Live duplicate no double grant | **NOT RUN** |
| Amount/order validation (live) | **NOT RUN** — mock PASS |
| Siklusio staging router replay | **NOT RUN** |
| No secret leak | ✅ |
| Rollback safe | ✅ |

### Decision

| Verdict | **BLOCKED** |
|---|---|
| Meaning | Operator prerequisites missing: `MAYAR_API_KEY`, `PAYMENT_PROVIDER_MOCK=false`, public webhook URL |
| Production payment | **NOT PRODUCTION READY** / **PARTIAL GO** (unchanged) |
| Live Mayar GO | **NO** — cannot claim GO without real webhook capture + grant validation |

**Not NO-GO** on product safety — mock/dual-app regression still PASS. **BLOCKED** on operational prerequisites only.

---

## 16. Remaining blockers

1. Add `MAYAR_API_KEY` to gitignored `apps/api/.dev.vars` (sandbox key from `web.mayar.club`)
2. Set `PAYMENT_PROVIDER_MOCK=false` and restart `dev:api`
3. Provision public webhook URL (staging Worker deploy **or** temporary tunnel)
4. Register sandbox webhook URL in Mayar sandbox dashboard (not production Siklusio URL without approval)
5. Run live invoice create (max 1–2 starter invoices)
6. Complete sandbox payment or Mayar webhook test tool
7. Capture sanitized real webhook payload + headers into this doc appendix
8. Validate grant exactly once + live duplicate replay
9. Replay Siklusio staging router → VibeNovel staging grant
10. Decide webhook auth hardening (signature vs forward token vs route secret)
11. True DB RPC atomic grant strategy before production
12. Refund/chargeback SOP + production secret checklist

---

## Next recommended task

**Task 10.8b — Operator Mayar Sandbox Live Run** (human-in-the-loop)

Requires operator to:

1. Add sandbox `MAYAR_API_KEY` locally or on staging Worker secrets
2. Expose public webhook (tunnel or staging deploy)
3. Re-run Task 10.8 checklist and append live results to `docs/54` §appendix

**Alternative:** **Task 11.0 — Production Deploy/Staging Readiness Plan** if staging Worker deploy is chosen before local tunnel test.

**Task 10.9 addendum:** Duitku evaluated as alternative — see [`docs/55`](55-duitku-provider-spike-and-migration-feasibility.md). Mayar path remains valid; Duitku POP may unblock sandbox testing without Siklusio router.

---

*Report authored Task 10.8 — 8 Juni 2026. Live Mayar NOT VERIFIED. Production payment BLOCKED.*