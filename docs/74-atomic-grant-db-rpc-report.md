# 74 — Atomic Grant DB RPC Report (Task 10.16)

**Date:** 2026-06-10  
**Status:** Closed — **GO**  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/73`](73-duitku-production-payment-enable-plan.md), [`docs/58`](58-duitku-callback-idempotent-grant-report.md), [`.agent-logs/sprint-10/task-10.16-atomic-grant-db-rpc.md`](../.agent-logs/sprint-10/task-10.16-atomic-grant-db-rpc.md)

Engineering P1 hardening: payment callback grant now uses a **single Postgres RPC** for atomic order + ledger + balance mutation. Production payment **remains NOT ENABLED**.

---

## 1. Risk before RPC

| Risk | Pre-10.16 behavior |
|---|---|
| Partial failure | Multi-step service: insert ledger → update balance → mark order paid with compensation runner |
| Order paid, balance unchanged | Possible if balance update failed after ledger insert (compensation mitigated, not atomic) |
| Ledger without paid order | Possible mid-sequence failure before order update |
| Duplicate callback race | Idempotency via metadata lookup + `payment_webhook_events`; no DB unique constraint on ledger/order |
| Concurrent grants | Optimistic balance check (`eq balance`) could 409 under race |

**Mitigation before:** Task 7.8.3 `TransactionPlan` compensation in `credit-topup-grant.ts`.  
**Gap:** Not true `BEGIN/COMMIT` — production payment plan ([`docs/73`](73-duitku-production-payment-enable-plan.md) §6) required RPC.

---

## 2. RPC design

| Item | Value |
|---|---|
| **Name** | `public.grant_paid_credit_topup_atomic` |
| **Migration** | `supabase/migrations/00010_atomic_grant_credit_topup_rpc.sql` |
| **Security** | `SECURITY DEFINER`, `search_path = public`, `GRANT EXECUTE` to `service_role` only |
| **Signature validation** | **Not in RPC** — API layer only (Duitku HMAC / Mayar parser) |

### Inputs

| Parameter | Purpose |
|---|---|
| `p_order_id` | `credit_topup_orders.id` (= Duitku `merchantOrderId`) |
| `p_provider` | Must match order provider |
| `p_provider_invoice_id` | Optional provider reference |
| `p_provider_transaction_id` | Optional provider reference |
| `p_amount_idr` | Amount guard (mismatch → no grant) |
| `p_webhook_event_id` | Stored in ledger metadata |
| `p_metadata` | Sanitized audit metadata merged into ledger |

### Behavior (single transaction)

1. `SELECT … FOR UPDATE` on order row  
2. Validate provider, amount, status (`pending`), credits  
3. Idempotent return if ledger exists for `metadata.orderId`  
4. `INSERT` balance row if missing; `FOR UPDATE` balance  
5. `INSERT` ledger (unique index backstop)  
6. `UPDATE` balance  
7. `UPDATE` order → `paid` + `paid_at`  
8. Return JSON: `granted`, `already_granted`, `order_id`, `user_id`, `credits`, `previous_balance`, `new_balance`, `ledger_id`, `reason`

### Error / soft-fail reasons (no grant)

| reason | Meaning |
|---|---|
| `unknown_order` | Order id not found |
| `amount_mismatch` | `p_amount_idr` ≠ order amount |
| `provider_mismatch` | Provider ≠ order |
| `invalid_status` | Not `pending` |
| `invalid_credits` | `credits_to_grant` invalid |
| `paid_without_ledger` | Order `paid` but no ledger (anomaly) |
| `already_granted` | Idempotent duplicate (not an error) |

### New constraint

```sql
CREATE UNIQUE INDEX credit_ledger_topup_order_id_unique_idx
  ON credit_ledger ((metadata->>'orderId'))
  WHERE direction = 'credit' AND reason = 'credit_topup';
