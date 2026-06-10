# 66 — AWS API Staging Adapter & Docker Prep Report (Task 11.4)

**Date:** 2026-06-09  
**Status:** Closed — **GO**  
**Verdict:** Node runtime adapter + Docker prep complete; Cloudflare Worker staging unchanged  
**Related:** [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md), [`docs/64`](64-staging-smoke-harness-and-supabase-report.md), [`.agent-logs/sprint-11/task-11.4-aws-api-staging-adapter-docker-prep.md`](../.agent-logs/sprint-11/task-11.4-aws-api-staging-adapter-docker-prep.md)

Task 11.4 implements a **portable Node runtime** for VibeNovel API alongside the existing Cloudflare Worker entry. **No AWS deploy.** **No EC2 created.** **No secrets committed.**

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| Shared `createApp()` factory | AWS EC2 provision (Task 11.5) |
| Node server + env bindings adapter | Production deploy |
| Dockerfile + `docker-compose.staging.yml` | Payment sandbox / live |
| Local Node + Docker health verification | Supabase operator gate (11.2b) |
| Preserve Cloudflare Worker deploy | `CREDIT_TOPUP_ENABLED=true` |

---

## 2. Runtime audit (pre-split)

| Item | Finding |
|---|---|
| Hono app in `index.ts` | App created inline; `export default app` for Wrangler |
| Routes use `c.env` | All bindings via `AppBindings` — no KV/R2/D1 |
| `env.ts` | Pure string parsing; `getEnvPresenceFlags()` for health |
| Payment webhooks | Standard HTTP; Duitku uses `c.req.raw` + pure JS MD5 |
| Cloudflare-specific APIs | **None** in business logic |
| Node-incompatible code | **None** after adapter injects bindings via `app.fetch(req, bindings)` |

---

## 3. Files changed

| File | Action |
|---|---|
| `apps/api/src/app.ts` | **Created** — `createApp()` factory |
| `apps/api/src/index.ts` | **Updated** — thin Worker entry |
| `apps/api/src/node-server.ts` | **Created** — `@hono/node-server` listener |
| `apps/api/src/node-bindings.ts` | **Created** — `process.env` → `AppBindings` |
| `apps/api/tsconfig.node.json` | **Created** — Node emit to `dist-node/` |
| `apps/api/tsconfig.json` | **Updated** — exclude Node-only files from Worker typecheck |
| `apps/api/package.json` | **Updated** — deps + `dev:node`, `build:node`, `start:node` |
| `apps/api/Dockerfile` | **Created** — multi-stage, non-root user |
| `docker-compose.staging.yml` | **Created** |
| `.env.staging.example` | **Created** — Mode A names only |
| `.dockerignore` | **Created** |
| `deploy/caddy/Caddyfile.staging.example` | **Created** |
| `.gitignore` | **Updated** — `.env.staging`, `dist-node/` |
| `package.json` | **Updated** — `dev:api:node`, `build:api:node`, `start:api:node` |

---

## 4. App / runtime split

```txt
apps/api/src/
  app.ts           → createApp(): Hono<AppEnv> (shared)
  index.ts         → export default createApp() (Cloudflare Worker)
  node-bindings.ts → loadBindingsFromProcessEnv()
  node-server.ts   → serve({ fetch: (req) => app.fetch(req, bindings) })
```

**Cloudflare:** Wrangler unchanged — `main = "src/index.ts"`, `[env.staging]` intact.

**Node:** Bindings passed as second argument to `app.fetch()` (Hono Workers-compatible pattern).

---

## 5. Node env adapter

`loadBindingsFromProcessEnv()` maps all `AppBindings` keys from `process.env`.

Mode A local/Docker (from `.env.staging.example`):

```txt
APP_ENV=staging
ALLOWED_ORIGINS=http://localhost:5173,https://vibenovel-web-staging.pages.dev
CREDIT_TOPUP_ENABLED=false
PAYMENT_PROVIDER=mock
PAYMENT_PROVIDER_MOCK=true
AI_GENERATION_ENABLED=false
AI_PROVIDER_MOCK=true
PORT=8787
```

Supabase keys empty → health reports `hasSupabaseUrl=false` (matches Cloudflare staging shell).

---

## 6. Dockerfile / compose

**Build (repo root):**

```powershell
docker build -f apps/api/Dockerfile -t vibenovel-api-staging .
```

**Run:**

```powershell
cp .env.staging.example .env.staging   # operator fills secrets; never commit
docker run --env-file .env.staging -p 8787:8787 vibenovel-api-staging
# or
docker compose -f docker-compose.staging.yml up --build
```

