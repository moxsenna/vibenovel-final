# 77 — Production Payment Preflight and Migration 00010 Approval Gate (Task 10.19)

**Date:** 2026-06-10  
**Status:** Closed — **BLOCKED** (preflight complete; migration **not applied**)  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/73`](73-duitku-production-payment-enable-plan.md), [`docs/74`](74-atomic-grant-db-rpc-report.md), [`docs/75`](75-apply-migration-00010-hosted-staging-report.md), [`docs/76`](76-redeploy-staging-api-rpc-grant-integration-report.md), [`.agent-logs/sprint-10/task-10.19-production-payment-preflight-migration-approval-gate.md`](../.agent-logs/sprint-10/task-10.19-production-payment-preflight-migration-approval-gate.md)

Gated pre-production task: assess production migration `00010` readiness and document approval gate. **Production payment NOT enabled.** **Production migration NOT applied.** **Production untouched.**

---

## 1. Production target identification

| Item | Status | Notes |
|---|---|---|
| **Production Supabase project** | **NOT IDENTIFIED** | Repo/operator env only has **staging** ref `jdxyhrnibmmwlbtbokqo` (`.env.staging`, `apps/web/.env.local`). No `.env.production` or production project ref in repo. |
| **Production API domain** | **NOT DEPLOYED** | Planned: `https://api.narraza.id` ([`docs/73`](73-duitku-production-payment-enable-plan.md)) — DNS resolution **failed** (host not found). |
| **Production web domain** | **NOT DEPLOYED** | Planned: `https://narraza.id` — DNS resolution **failed**. |
| **Production API deployment** | **NOT CONFIGURED** | `apps/api/wrangler.toml` has `[env.staging]` only; no `[env.production]`. No production Docker/EC2 config in repo. |
| **Supabase CLI link** | **Staging only** | `supabase migration list --linked` shows `00001`–`00010` on **linked staging** project — not a separate production link. |
| **Production touched** | **NO** | No production credentials, deploy, callback, or payment action. |

### Staging unchanged (sanity check)

`https://api-staging.narraza.web.id/api/health` — Mode A safe:

| Flag | Value |
|---|---|
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

---

## 2. Migration `00010` readiness assessment

**File:** `supabase/migrations/00010_atomic_grant_credit_topup_rpc.sql`

| Check | Assessment |
|---|---|
| Destructive data deletion | **None** — no `DELETE`/`TRUNCATE`/`DROP TABLE` |
| Function safety | **PASS** — `CREATE OR REPLACE FUNCTION grant_paid_credit_topup_atomic` |
| Unique index | **PASS** — `CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_topup_order_id_unique_idx` |
| Execute grants | **PASS** — `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO service_role` only |
| Secret values in SQL | **None** |
| Staging apply evidence | **PASS** — Task 10.17 on `jdxyhrnibmmwlbtbokqo` ([`docs/75`](75-apply-migration-00010-hosted-staging-report.md)) |
| Staging API E2E | **PASS** — Task 10.18 ([`docs/76`](76-redeploy-staging-api-rpc-grant-integration-report.md)) |

### Production schema prerequisites (from migration dependencies)

Migration `00010` requires prior migrations including `00009` (payment tables):

| Table / object | Required by 00010 |
|---|---|
| `credit_topup_orders` | Yes — RPC reads/updates |
| `credit_ledger` | Yes — insert + unique index |
| `credit_balances` | Yes — balance update |
| `payment_webhook_events` | Used by API layer (not RPC body) |

### Production schema compatibility check

| Check | Result |
|---|---|
| Read-only production DB access | **NOT AVAILABLE** — no production project ref or credentials in operator environment |
| Migration list on production | **NOT RUN** |
| Duplicate `metadata.orderId` in production ledger | **UNKNOWN** — cannot assess without production read access |
| `00009` applied on production | **UNKNOWN** |

**Risk if applied blindly:** Unique index creation could fail if duplicate topup ledger rows exist with same `metadata.orderId`. Staging apply succeeded without error ([`docs/75`](75-apply-migration-00010-hosted-staging-report.md)).

---

## 3. Approval gate

```
PRODUCTION MIGRATION APPROVAL REQUIRED

Target:
- Supabase project: [NOT IDENTIFIED — operator must supply production project ref]
- Migration: 00010_atomic_grant_credit_topup_rpc.sql
- Action: apply migration only
- Payment enablement: NO
- Production payment env change: NO
- Production callback registration: NO

Founder/operator must explicitly approve:
"APPROVE TASK 10.19 PRODUCTION MIGRATION 00010 ONLY"
```

| Item | Result |
|---|---|
| **Approval received** | **NO** — exact approval text not provided in this task session |
| **Migration applied** | **NO** — gate not satisfied; production target not identified |

### Operator prerequisites before approval can be acted on

