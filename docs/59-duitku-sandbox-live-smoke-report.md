# 59 — Duitku Sandbox Live Smoke Report (Task 10.13)

**Date:** 2026-06-09  
**Status:** Closed — **BLOCKED** (live steps not executed)  
**Related:** [`docs/58`](58-duitku-callback-idempotent-grant-report.md), [`docs/57`](57-duitku-checkout-integration-report.md), [`.agent-logs/sprint-10/task-10.13-duitku-sandbox-live-smoke.md`](../.agent-logs/sprint-10/task-10.13-duitku-sandbox-live-smoke.md)

Task 10.13 attempts **live Duitku POP sandbox verification**: real `createInvoice`, real `paymentUrl`, real server callback from Duitku, grant via callback, duplicate replay, and sanitized payload/header capture.

**No secrets committed or logged.** Production payment remains **NOT ENABLED**.

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| Credential + public callback preflight | Production enablement |
| LiveCreate sandbox invoice (`-LiveCreate`) | Migration / pricing / package changes |
| Sandbox payment completion | Mayar webhook changes |
| Real callback capture (sanitized) | Admin dashboard |
| Grant + duplicate + negative live-shape tests | Remote production deploy |
| Fixture regression (Task 10.12 matrix) | Grant from redirect/return URL |

---

## 2. Environment / preflight

| Item | Value |
|---|---|
| API | Local `http://127.0.0.1:8787` (`wrangler dev`) |
| Database | Local Supabase `http://127.0.0.1:54321` |
| Web | Local `http://localhost:5173` (mock regression only) |
| Duitku env | `sandbox` (default) |
| Duitku API base | `https://api-sandbox.duitku.com` (default) |
| VibeNovel staging Worker | **NOT AVAILABLE** — no staging deploy URL in repo |
| Public callback URL / tunnel | **NOT CONFIGURED** |

### Pre-check booleans (`GET /api/health`)

| Flag | Observed |
|---|---|
| `creditTopupEnabled` | **true** |
| `paymentProviderMock` | **true** |
| `paymentProvider` | `mock` |
| `duitkuEnv` | `sandbox` |
| `hasDuitkuMerchantCode` | **false** |
| `hasDuitkuMerchantKey` | **false** |
| `hasDuitkuCallbackUrl` | **false** |
| `duitkuCallbackUrlIsPublic` | **false** |
| `duitkuSmokeCallbackFixture` | **true** |
| `aiGenerationEnabled` | **false** |

### `.dev.vars` inspection (names only — gitignored, not committed)

| Variable | Present |
|---|---|
| `DUITKU_MERCHANT_CODE` | **No** |
| `DUITKU_MERCHANT_KEY` | **No** |
| `DUITKU_CALLBACK_URL` | **No** |
| `PAYMENT_PROVIDER=duitku` | **No** (mock wins) |
| `PAYMENT_PROVIDER_MOCK=true` | **Yes** |
| `CREDIT_TOPUP_ENABLED=true` | **Yes** |

**Live execution stopped** per Task 10.13 preflight: missing Duitku credentials + mock mode active + no public callback URL. No live steps faked.

---

## 3. Public callback URL decision

| Option | Path | Decision |
|---|---|---|
| **A** — VibeNovel staging Worker | `https://<staging>/api/payments/duitku/callback` | **NOT AVAILABLE** — no staging deploy |
| **B** — Temporary tunnel | `https://<tunnel>/api/payments/duitku/callback` | **NOT CONFIGURED** |
| **C** — Local-only without callback | LiveCreate only, no callback | **Not pursued** — credentials also missing |

**Production endpoint:** not used.

**Preferred path when unblocked:** Option A (staging Worker) or Option B (cloudflared/ngrok tunnel) with `DUITKU_CALLBACK_URL` pointing to public host.

---

## 4. LiveCreate invoice result

| Step | Result | Detail |
|---|---|---|
| `npm run smoke:api:sprint10:duitku -- -LiveCreate` | **NOT RUN** | `hasDuitkuMerchantCode=false`, `PAYMENT_PROVIDER_MOCK=true` |
| Live `POST /api/credits/topup/checkout` (starter, Duitku) | **NOT RUN** | Requires credentials + `PAYMENT_PROVIDER=duitku` + `PAYMENT_PROVIDER_MOCK=false` + restart `dev:api` |
| Fixture callback regression | **PASS** | Default smoke — 15 PASS, 0 FAIL |

