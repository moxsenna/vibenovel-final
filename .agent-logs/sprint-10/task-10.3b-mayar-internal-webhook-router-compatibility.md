# Task 10.3b — Mayar Internal Webhook Router Compatibility Audit

**Date:** 2026-06-08
**Sprint:** sprint-10
**Status:** completed

## Task goal

Audit Siklusio Mayar webhook vs VibeNovel 10.3 webhook; design multi-app router strategy; apply minimal VibeNovel patches so VibeNovel does not blindly claim all Mayar webhooks. **No** Task 10.4 UI; **no** Mayar dashboard URL change; **no** Siklusio production changes in this task.

## Files read

### VibeNovel

- `README.md`, `docs/50`, `docs/36`, task-10.3 work log
- `apps/api/src/routes/payment-webhooks.ts`
- `apps/api/src/services/mayar-webhook.ts`, `process-mayar-payment-webhook.ts`, `credit-topup-grant.ts`, `mayar-client.ts`
- `scripts/sprint10-smoke-api.ps1`

### Siklusio (production: `D:\Coding\remix_-siklusio`)

- `backend/src/routes/webhook.mayar.route.ts`
- `backend/src/controllers/webhook.mayar.controller.ts`
- `backend/src/services/paymentActivationService.ts`
- `backend/src/services/mayar.ts`
- `backend/src/services/checkoutRegistrationService.ts`, `checkoutTopupService.ts`
- `docs/API.md`, `docs/SECURITY.md`, `docs/RUNBOOK.md`, `docs/FEATURE_MATRIX.md`
- `backend/topupWebhook.test.ts`, `checkoutRegister.test.ts`

### Siklusio stub (non-production: `D:\Coding\siklusio`)

- `functions/api/checkout.js` — dummy Mayar URL only; no webhook

## Files created/changed

| Path | Change |
|---|---|
| `apps/api/src/services/mayar-webhook.ts` | `app`/`flow` parse + `resolveMayarWebhookRoute()` |
| `apps/api/src/services/process-mayar-payment-webhook.ts` | Foreign-app gate; legacy no-order → `ignored` |
| `apps/api/src/services/mayar-client.ts` | Checkout `extraData.app=vibenovel`, `flow=credit_topup` |
| `scripts/sprint10-smoke-api.ps1` | `foreign_app_payload`, `legacy_no_vibenovel_order` tests |
| `docs/50` §24 | Router strategy addendum |
| `docs/36`, `README.md`, `apps/api/README.md`, `scripts/README.md` | Status + router notes |
| `.agent-logs/sprint-10/task-10.3b-mayar-internal-webhook-router-compatibility.md` | **Created** |

**Not changed:** Siklusio repo, Mayar dashboard, Task 10.4 UI, grant logic beyond routing gate, `apps/api/.dev.vars` (not committed)

## Siklusio audit results

### 1. Webhook endpoint

| Field | Value |
|---|---|
| Path | `POST /api/payment/webhook` |
| Verify | `GET /api/payment/webhook` → `{ status: "ok" }` |
| Production host | `https://api.siklusio.web.id` (per RUNBOOK) |
| Auth | `X-Callback-Token` must match `MAYAR_WEBHOOK_TOKEN`; 500 if token unset; 401 if invalid |
| Body | JSON; tolerant parse; test ping with empty body → 200 |

### 2. Matching keys

1. `mayar_transaction_id` from `data.id` / `data.transactionId` / `body.id`
2. Lookup `ai_credit_topups.mayar_transaction_id` (AI credit topup flow)
3. Else lookup `checkout_sessions.mayar_transaction_id`
4. Fallback: `customerEmail` + latest `pending` `checkout_sessions` by email
5. Else `pending_registrations` by email → premium activation

**No** `extraData.orderId` usage. **No** `app`/`flow` tags today.

### 3. Invoice extraData (Mayar create)

```json
{
  "noCustomer": "<email>",
  "idProd": "<productId>",
  "productName": "<name>"
}
```

Premium: `idProd=siklusio_premium_lifetime`. Topup: `idProd=coba_dulu` etc.

### 4. Idempotency

- Topup already `paid` → 200 skip
- Session `paid` + CAPI sent → 200 skip (or CAPI retry only)
- `affiliate_conversions.mayar_transaction_id` duplicate → skip
- Topup grant via RPC `process_paid_ai_credit_topup` (atomic)

