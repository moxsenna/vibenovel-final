# Task 10.16 — Atomic Grant DB RPC

## Task goal

Implement atomic/idempotent Postgres RPC for payment credit grant; integrate API callback path; test locally; document. No production enable.

## Files read

- docs/36, 58, 70, 71, 72, 73, 63, apps/api/README.md, scripts/README.md
- supabase/migrations/00009, credit-topup-grant.ts, process-duitku/mayar callbacks
- .agents/rules/09-agent-work-logs.md

## Files created/changed

| Path | Note |
|---|---|
| `supabase/migrations/00010_atomic_grant_credit_topup_rpc.sql` | RPC + unique ledger index |
| `apps/api/src/services/credit-topup-grant.ts` | RPC integration |
| `apps/api/scripts/atomic-grant-rpc.test.mts` | Direct RPC tests |
| `apps/api/package.json` | `test:atomic-grant` script |
| `package.json` | root test aliases |
| `docs/74-atomic-grant-db-rpc-report.md` | Closure report |
| `docs/36`, `docs/63`, `docs/73`, `README.md` | Index updates |

## Commands run

```powershell
supabase migration up
npm run typecheck
npm run build:api
npm run test:duitku-signature
npm run test:atomic-grant
npm run smoke:api:sprint10:duitku
```

## Results

| Item | Result |
|---|---|
| RPC migration | **PASS** |
| API integration | **PASS** |
| Duplicate no double grant | **PASS** |
| Negative cases | **PASS** |
| typecheck / build | **PASS** |
| Verdict | **GO** |

## Next recommended task

Apply migration `00010` on hosted Supabase; production enable per docs/73 §7 with founder approval only.