**Operator unblock steps (local, never commit secrets):**

1. Obtain sandbox merchant code + API key from [Duitku merchant portal](https://docs.duitku.com/pop/id/)
2. Set in `apps/api/.dev.vars`:
   - `CREDIT_TOPUP_ENABLED=true`
   - `PAYMENT_PROVIDER=duitku`
   - `PAYMENT_PROVIDER_MOCK=false`
   - `DUITKU_ENV=sandbox`
   - `DUITKU_MERCHANT_CODE=<sandbox>`
   - `DUITKU_MERCHANT_KEY=<sandbox>`
   - `DUITKU_CALLBACK_URL=https://<public-host>/api/payments/duitku/callback`
   - `DUITKU_RETURN_URL=http://localhost:5173`
3. Restart `npm run dev:api`
4. Run `npm run smoke:api:sprint10:duitku -- -LiveCreate`
5. Complete sandbox payment in Duitku UI (starter / smallest amount only)
6. Verify callback delivery + grant; optional `-ExpectCallback` flag documents awaiting steps

---

## 5. Sandbox payment result

| Step | Result |
|---|---|
| Open Duitku `paymentUrl` | **NOT RUN** — no live invoice created |
| Complete sandbox payment (QRIS/VA/CC/etc.) | **NOT RUN** |
| Payment method recorded | N/A |

---

## 6. Callback payload sanitized sample

**NOT CAPTURED** — no real Duitku server callback received.

Expected shape per [Duitku POP Callback docs](https://docs.duitku.com/pop/id/):

```json
{
  "merchantCode": "<redacted>",
  "amount": "39000",
  "merchantOrderId": "<order-uuid-redacted>",
  "reference": "<redacted>",
  "resultCode": "00",
  "paymentCode": "<method>",
  "signature": "<present-redacted>"
}
```

Fixture evidence (Task 10.12) confirms parser + signature + grant path locally.

---

## 7. Callback header finding

**NOT CAPTURED** — no live callback received.

Expected per Duitku POP:

| Header | Expected |
|---|---|
| `content-type` | `application/x-www-form-urlencoded` |
| `user-agent` | Duitku server (name only if observed) |

No Duitku-specific auth headers required for callback (signature in form body).

---

## 8. Grant verification

| Check | Result |
|---|---|
| `credit_topup_orders.status=paid` after live callback | **NOT RUN** |
| `paid_at` set | **NOT RUN** |
| `payment_webhook_events` processed | **NOT RUN** |
| `credit_balances` +100 exactly once | **NOT RUN** |
| Single `credit_ledger` row `reason=credit_topup` | **NOT RUN** |
| Fixture grant matrix | **PASS** (15 steps including paid_success, duplicate, negatives) |

---

## 9. Duplicate replay

| Path | Result |
|---|---|
| Live replay of captured Duitku callback | **NOT RUN** — no captured payload |
| Fixture duplicate replay | **PASS** — no double grant, balance unchanged on second POST |

---

## 10. Negative live-shape tests

| Test | Live result | Fixture result |
|---|---|---|
| Invalid signature | **NOT RUN** | **PASS** |
| Amount mismatch | **NOT RUN** | **PASS** |
| `resultCode` non-00 | **NOT RUN** | **PASS** |
| Unknown `merchantOrderId` | **NOT RUN** | **PASS** |
| Wrong merchant code | **NOT RUN** | **PASS** |
| Malformed content-type | **NOT RUN** | **PASS** |

---

## 11. Return page behavior

| Check | Result |
|---|---|
| `/credits/topup/return` shows pending + refresh only | **NOT RUN** (no live redirect) |
| Return does not grant | **API guarantee** — grant only via `POST /api/payments/duitku/callback` |
| No ledger/provider payload in UI | **PASS** (existing web smoke mock) |
| `npm run smoke:web:topup` | **PASS** (mock mode) |

---

## 12. Code changes

| File | Change |
|---|---|
| `apps/api/src/env.ts` | Added `hasDuitkuCallbackUrl`, `duitkuCallbackUrlIsPublic` health booleans (no URL values exposed) |
| `scripts/sprint10-duitku-smoke-api.ps1` | Task 10.13 preflight (callback URL public check), live-blocked step matrix, `-ExpectCallback` switch, report → `docs/59` |

No changes to `credit-topup-grant.ts`, pricing, packages, or Mayar code.

---

## 13. Regression result

| Command | Result |
|---|---|
| `npm run typecheck:api` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run smoke:api:sprint10:duitku` | **PASS** (15 PASS, 1 BLOCKED preflight, 0 FAIL) |
| `npm run smoke:api:sprint10` | **PASS** (25 PASS) |
| `npm run smoke:api` | **PASS** (17 PASS) |
| `npm run smoke:api:sprint5` | **PASS** (49 PASS) |
| `npm run smoke:api:sprint6` | **PASS** (68 PASS) |
| `npm run smoke:api:sprint7` | **PASS** (53 PASS) |
| `npm run smoke:api:sprint8` | **PASS** (8 PASS) |
| `npm run smoke:api:sprint9` | **PASS** (10 PASS) |
| `npm run smoke:web:topup` | **PASS** (2 PASS) |
| `npm run smoke:all:local` | **PASS** (14/14 phases) |

---

## 14. Rollback result

Post-smoke environment already in safe default:

| Setting | Status |
|---|---|
| `PAYMENT_PROVIDER_MOCK=true` | ✅ unchanged |
| `PAYMENT_PROVIDER=mock` (effective) | ✅ unchanged |
| `CREDIT_TOPUP_ENABLED=true` | ✅ (local dev; no live payment) |
| `AI_GENERATION_ENABLED=false` | ✅ |
| Production dashboard/payment | ✅ not enabled |
| Secrets in gitignored env only | ✅ |

No rollback action required — live Duitku was never enabled.

---

## 15. Go / No-Go

| Criterion | Status |
|---|---|
| LiveCreate succeeds | ❌ **NOT RUN** |
| `paymentUrl` works | ❌ **NOT RUN** |
| Sandbox payment completed | ❌ **NOT RUN** |
| Real callback captured | ❌ **NOT RUN** |
| Valid callback grants +100 once | ❌ **NOT RUN** (fixture ✅) |
| Duplicate replay no double grant | ❌ live **NOT RUN** (fixture ✅) |
| Negative tests no grant | ❌ live **NOT RUN** (fixture ✅) |
| Return page does not grant | ✅ API guarantee + mock web smoke |
| No secrets leaked | ✅ |
| Rollback safe | ✅ |

### Verdict: **BLOCKED**

Reasons:

1. No `DUITKU_MERCHANT_CODE` / `DUITKU_MERCHANT_KEY` in local `.dev.vars`
2. `PAYMENT_PROVIDER_MOCK=true` blocks live Duitku network
3. No public `DUITKU_CALLBACK_URL` — Duitku cannot POST callback to localhost

**Fixture path:** **GO** — callback grant matrix PASS 15/15 (Task 10.12 regression intact).

**Sandbox live Duitku:** **NO-GO** until operator provides credentials + public callback URL.

**Production Duitku:** **NOT ENABLED** / **NOT READY**.

---

## 16. Remaining blockers

1. **Operator:** sandbox Duitku merchant credentials in gitignored `.dev.vars`
2. **Infrastructure:** public callback URL (staging Worker or tunnel) — `duitkuCallbackUrlIsPublic=true` required
3. **Operator:** set `PAYMENT_PROVIDER=duitku`, `PAYMENT_PROVIDER_MOCK=false`, restart API
4. **Manual:** complete sandbox payment in Duitku UI (starter only, max 12 attempts)
5. **Capture:** sanitized callback payload + headers from real delivery
6. **Verify:** live duplicate replay against captured payload

---

## 17. Next recommended task

**Task 10.13b — Duitku sandbox live execution** (operator-driven): configure credentials + public callback URL, re-run `-LiveCreate`, complete sandbox payment, capture callback, verify grant + duplicate.

**Alternative:** **Task 11.0** — staging deploy plan (unblocks Option A callback URL for both Mayar and Duitku).

---

*Authored Task 10.13 — 9 Juni 2026. Live Duitku sandbox BLOCKED; fixture regression PASS; production NOT ENABLED.*