### 5. Side effects on paid webhook

- `auth.admin.updateUserById` → `siklusio_access_status: active`
- `checkout_sessions.status=paid`
- Premium initial AI credits (`grantPremiumInitialAiCredits`)
- Meta CAPI `Purchase` event
- Fonnte WhatsApp `payment_completed` autoresponder
- Affiliate conversion insert
- CRM lead upsert
- Delete `pending_registrations`

### 6. Risk if Mayar dashboard → VibeNovel URL now

| Impact | Severity |
|---|---|
| Siklusio premium activation stops | **Critical** |
| Siklusio AI topup credits stop | **Critical** |
| Meta CAPI Purchase stops | High |
| WhatsApp payment autoresponder stops | High |
| Affiliate commissions stop | Medium |

VibeNovel would store events as `order_not_found` / `legacy_no_vibenovel_order` — **no Siklusio grant**, but **Siklusio never receives webhook**.

## Router recommendation

| Option | Verdict |
|---|---|
| **A** — Mayar → VibeNovel, forward Siklusio | ❌ Short-term: Siklusio outage if VibeNovel down |
| **B** — Mayar stays Siklusio, forward VibeNovel | ✅ **Short-term 10.3c** — zero dashboard change |
| **C** — Dedicated payments-router worker | ✅ **Long-term production** |

**Action now:** Keep Mayar dashboard on Siklusio. Implement 10.3c forwarder before any URL migration.

## VibeNovel routing gate (10.3b patch)

| Payload | VibeNovel behavior |
|---|---|
| `app=vibenovel`, `flow=credit_topup`, known order | Grant (10.3 path) |
| `app=siklusio` or other app | `ignored` — `foreign_app_payload` |
| `app=vibenovel`, wrong flow | `ignored` — `foreign_flow_payload` |
| Legacy Siklusio shape, no VibeNovel order | `ignored` — `legacy_no_vibenovel_order` |
| `app=vibenovel`, unknown orderId | `failed` — `order_not_found` |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | **PASS** |
| `npm run smoke:api:sprint10 -- -MockMode success` | **PASS** — 24/24 (incl. router cases) |
| `npm run smoke:api:sprint10` (auto w/ topup on) | **PASS** — 24/24 |
| `npm run smoke:api` | **PASS** — 17/17 |
| `npm run smoke:api:sprint5` | **PASS** — 49/49 |
| `npm run smoke:api:sprint6` | **PASS** — 68/68 |
| `npm run smoke:api:sprint7` | **PASS** — 53/53 |
| `npm run smoke:api:sprint8` | **PASS** — 8 PASS, 5 NOT RUN |
| `npm run smoke:api:sprint9` | **PASS** — 10 PASS, 11 NOT RUN |
| `npm run smoke:all:local` | **PASS** — 13/13, ~1.1m |

## Siklusio checklist (no changes made)

| Check | Status |
|---|---|
| Webhook URL unchanged in Mayar dashboard | ✅ Assumed — **not modified** |
| `POST /api/payment/webhook` code untouched | ✅ |
| Siklusio smoke in Siklusio repo | **Not run** (audit-only task; no Siklusio deploy) |
| Production webhook token / secrets | **Not read or committed** |

## Decisions

1. Production Siklusio = `remix_-siklusio` backend, not stub `siklusio` PWA repo.
2. Do **not** migrate Mayar dashboard URL in 10.3b.
3. VibeNovel tags `app`/`flow` at invoice create for future router.
4. Legacy payloads without `app` → ignore (not fail) when no VibeNovel order — reduces noise, no grant.
5. Task 10.4 Topup UI explicitly deferred until 10.3c router.

## Limitations

- No live dual-app webhook replay test.
- Siklusio forwarder not implemented (10.3c).
- Siklusio `extraData.app` patch not applied (separate repo task).
- Mayar single-URL constraint inferred from ops context — not re-verified against Mayar dashboard in this session.

## Next recommended task

**Task 10.3c — Mayar Internal Webhook Router Implementation**

Option B first: Siklusio `handleMayarWebhook` forwards `extraData.app=vibenovel` payloads to VibeNovel webhook URL (server-side, with shared secret). Dual-app smoke + Go/No-Go before dashboard migration. Then Task 10.4 Topup UI.