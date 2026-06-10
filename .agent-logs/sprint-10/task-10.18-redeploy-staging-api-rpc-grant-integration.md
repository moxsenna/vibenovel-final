# Task 10.18 — Redeploy Staging API and Verify RPC Grant Integration

## Task goal

Redeploy AWS staging API (`https://api-staging.narraza.web.id`) with Task 10.16 RPC grant code and verify end-to-end callback grant via staging API against hosted staging Supabase (`jdxyhrnibmmwlbtbokqo`, migration `00010`). Staging-only; production untouched.

## Files read

- `README.md`, `docs/74`, `docs/75`, `docs/73`, `docs/70`, `docs/71`
- `apps/api/src/services/credit-topup-grant.ts`, `apps/api/src/services/process-duitku-payment-callback.ts`
- `supabase/migrations/00010_atomic_grant_credit_topup_rpc.sql`
- `scripts/operator-aws-duitku-mode-b.ps1`, `scripts/sprint10-duitku-smoke-api.ps1`, `scripts/README.md`
- `apps/api/README.md`, `.agents/rules/09-agent-work-logs.md`
- `docker-compose.staging.yml`, `deploy/ec2/deploy-app.sh`, `docs/68`

## Files created/changed

| Path | Note |
|---|---|
| `docs/76-redeploy-staging-api-rpc-grant-integration-report.md` | Task closure report |
| `.agent-logs/sprint-10/task-10.18-redeploy-staging-api-rpc-grant-integration.md` | This log |
| `README.md` | Task 10.18 row + next-task pointer |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | 10.18 closure |
| `docs/63-updated-product-roadmap-after-sprint-11.md` | 10.18 + next task |
| `docs/73-duitku-production-payment-enable-plan.md` | C7/D gates — API E2E RPC verified |
| `docs/75-apply-migration-00010-hosted-staging-report.md` | Follow-up 10.18 reference |
| `scripts/README.md` | 10.18 smoke note |

## Commands run

```powershell
git status --short; git rev-parse --short HEAD
Invoke-RestMethod https://api-staging.narraza.web.id/api/health
npm run typecheck
npm run build:api
npm run test:atomic-grant
npm run test:atomic-grant-hosted
npm run operator:aws:duitku:gate -- -Mode preflight

# Deploy: tarball scp + EC2 extract + docker rebuild (preserve .env.staging)
tar -czf $env:TEMP\vibenovel-staging-10-18.tar.gz ...
scp ... ubuntu@13.212.245.32:/tmp/...
ssh ... tar -xzf + docker compose up -d --build

npm run operator:aws:duitku:gate -- -Mode apply -SkipRollback
npm run smoke:api:sprint10:duitku -- -ApiBaseUrl https://api-staging.narraza.web.id -StagingMode -TestEmail staging-smoke@vibenovel.test
npm run operator:aws:duitku:gate -- -Mode rollback
```

## Results

| Item | Result |
|---|---|
| Preflight health Mode A | **PASS** |
| typecheck / build:api | **PASS** |
| test:atomic-grant | **PASS** |
| test:atomic-grant-hosted | **PASS** |
| EC2 code redeploy | **PASS** — docker rebuild, health OK |
| Mode B apply | **PASS** — topup=true, provider=duitku, hasCode/Key=true |
| Fixture smoke (17 PASS) | **PASS** — grant, duplicate, all negatives |
| Mode A rollback | **PASS** |
| Cloudflare fallback | **PASS** |
| Production touched | **NO** |

## Decisions

- **Tarball scp deploy** (same pattern as Task 11.5) rather than git pull — local repo ahead of remote; preserves server `.env.staging`.
- **Mode B temporary** only for fixture callback matrix; no `-LiveCreate` / real Duitku payment.
- **No new probe script** — existing `smoke:api:sprint10:duitku -StagingMode` sufficient to prove API → RPC path.

## Limitations

- Deploy commit `c505a82` is local HEAD with dirty tree (not pushed).
- Fixture smoke uses Duitku sandbox merchant credentials from operator env (not smoke fixture flag).
- Test orders/ledger rows on hosted staging not cleaned up (per task rules).

## Next recommended task

Production migration `00010` on production Supabase + docs/73 §7 production enable sequence — **founder approval required**. Do not start without explicit Go.