```

Race-safe backstop: concurrent duplicate callbacks cannot insert two ledger rows.

---

## 3. API integration

| File | Change |
|---|---|
| `apps/api/src/services/credit-topup-grant.ts` | `grantCreditsForPaymentSession` calls `admin.rpc('grant_paid_credit_topup_atomic', …)` |
| `process-duitku-payment-callback.ts` | Unchanged — still validates HMAC/status before grant |
| `process-mayar-payment-webhook.ts` | Unchanged — uses shared `grantCreditsForPaymentSession` |

**Preserved:**

- Callback-only grant (never return URL)  
- Pre-RPC API checks: `paymentUrl`, amount, provider id match  
- Audit logs: `credit_topup_granted` / `credit_topup_grant_failed` (API layer)  
- Duitku/Mayar response shapes unchanged  

**Removed from grant path:** multi-step ledger/balance/order updates + `TransactionPlan` compensation (RPC replaces).

---

## 4. Idempotency model

| Layer | Mechanism |
|---|---|
| Webhook events | `payment_webhook_events (provider, payload_hash)` unique |
| Grant | RPC checks existing ledger by `metadata.orderId` |
| DB constraint | Unique index on ledger `orderId` for topup grants |
| Duplicate callback | RPC returns `already_granted=true`; API returns success/idempotent |

---

## 5. Test results

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run test:duitku-signature` | **PASS** |
| `npm run test:atomic-grant` | **PASS** (local Supabase RPC direct) |
| `npm run smoke:api:sprint10:duitku` | **PASS** 15/15 fixture (grant, duplicate, negatives) |

### Idempotency verification

| Case | Result |
|---|---|
| First valid callback | Grant + balance +1 ledger + order paid |
| Duplicate callback | `already_granted` / `duplicate`; no extra ledger/balance |
| Invalid signature | No grant |
| Amount mismatch | No grant; order stays `pending` |
| Unknown order | No grant |
| Non-paid `resultCode` | Ignored; no grant |

**Staging/production RPC apply:** Migration `00010` must be applied on hosted Supabase before production enable. Local applied via `supabase migration up`.

---

## 6. Rollback plan

| Step | Action |
|---|---|
| API rollback | Revert `credit-topup-grant.ts` to pre-RPC multi-step (git revert) |
| DB rollback | Forward-only preferred: `DROP FUNCTION grant_paid_credit_topup_atomic`; drop index only if no dependency issues |
| Data | **Do not** delete orders/ledger/webhook rows |
| Verify | Re-run `smoke:api:sprint10:duitku` after API revert |

---

## 7. Production readiness impact

| Item | Status |
|---|---|
| Atomic grant DB RPC (docs/73 §6 C7) | ✅ **Resolved locally** — staging/prod migration apply pending operator |
| Production payment enable | **Still NOT READY** — other gates in docs/73 remain open |
| Founder approval for production | **Still required** |

---

## 8. Remaining blockers

- Apply migration `00010` on **hosted staging/production** Supabase before production payment  
- Production Duitku merchant + `narraza.id` infrastructure (unchanged)  
- Founder Go/No-Go for production enable (docs/73 §7)  
- Refund SOP final approval  
- Optional: ShopeePay retest; Mayar live proof backlog  

---

## 9. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | RPC + API integration + local tests PASS |
| Production touched | **NO** |
| Secrets exposed | **NO** |

---

## 10. Next recommended task

**Founder-led:** Production enable execution per [`docs/73`](73-duitku-production-payment-enable-plan.md) §7 (after applying `00010` on production Supabase) — **requires explicit founder approval**.

**Operator:** Apply `00010` on hosted staging Supabase + optional staging RPC smoke (Mode A safe default preserved).

**Do not** enable production payment without founder Go.

---

## Final summary

```txt
Task 10.16 — Atomic Grant DB RPC
Status: GO

RPC: grant_paid_credit_topup_atomic (00010)
API: credit-topup-grant.ts uses RPC (Duitku + Mayar shared)

Verification:
  typecheck PASS | build:api PASS
  test:duitku-signature PASS | test:atomic-grant PASS
  smoke:api:sprint10:duitku PASS (15 fixture steps)

Production readiness: NOT READY (RPC done; other gates open)
Next: docs/73 Phase 0–11 with founder approval + migration apply on hosted DB
```