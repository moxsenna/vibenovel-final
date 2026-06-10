# Task 10.20 — Production Environment Foundation Plan

## Task goal

Define production environment foundation for Narraza: topology, Supabase/DNS checklists, env matrix, deployment sequence, risk register. Planning + safe read-only preflight only — no production deploy, migration, or payment enablement.

## Files read

- `README.md`, `docs/36`, `docs/63`, `docs/73`, `docs/77`, `docs/69`, `docs/76`
- `apps/api/README.md`, `apps/web/.env.example`, `.env.staging.example`
- `apps/api/wrangler.toml`, `docker-compose.staging.yml`, `deploy/caddy/*`
- `package.json`, `scripts/README.md`, `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `docs/78-production-environment-foundation-plan.md` | Foundation plan report |
| `.agent-logs/sprint-10/task-10.20-production-environment-foundation-plan.md` | This log |
| `README.md` | Task 10.20 row + next-task pointer |
| `docs/36`, `docs/63`, `docs/73`, `docs/77` | Index / cross-reference updates |

## Commands run

```powershell
git rev-parse --short HEAD
Resolve-DnsName narraza.id, api.narraza.id  # not resolved
Invoke-RestMethod https://api-staging.narraza.web.id/api/health  # Mode A PASS
# grep/glob audit: env files, deploy scripts, migrations list
```

**Not run:** production deploy, migration, Supabase create, DNS changes.

## Results

| Item | Result |
|---|---|
| Environment audit | **PASS** — staging documented; production gaps listed |
| Production topology | **Defined** |
| Supabase checklist | **Defined** |
| DNS checklist | **Defined** (domains not resolved — TBD) |
| Env matrix | **Defined** (names only) |
| Deployment sequence | **Defined** (Phases 0–9) |
| Risk register | **Included** |
| Production touched | **NO** |
| Staging health | **PASS** — Mode A unchanged |
| Secrets exposed | **NO** |

## Decisions

- **Mirror staging pattern:** Cloudflare Pages (web) + AWS EC2 Docker/Caddy (API) + hosted Supabase — proven in Tasks 11.5–11.6.
- **Separate EC2** for production — never reuse `13.212.245.32`.
- **Hold `00010`** until Task 10.19 rerun after Phases 0–2 (or 0–7).
- **No `.env.production.example` file** — matrix lives in docs/78; operator creates gitignored `.env.production` when approved (can add example file in future execution task).

## Limitations

- Domain `narraza.id` ownership/registrar not confirmed in repo.
- No production Supabase ref exists yet.
- Production operator scripts not implemented (planned for execution task).

## Next recommended task

**Task 10.21 (or operator session):** Founder **Phase 0** approval from docs/78 §6 → create production Supabase (Phase 1) + link CLI + apply migrations `00001`–`00009` (Phase 2). Still no payment enablement. Do not apply `00010` until Task 10.19 approval.