# Task 11.4 — AWS API Staging Adapter + Docker Deploy Prep

**Date:** 2026-06-09  
**Status:** Closed — GO  
**Agent:** Cursor (Task 11.4)

## Task goal

Prepare VibeNovel API for AWS EC2/VPS via Node runtime + Docker Compose without breaking Cloudflare Worker staging. Implement app/runtime split, Node bindings adapter, Dockerfile, compose, and verify local health.

## Files read

- `docs/65`, `docs/64`, `docs/63`, `docs/62`, `docs/60`, `docs/36`
- `README.md`, `package.json`, `apps/api/package.json`, `apps/api/wrangler.toml`
- `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/README.md`
- `scripts/smoke-staging.ps1`, `scripts/lib/staging-smoke-common.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/app.ts` | Created |
| `apps/api/src/node-server.ts` | Created |
| `apps/api/src/node-bindings.ts` | Created |
| `apps/api/src/index.ts` | Updated — Worker shim |
| `apps/api/tsconfig.node.json` | Created |
| `apps/api/tsconfig.json` | Exclude Node files from Worker tsc |
| `apps/api/package.json` | Node deps + scripts |
| `apps/api/Dockerfile` | Created |
| `docker-compose.staging.yml` | Created |
| `.env.staging.example` | Created |
| `.dockerignore` | Created |
| `deploy/caddy/Caddyfile.staging.example` | Created |
| `.gitignore` | `.env.staging`, `dist-node/` |
| `package.json` | Root Node aliases |
| `docs/66-aws-api-staging-adapter-and-docker-prep-report.md` | Created |
| `README.md`, `docs/36`, `docs/63`, `docs/65`, `scripts/README.md`, `apps/api/README.md` | Updated |

## Commands run

```powershell
npm install
npm run typecheck
npm run build:shared
npm run build:api
npm run build:api:node
npm run build:web
# Node server on PORT=8790 (8787 occupied by wrangler dev)
curl.exe -s http://localhost:8790/api/health
npm run smoke:staging -- -TargetName node-local -ApiBaseUrl http://localhost:8790 -HealthOnly
npm run smoke:staging:health
docker build -f apps/api/Dockerfile -t vibenovel-api-staging .
docker run -d --env-file .env.staging -p 8791:8787 vibenovel-api-staging
curl.exe -s http://localhost:8791/api/health
npm run smoke:staging -- -TargetName docker-local -ApiBaseUrl http://localhost:8791 -HealthOnly
docker rm -f vibenovel-api-staging-test
npm run smoke:api
npm run smoke:all:local
```

## Results

| Command | Result |
|---|---|
| typecheck | PASS |
| build:api (wrangler dry-run) | PASS |
| build:api:node | PASS |
| build:web | PASS |
| Node /api/health :8790 | PASS — Mode A staging flags |
| smoke:staging node-local -HealthOnly | PASS |
| smoke:staging:health (Cloudflare) | PASS |
| docker build | PASS |
| Docker /api/health :8791 | PASS |
| smoke:staging docker-local -HealthOnly | PASS |
| smoke:api | PASS 17/17 |
| smoke:all:local | PASS 14/14 |

## Decisions

1. **Bindings injection** via `app.fetch(request, bindings)` — no route rewrites.
2. **Worker tsconfig excludes** `node-server.ts` / `node-bindings.ts`; separate `tsconfig.node.json` for emit.
3. **Default PORT 8787** — documented override when wrangler dev uses same port.
4. **`.env.staging` gitignored**; `.env.staging.example` committed with Mode A safe defaults only.
5. **No AWS deploy** — Docker local verification only.

## Limitations

- No `deploy:api:staging` redeploy run (remote CF health smoke sufficient).
- Full API-mode staging smoke still blocked (Supabase operator gate).
- `.env.staging` created locally for Docker test — gitignored, not committed.

## Next recommended task

**Task 11.5** — AWS EC2 provision + deploy API staging (separate from Hermes).

**Parallel:** **Task 11.2b** — hosted Supabase operator gate.