# Task 10.21 — Production Supabase Baseline Setup

## Task goal

Create/link dedicated production Supabase (new account) and apply migrations `00001`–`00009` only — not `00010`. Staging `jdxyhrnibmmwlbtbokqo` must not be touched as production.

## Rerun apply (2026-06-10)

## Files changed

| Path | Note |
|---|---|
| `scripts/operator-production-supabase-baseline.ps1` | `$host` fix, VITE URL fallback, access token load, stderr-safe migration list, cross-account staging relink warn |
| `.env.production` | Operator-filled (gitignored) |
| `docs/79-production-supabase-baseline-setup-report.md` | §14 GO closure |
| `README.md`, `docs/36`, `docs/63`, `docs/73`, `docs/77` | Status → GO |

## Commands run

```powershell
npm run operator:production:supabase:baseline -- -Mode preflight   # PASS
npm run operator:production:supabase:baseline -- -Mode apply         # db push 00001-00009 PASS
supabase migration list --linked   # 00001-00009 remote; 00010 local only
# REST schema verification — all baseline tables + seed PASS
Invoke-RestMethod api-staging .../health  # Mode A PASS
```

## Results

| Item | Result |
|---|---|
| Production ref (sanitized) | `qjmb…njct` |
| ≠ staging | **YES** |
| Migrations 00001–00009 | **APPLIED** |
| Migration 00010 | **NOT APPLIED** |
| Schema verification | **PASS** |
| Payment enabled | **NO** |
| Prod API/web deploy | **NO** |
| Secrets exposed | **NO** |
| Staging | **Mode A PASS**, DB not touched |
| Status | **GO** |

## Decisions

- Cross-account: production CLI token cannot relink staging; document staging relink procedure in docs/79 §14.
- `00010` excluded via Method A (temp move) — verified absent on production remote.

## Next recommended task

[`docs/78`](../../docs/78-production-environment-foundation-plan.md) Phases 3–7 (production API/web) **or** Task 10.19 with `"APPROVE TASK 10.19 PRODUCTION MIGRATION 00010 ONLY"` for atomic grant RPC on production only.