1. Create or designate **separate** production Supabase project (not `jdxyhrnibmmwlbtbokqo`).
2. Add gitignored `.env.production` or operator secret store with production `SUPABASE_*` (never commit).
3. `supabase link --project-ref <production-ref>` on operator machine (verify ref ≠ staging).
4. Confirm migrations `00001`–`00009` already applied on production (or plan full `db push` sequence).
5. Optional read-only check: duplicate topup ledger `orderId` before index apply.
6. Founder provides exact approval string above.

---

## 4. Migration apply result

| Item | Value |
|---|---|
| **Applied** | **NO** |
| **Reason** | Production Supabase not identified; no production DB credentials; explicit approval not received |

**Commands that would apply (after gates met — NOT executed):**

```bash
# Operator only — after link to PRODUCTION project ref (not staging)
supabase link --project-ref <production-project-ref>
supabase migration list --linked    # verify 00009 present, 00010 pending
supabase db push                    # apply 00010 only if pending
```

---

## 5. Verification (production RPC/index)

**NOT RUN** — migration not applied.

If applied in a future approved session, verify:

| Check | Method |
|---|---|
| Function exists | `admin.rpc('grant_paid_credit_topup_atomic', …)` with fake UUID → `unknown_order` |
| Index exists | Implied by successful idempotent grant test or `pg_indexes` read-only query |
| `service_role` execute | REST RPC callable via service role only |
| `anon` execute | Should fail / not granted |
| Production data deleted | None expected |

**Do not** create paid orders or grant credits in production during migration-only task unless separately approved.

---

## 6. Production payment flags

| Surface | Status |
|---|---|
| Production API | **Does not exist** (`api.narraza.id` unresolved) |
| `CREDIT_TOPUP_ENABLED` | **N/A** — no production API |
| `PAYMENT_PROVIDER=duitku` | **NOT SET** |
| `PAYMENT_PROVIDER_MOCK` | **N/A** |
| Duitku production callback | **NOT REGISTERED** |
| Live production payment | **NOT RUN** |

**Production payment:** **OFF** (infrastructure not deployed; no enablement attempted).

---

## 7. Rollback / forward-fix plan

### If migration not applied (this task)

No rollback needed.

### If migration applied in future approved session

Forward-fix preferred. Emergency rollback (function/index only — **do not delete order/ledger/webhook data**):

```sql
DROP FUNCTION IF EXISTS public.grant_paid_credit_topup_atomic(
  uuid, text, text, text, integer, uuid, jsonb
);
DROP INDEX IF EXISTS public.credit_ledger_topup_order_id_unique_idx;
```

API grant path would revert to pre-RPC compensation behavior until RPC re-applied — keep `CREDIT_TOPUP_ENABLED=false` during any rollback.

---

## 8. Remaining blockers before production payment

| # | Blocker |
|---|---|
| 1 | **Production Supabase project** not created/linked in operator environment |
| 2 | **Migration 00010** not applied on production |
| 3 | **Production API + web** not deployed (`api.narraza.id`, `narraza.id`) |
| 4 | **docs/73** checklist gates C1–C8, D1–D9, E*, F* largely open |
| 5 | **Founder Go/No-Go** for migration and enablement not recorded |
| 6 | **Duitku production** credentials and callback registration — not started |

**Update (Task 10.20):** Production foundation plan [`docs/78`](78-production-environment-foundation-plan.md) defines how to unblock items 1–3 (Phases 0–7) before rerunning Task 10.19 for `00010`.

**Update (Task 10.21):** Production Supabase baseline [`docs/79`](79-production-supabase-baseline-setup-report.md) — **GO** (`00001`–`00009` on prod; `00010` not applied). Task 10.19 remains **BLOCKED** until explicit `"APPROVE TASK 10.19 PRODUCTION MIGRATION 00010 ONLY"` and production API/DNS ready.

---

## 9. Go / Partial / Blocked / No-Go

| Level | Verdict | Reason |
|---|---|---|
| **BLOCKED** | **Yes** | Production Supabase not identified; production DB access unavailable; approval not received |
| PARTIAL GO | — | Would apply if target identified but approval missing only |
| GO | — | Requires approval + production apply + verify |
| NO-GO triggers | **None** | No production touched; no secrets exposed; no accidental enablement |

---

## Final summary

```txt
Task 10.19 — Production Payment Preflight and Migration 00010 Approval Gate
Status: BLOCKED

Production target: NOT IDENTIFIED (staging only: jdxyhrnibmmwlbtbokqo)
Production API/web: NOT DEPLOYED (api.narraza.id / narraza.id DNS unresolved)
Migration 00010 readiness: PASS (file inspection + staging evidence)
Approval: NOT RECEIVED
Migration applied to production: NO
Production payment: OFF
Staging: unchanged Mode A safe

Next: Operator creates/links production Supabase + founder approval for migration only
```