- Multi-stage: deps → build shared + `build:node` → non-root `vibenovel` user
- No secrets baked into image
- Port `8787` internal; Caddy on host terminates TLS

---

## 7. Caddy / reverse proxy

Template: `deploy/caddy/Caddyfile.staging.example`

```caddyfile
api-staging.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

Payment callbacks (Mode B later):

- `POST /api/payments/duitku/callback`
- `POST /api/payments/mayar/webhook`

---

## 8. Local Node verification

**Start (Mode A env):**

```powershell
# From apps/api or repo root with env vars set (see .env.staging.example)
npm run dev:api:node
# default PORT=8787; use $env:PORT="8790" if wrangler dev occupies 8787
```

**Health (verified port 8790):**

```json
{
  "ok": true,
  "data": {
    "env": {
      "appEnv": "staging",
      "creditTopupEnabled": false,
      "paymentProviderMock": true,
      "paymentProvider": "mock",
      "aiGenerationEnabled": false,
      "hasSupabaseUrl": false
    }
  }
}
```

---

## 9. Docker verification

| Step | Result |
|---|---|
| `docker build -f apps/api/Dockerfile -t vibenovel-api-staging .` | **PASS** |
| `docker run --env-file .env.staging -p 8791:8787 ...` | **PASS** |
| `GET /api/health` | **PASS** — Mode A flags |

---

## 10. Cloudflare compatibility verification

| Check | Result |
|---|---|
| `npm run build:api` (wrangler dry-run) | **PASS** |
| `npm run smoke:staging:health` (CF staging URL) | **PASS** 5/5 |
| `npm run smoke:api` (wrangler dev :8787) | **PASS** 17/17 |
| `npm run smoke:all:local` | **PASS** 14/14 (~1.4m) |
| `wrangler.toml` `[env.staging]` | **Unchanged** |

**No Cloudflare deploy run** — build + remote health smoke confirm compatibility.

---

## 11. Smoke commands

**Node local:**

```powershell
npm run dev:api:node
npm run smoke:staging -- -TargetName "node-local" -ApiBaseUrl "http://localhost:8787" `
  -WebBaseUrl "https://vibenovel-web-staging.pages.dev" -HealthOnly
```

**Docker local:**

```powershell
docker compose -f docker-compose.staging.yml up --build
npm run smoke:staging -- -TargetName "docker-local" -ApiBaseUrl "http://localhost:8787" `
  -WebBaseUrl "https://vibenovel-web-staging.pages.dev" -HealthOnly
```

**Future AWS (Task 11.5):**

```powershell
npm run smoke:staging -- -TargetName "aws-staging" `
  -ApiBaseUrl "https://api-staging.<domain>" `
  -WebBaseUrl "https://vibenovel-web-staging.pages.dev"
```

---

## 12. AWS deploy next steps (Task 11.5)

1. Provision separate EC2 (not Hermes) per [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md)
2. Install Docker + Caddy on EC2
3. Copy `.env.staging` to `/opt/vibenovel/` (chmod 600)
4. `docker compose -f docker-compose.staging.yml up -d --build`
5. DNS `api-staging.<domain>` → EC2; Caddy HTTPS
6. `npm run smoke:staging` with AWS `-ApiBaseUrl`
7. Rebuild web with `VITE_API_URL=https://api-staging.<domain>` when ready

---

## 13. Remaining blockers

| Blocker | Unblock |
|---|---|
| Hosted Supabase staging | ✅ GO FULL — project `jdxyhrnibmmwlbtbokqo` |
| Worker Supabase secrets | ✅ set on Cloudflare staging |
| AWS EC2 instance | Task 11.5 **PARTIAL GO** — `http://13.212.245.32` [`docs/68`](68-aws-ec2-api-staging-deploy-report.md) |
| Full API-mode staging smoke (CF) | ✅ PASS with fixed test user |
| Full API-mode staging smoke (AWS) | ✅ PASS HTTP (`operator:aws:staging:smoke -IncludeApiMode`) |
| Mode B payment sandbox | After staging auth smoke PASS |

---

## 14. Go / No-Go

**Verdict: GO**

| Criterion | Met |
|---|---|
| Shared app/runtime split | ✅ |
| Cloudflare Worker compatible | ✅ |
| Node server health local | ✅ |
| Docker build + health | ✅ |
| Smoke harness → Node/Docker | ✅ |
| No secrets committed | ✅ |
| No AWS deploy | ✅ |
| No production touched | ✅ |

---

*Authored Task 11.4 — 9 Juni 2026. Adapter + Docker prep; AWS deploy deferred to 11.5.*