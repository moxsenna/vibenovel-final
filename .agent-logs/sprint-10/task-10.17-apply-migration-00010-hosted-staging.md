# Task 10.17 — Apply Migration 00010 to Hosted Staging Supabase

## Task goal

Apply migration 00010 to hosted staging Supabase (jdxyhrnibmmwlbtbokqo), verify RPC/index, run hosted atomic grant tests, keep Mode A safe. No production.

## Preflight

- Staging API health: Mode A safe (creditTopupEnabled=false, paymentProviderMock=true, paymentProvider=mock)
- Target: `.env.staging` → `jdxyhrnibmmwlbtbokqo.supabase.co` (hosted, not localhost)
- Linked project ref confirmed via `supabase/.temp/project-ref`

## Commands run

```powershell
curl.exe -s https://api-staging.narraza.web.id/api/health
supabase db push --linked
supabase migration list --linked
npm run test:atomic-grant-hosted
npm run operator:staging:atomic-grant
npm run typecheck
npm run build:api
```

## Files created/changed

| Path | Note |
|---|---|
| `apps/api/scripts/atomic-grant-hosted-staging.test.mts` | Hosted staging RPC test suite |
| `apps/api/scripts/probe-hosted-atomic-grant.mts` | RPC existence probe |
| `scripts/operator-verify-hosted-atomic-grant.ps1` | Operator gate |
| `docs/75-apply-migration-00010-hosted-staging-report.md` | Closure report |
| `package.json`, `apps/api/package.json` | test/operator scripts |
| `README.md`, `docs/36`, `docs/63`, `docs/73` | Index updates |

## Results

| Item | Result |
|---|---|
| Migration 00010 applied (remote) | **PASS** |
| RPC callable on hosted | **PASS** |
| Hosted grant idempotency | **PASS** |
| Mode A preserved | **PASS** |
| Production touched | **NO** |
| Verdict | **GO** |

## Notes

- `supabase db query --linked` blocked by pooler circuit breaker (too many CLI auth attempts); used REST RPC + migration list instead.
- Staging API duitku smoke NOT RUN — Mode A topup disabled by design.

## Next recommended task

Production migration `00010` + docs/73 §7 execution — founder approval only.