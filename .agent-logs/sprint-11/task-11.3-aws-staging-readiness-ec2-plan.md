# Task 11.3 — AWS Staging Readiness & EC2 Separate Instance Plan

**Date:** 2026-06-09  
**Status:** Closed — plan complete (docs-only)  
**Agent:** Cursor (Task 11.3)

## Task goal

Prepare AWS EC2 staging readiness plan for VibeNovel API on a **separate instance from Hermes**. Document architecture, portability audit, cost guard, env matrix, Docker/reverse proxy strategy, smoke plan, and callback decisions. **No AWS deploy.**

## Files read

- `docs/64`, `docs/63`, `docs/62`, `docs/60`, `docs/36`
- `README.md`, `package.json`
- `apps/api/wrangler.toml`, `apps/api/package.json`, `apps/api/src/index.ts`, `apps/api/src/env.ts`
- `apps/api/src/types.ts`, `apps/api/src/routes/index.ts`, `apps/api/src/routes/payment-webhooks.ts`
- `apps/api/src/lib/md5.ts`
- `scripts/smoke-staging.ps1`, `scripts/lib/staging-smoke-common.ps1`
- `apps/web/.env.example`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `docs/65-aws-staging-readiness-and-ec2-plan.md` | Created — full AWS readiness plan |
| `README.md` | Updated — Task 11.3 row + next task |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Updated — Task 11.3 entry |
| `docs/63-updated-product-roadmap-after-sprint-11.md` | Updated — Phase A + execution order |
| `scripts/README.md` | Updated — AWS smoke notes |
| `apps/api/README.md` | Updated — AWS staging section |

## Commands run

```txt
None — docs-only task per scope.
No typecheck/build/smoke required (no code changes).
```

## Results

| Item | Result |
|---|---|
| Portability audit | Business logic portable; adapter gap documented |
| Recommended strategy | EC2 + Docker Compose + Caddy |
| Hermes separation | Documented — mandatory separate instance |
| AWS deploy | NOT PERFORMED |
| Secrets committed | NONE |
| docs/65 created | YES |

## Decisions

1. **Recommend Option B (Docker Compose + Caddy)** over PM2 primary and Lambda (rejected for this stage).
2. **Cloudflare staging remains active** — AWS is additive, not replacement.
3. **Runtime adapter deferred to Task 11.4** — split `app.ts` / `worker.ts` / `node-server.ts`.
4. **One active sandbox callback at a time** — document before Mode B live smoke.
5. **Hosted Supabase shared** — same project can serve CF or AWS API via `VITE_API_URL` / env matrix.

## Limitations

- No EC2 provisioned, no DNS, no Caddy installed.
- No Dockerfile or node-server.ts implemented (Task 11.4).
- Supabase operator gate (11.2b) still pending — blocks full API-mode smoke on any target.

## Next recommended task

**Task 11.4** — AWS API Staging Adapter + Deploy Prep (`app.ts` split, `node-server.ts`, Dockerfile, `docker-compose.staging.yml`).

**Parallel:** **Task 11.2b** (operator) — hosted Supabase secrets if auth/full smoke priority on Cloudflare first.