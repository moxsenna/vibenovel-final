# 75 — Apply Migration 00010 to Hosted Staging Supabase (Task 10.17)

**Date:** 2026-06-10  
**Status:** Closed — **GO**  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/74`](74-atomic-grant-db-rpc-report.md), [`docs/73`](73-duitku-production-payment-enable-plan.md), [`.agent-logs/sprint-10/task-10.17-apply-migration-00010-hosted-staging.md`](../.agent-logs/sprint-10/task-10.17-apply-migration-00010-hosted-staging.md)

Staging-only operator task: apply atomic grant migration to **hosted staging** Supabase and verify RPC behavior. **Production untouched.** **Production payment NOT ENABLED.**

---

## 1. Preflight — hosted staging target

| Check | Result |
|---|---|
| Target | **Hosted staging** — project ref `jdxyhrnibmmwlbtbokqo` (`*.supabase.co`) |
| Linked project name (sanitized) | `vibenovel-final` (Supabase dashboard name) |
| Production Supabase | **NOT touched** |
| Credential source | Gitignored `.env.staging` (names only in report) |
| Staging API | `https://api-staging.narraza.web.id` |

### Health before task (Mode A)

| Flag | Value |
|---|---|
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

---

## 2. Migration 00010 inspection

| Item | Assessment |
|---|---|
| Function `grant_paid_credit_topup_atomic` | Additive `CREATE OR REPLACE` |
| Index `credit_ledger_topup_order_id_unique_idx` | `IF NOT EXISTS` — safe |
| Data destructive statements | **None** |
| `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO service_role` | Present |
| Rollback | Forward-only: `DROP FUNCTION` + `DROP INDEX` if approved |

**Risk:** Unique index could fail if duplicate `metadata.orderId` in existing topup ledger rows. **Apply result: no error** — index created successfully on hosted staging.

---

## 3. Migration apply

| Item | Value |
|---|---|
| Method | `supabase db push` (linked project `jdxyhrnibmmwlbtbokqo`) |
| File | `supabase/migrations/00010_atomic_grant_credit_topup_rpc.sql` |
| Result | **PASS** — migration applied |
| `supabase migration list --linked` | `00010 \| 00010` local/remote match |

---

## 4. RPC and index verification (hosted)

| Check | Method | Result |
|---|---|---|
| Function exists | `admin.rpc(...)` callable via REST | **PASS** — `unknown_order` returned for fake id |
| Index exists | Implied by successful grant + idempotency tests | **PASS** |
| `service_role` execute | Hosted grant test suite via service role key | **PASS** |
| `anon` direct execute | Not required for MVP — API uses service role only | N/A |

**Note:** `supabase db query --linked` hit pooler circuit breaker during parallel CLI attempts; verification used REST RPC + migration list instead (sufficient evidence).

---

## 5. Hosted atomic grant verification

Test harness: `npm run test:atomic-grant-hosted` + `npm run operator:staging:atomic-grant`

Test data: ephemeral users `task-10-17-hosted-*@narraza-staging.test` — clearly marked staging test orders.

| Case | Result |
|---|---|
| First grant | **PASS** — balance +100, ledger +1, order `paid` |
| Duplicate grant | **PASS** — `already_granted`, no extra ledger/balance |
| Unknown order | **PASS** — `unknown_order`, no grant |
| Amount mismatch | **PASS** — `amount_mismatch`, order stays `pending` |

---

## 6. API integration smoke (staging API)

| Command | Result | Notes |
|---|---|---|
| `npm run smoke:api:sprint10:duitku -StagingMode` | **NOT RUN** | Staging API Mode A: `creditTopupEnabled=false` — callback fixture requires topup enabled on API; intentionally not changed |
| Direct hosted DB RPC tests | **PASS** | Proves RPC on same Supabase used by staging API |

**Staging API still uses updated grant code on next deploy** — migration is DB-side; current EC2 image may predate 10.16 API RPC integration until next API deploy. **DB RPC is live on hosted Supabase regardless.**

---

## 7. Final staging health (Mode A)

| Flag | Value |
|---|---|
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

**No Mode B / no payment enablement during this task.**

---

## 8. Verification commands

| Command | Result |
|---|---|
| `supabase db push` | **PASS** |
| `supabase migration list --linked` | **PASS** |
| `npm run test:atomic-grant-hosted` | **PASS** |
| `npm run operator:staging:atomic-grant` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run smoke:api:sprint10:duitku` (staging API) | **NOT RUN** (Mode A) |

---

## 9. Production readiness impact

| Item | Status |
|---|---|
| Hosted staging migration `00010` | ✅ **Applied** |
| Production migration `00010` | ⬜ **Pending** — production Supabase not touched |
| Production payment | **NOT READY** — gated per docs/73 |

---

## 10. Rollback (staging)

If RPC must be removed (operator approval only):

```sql
DROP FUNCTION IF EXISTS public.grant_paid_credit_topup_atomic(uuid, text, text, text, integer, uuid, jsonb);
DROP INDEX IF EXISTS public.credit_ledger_topup_order_id_unique_idx;
```

Do **not** delete `credit_topup_orders`, `credit_ledger`, or `payment_webhook_events` rows.

---

## 11. Remaining blockers

- Apply `00010` on **production** Supabase (separate founder approval)
- Production enable execution docs/73 §7
- ~~Optional: redeploy staging API so callback path uses RPC integration (10.16 code)~~ — **Done Task 10.18** ([`docs/76`](76-redeploy-staging-api-rpc-grant-integration-report.md))
- ~~`smoke:api:sprint10:duitku` against staging API deferred~~ — **Done Task 10.18** (fixture matrix PASS)

---

## 12. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | Migration applied; hosted RPC verified; Mode A preserved |
| Production touched | **NO** |

---

## Final summary

```txt
Task 10.17 — Apply Migration 00010 to Hosted Staging Supabase
Status: GO

Target: jdxyhrnibmmwlbtbokqo (hosted staging)
Production touched: no

Migration: 00010_atomic_grant_credit_topup_rpc.sql — applied via supabase db push

Hosted atomic grant: PASS (first, duplicate, unknown, amount mismatch)
Final Mode A: safe

Next: production migration + docs/73 founder Go (separate approval)
```