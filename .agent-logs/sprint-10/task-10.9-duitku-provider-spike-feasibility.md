# Task 10.9 — Duitku Provider Spike & Migration Feasibility

**Date:** 2026-06-08  
**Sprint:** sprint-10  
**Status:** completed

## Task goal

Evaluate Duitku as alternative/supplement to Mayar for credit topup. Audit docs, compare POP vs V2, map to provider abstraction, recommend migration strategy, plan Tasks 10.10+. No Mayar removal, no production enable, no live transactions.

## Files read

- `docs/50`, `docs/53`, `docs/54`, `docs/52`
- `apps/api/src/services/payment-provider.ts`, `payment-provider-types.ts`
- `mayar-client.ts`, `mayar-webhook.ts`, `process-mayar-payment-webhook.ts`
- `credit-topup.ts`, `credit-topup-grant.ts`
- `apps/api/src/routes/payment-webhooks.ts`, `credits.ts`
- `supabase/migrations/00009_sprint10_payment_topup.sql`
- `packages/shared/src/enums.ts`, `domain.ts`
- `scripts/sprint10-smoke-api.ps1`, `sprint10-mayar-live-smoke.ps1`
- `apps/web/src/pages/CreditTopupPage.tsx`, `CreditTopupReturnPage.tsx`
- `apps/api/src/env.ts`

## Duitku docs consulted

| Doc | URL |
|---|---|
| Overview | https://docs.duitku.com/payment-gateway/overview/ |
| API V2 ID | https://docs.duitku.com/api/id/ |
| API V2 EN | https://docs.duitku.com/api/en/ |
| POP ID | https://docs.duitku.com/pop/id/ |
| POP EN | https://docs.duitku.com/pop/en/ |
| PHP library (callback/signature) | https://github.com/duitkupg/duitku-php |

## Files created/changed

| Path | Change |
|---|---|
| `docs/55-duitku-provider-spike-and-migration-feasibility.md` | **Created** — full feasibility report |
| `.agent-logs/sprint-10/task-10.9-duitku-provider-spike-feasibility.md` | **Created** — this log |
| `README.md`, `docs/50`, `docs/36`, `docs/54` | Task 10.9 status pointers |
| `apps/api/.dev.vars.example` | Duitku env name placeholders only (no values) |

**Not changed:** product source, migrations, UI, grant logic, `.dev.vars` (gitignored)

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` / `build:*` / `smoke:*` | **tidak dijalankan** — docs-only spike |
| Live Duitku transaction | **tidak dijalankan** — no approval, no credentials |

## Results

- **Feasibility:** Duitku fits existing provider abstraction with **no schema migration**
- **Recommendation:** Duitku **POP** for MVP; V2 deferred
- **Callback:** form-urlencoded + MD5 signature (documented in PHP lib)
- **Siklusio impact:** VibeNovel Duitku bypasses Mayar multi-app router
- **Mayar:** retained, not removed
- **Production:** NOT ENABLED; no Duitku GO claim

## Decisions

- Recommend Option A (second provider) not replace/fallback
- `merchantOrderId` = VibeNovel order UUID (≤50 chars)
- `provider_transaction_id` = Duitku `reference`
- Reuse `credit-topup-grant.ts` unchanged
- Open question: POP create signature docs (HMAC) vs PHP lib (SHA256 concat) — verify in 10.10

## Limitations

- User Duitku account status not verified in this session
- No sandbox API call (no credentials configured)
- Hono form-body parsing not prototyped

## Next recommended task

**Task 10.10 — Duitku Provider Data/Env + Adapter Shell**