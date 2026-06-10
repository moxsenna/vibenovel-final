# Task 10.22 — Production API/Web/DNS Mode A Plan and Preflight

## Task goal

Plan + read-only preflight for production API/web/DNS Mode A on top of Task 10.21 Supabase baseline. No deploy, no payment, no migration 00010.

## Files read

- `README.md`, `docs/78`, `docs/79`, `docs/77`, `docs/73`, `docs/76`, `docs/36`, `docs/63`
- `docs/69`, `docs/65`, `apps/api/README.md`, `scripts/README.md`
- `.env.production.example`, `apps/web/.env.example`
- `docker-compose.staging.yml`, `deploy/ec2/*`, `deploy/caddy/*`, `package.json`, `apps/api/wrangler.toml`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `docs/80-production-api-web-dns-mode-a-preflight-report.md` | Main deliverable |
| `.agent-logs/sprint-10/task-10.22-production-api-web-dns-mode-a-preflight.md` | This log |
| `README.md`, `docs/36`, `docs/63`, `docs/73`, `docs/78`, `docs/79` | Index updates |

## Commands run (read-only)

```powershell
git check-ignore -v .env.production          # gitignored PASS
Test-Path .env.production                    # True (not committed)
Get-Content supabase\.temp\project-ref       # qjmb…njct (production)
nslookup narraza.id 8.8.8.8                  # Non-existent domain
nslookup api.narraza.id 8.8.8.8              # Non-existent domain
Invoke-WebRequest https://api.narraza.id/api/health  # Unreachable
Invoke-RestMethod api-staging .../health     # Mode A PASS
```

**Not run:** production deploy, DNS changes, migration apply, payment enable.

## Results

| Item | Result |
|---|---|
| Production Supabase baseline incorporated | **YES** (docs/79 GO) |
| Mode A env matrix | **Defined** |
| EC2/API plan | **Defined** (new EC2, not 13.212.245.32) |
| DNS plan | **Defined** (blocked on domain registration) |
| Web/Pages plan | **Defined** |
| Phases 3–7 checklist | **Defined** |
| Rollback plan | **Defined** |
| Production deploy | **NO** |
| Migration 00010 | **NO** |
| Payment | **NO** |
| Secrets exposed | **NO** |
| Status | **GO** |

## Decisions

- Execution gated behind new approval string: `APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY`.
- Reuse staging EC2 pattern (Docker + Caddy) on **new** instance; prod compose/Caddyfile still to be added in execution task.
- `narraza.id` public DNS non-existent — execution blocker, not planning blocker.

## Next recommended task

**Task 10.23** — Production API/Web Mode A **execution** (Phases 3–7) after founder approval + domain registration. Optional parallel: Task 10.19 for `00010` only.