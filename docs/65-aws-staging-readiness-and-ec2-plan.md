# 65 — AWS Staging Readiness & EC2 Separate Instance Plan (Task 11.3)

**Date:** 2026-06-09  
**Status:** Closed — **plan complete** (docs-only; no AWS deploy)  
**Verdict:** Recommend **EC2 separate instance + Docker Compose + Caddy** for API staging; Cloudflare staging remains active  
**Related:** [`docs/64`](64-staging-smoke-harness-and-supabase-report.md), [`docs/63`](63-updated-product-roadmap-after-sprint-11.md), [`docs/62`](62-staging-deploy-mode-a-report.md), [`docs/60`](60-sprint-11-staging-deploy-and-public-callback-plan.md), [`.agent-logs/sprint-11/task-11.3-aws-staging-readiness-ec2-plan.md`](../.agent-logs/sprint-11/task-11.3-aws-staging-readiness-ec2-plan.md)

Task 11.3 prepares **AWS EC2 staging readiness** for VibeNovel API on a **separate instance from Hermes**. This is a planning document only — **no AWS resources created**, **no production touched**, **no secrets committed**.

---

## 1. Goal and decision

| Goal | Decision |
|---|---|
| Prepare AWS staging path using founder's free-tier account | ✅ Documented |
| Keep VibeNovel off Hermes instance | ✅ **Mandatory** — separate EC2 |
| Do not replace Cloudflare staging | ✅ Additive; CF Mode A stays GO |
| Minimize AWS cost | ✅ Cost guard section below |
| Reuse Task 11.2 smoke harness | ✅ `-ApiBaseUrl` / `-WebBaseUrl` |

**Recommended deploy strategy:** **Option B — EC2 + Docker Compose + Caddy reverse proxy** (API only on AWS initially; web stays Cloudflare Pages; Supabase stays hosted).

---

## 2. Why separate from Hermes

| Rule | Rationale |
|---|---|
| Hermes must **not** host VibeNovel app | Isolation — payment/DB secrets, blast radius, ops ownership |
| Hermes must **not** store VibeNovel production/payment secrets | Hermes may assist deploy via SSH; secrets live only on VibeNovel EC2 |
| Hermes may SSH/deploy with **limited deploy key** | Optional orchestration; not secret storage |
| VibeNovel staging gets **own EC2 instance** | Dedicated security group, billing, lifecycle |

```txt
Hermes instance          →  other workloads only (not VibeNovel)
VibeNovel staging EC2    →  /opt/vibenovel, user vibenovel, .env.staging
Cloudflare Worker/Pages  →  remains active (Mode A shell)
Hosted Supabase          →  shared DB for CF or AWS API (same project)
```

---

## 3. Current portability audit

### Hono app structure (inspected)

| Item | Finding |
|---|---|
| Entry | `apps/api/src/index.ts` — creates Hono app, registers routes, `export default app` |
| Routes | `registerRoutes()` in `routes/index.ts` — health, auth, projects, credits, webhooks, AI, etc. |
| Env access | `c.env` typed as `AppBindings` — all routes/services use bindings object |
| Services | Logic in `services/*` — **no Cloudflare-specific APIs** |
| Build | `wrangler deploy --dry-run` — Worker bundle only today |

### Portable now ✅

| Capability | Evidence |
|---|---|
| Hono routing + middleware | Standard Hono; CORS in `middleware/cors.ts` |
| Supabase client | `@supabase/supabase-js` — Node-compatible |
| Outbound `fetch()` | OpenRouter, Mayar, Duitku clients — Web Fetch API (Node 18+) |
| MD5 (Duitku callback) | Pure JS in `lib/md5.ts` — no Node `crypto` dependency |
| Payment webhooks | `POST /api/payments/duitku/callback`, `POST /api/payments/mayar/webhook` — standard HTTP |
| Health endpoint | `GET /api/health` — `getEnvPresenceFlags()` booleans only |
| Env parsing | `env.ts` — string bindings; no Worker runtime APIs |
| Request bodies | JSON + `c.req.raw` for form-urlencoded Duitku callback |

### Cloudflare-specific today ⚠️

| Item | Impact | AWS mitigation |
|---|---|---|
| `export default app` as Worker fetch handler | Wrangler expects fetch export | Add `node-server.ts` with `@hono/node-server` |
| `c.env` bindings injection | Worker injects `env` per request | Middleware: map `process.env` → `c.env` |
| `wrangler.toml` + `wrangler deploy` | Build/deploy path | Keep for CF; add Docker/Node build for AWS |
| `@cloudflare/workers-types` | Dev types only | No runtime dependency |
| `AppBindings` name | Semantics say "Worker" | Same shape works as `process.env` map |

### Not used (no migration needed)

- KV, R2, D1, Durable Objects, Queues, `waitUntil`, `ExecutionContext`
- Cloudflare-specific crypto extensions
- Cron triggers

### Adapter gap summary (Task 11.4)

```txt
Required refactor (small, planned):
  app.ts        → Hono app factory (routes + middleware)
  worker.ts     → export default { fetch: app.fetch } or current pattern for Wrangler
  node-server.ts → serve({ fetch: app.fetch, port, getRuntimeBindings })
  bindings.ts   → loadBindingsFromProcessEnv(): AppBindings

No payment grant logic changes.
No route path changes.
```

**Conclusion:** Business logic is **largely portable**. Blocker is **runtime entry + env injection**, not domain code.

---

## 4. Recommended AWS architecture

### Options compared

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A — EC2 + Node/PM2** | Simple; fast to try | Manual Node version; weaker rollback; env on host | Acceptable fallback |
| **B — EC2 + Docker Compose** | Isolated env; portable to VPS; easy rollback; reproducible | Slightly more setup | **✅ Recommended** |
| **C — AWS Lambda** | AWS-native | Cold starts; API Gateway config; Hono adapter + packaging complexity | **Not recommended** now |

### Recommended topology (minimal)

```txt
                    ┌─────────────────────────────┐
  Users / Browsers  │  Cloudflare Pages (web)     │
                    │  vibenovel-web-staging      │
                    └──────────────┬──────────────┘
                                   │ VITE_API_URL
                                   ▼
                    ┌─────────────────────────────┐
  HTTPS :443        │  EC2 (separate instance)    │
  Caddy             │  api-staging.<domain>       │
                    │  reverse_proxy → :3000      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Docker: vibenovel-api      │
                    │  Node + Hono (port 3000)    │
                    │  env_file: .env.staging     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Hosted Supabase (external) │
                    │  Postgres + Auth            │
                    └─────────────────────────────┘

Cloudflare Worker staging: UNCHANGED (parallel target for comparison)
```

### AWS resources (minimal)

| Resource | Spec | Notes |
|---|---|---|
| **EC2** | Ubuntu 24.04 LTS; `t2.micro` / `t3.micro` if free-tier eligible | API only; no app on Hermes |
| **EBS** | Default 8–30 GB gp2/gp3 | Minimal; monitor snapshots |
| **Security group** | In: 22 (SSH, founder IP), 80, 443; **not** app port 3000 | App internal only |
| **Elastic IP** | Optional | **Cost risk if unattached** — release when stopping |
| **Domain** | `api-staging.<domain>` A → EC2 public IP | Or temporary DNS until domain ready |
| **SSL** | Caddy auto-HTTPS (recommended) or Nginx + certbot | Public HTTPS required for callbacks |

### Explicitly avoid

- NAT Gateway
- Application Load Balancer / NLB
- RDS (use hosted Supabase)
- ECS / EKS / Fargate
- Multi-AZ paid complexity without approval

---

## 5. Cost guard

| Guard | Action |
|---|---|
| AWS Budget alert | Set $5–10/month alert in AWS Billing → Budgets |
| No NAT Gateway | EC2 in public subnet with SG rules only |
| No Load Balancer | Caddy on EC2 terminates TLS |
| Free-tier instance | Prefer `t2.micro`/`t3.micro` in eligible region |
| Stop unused instances | Stop EC2 when not testing; avoid 24/7 unless needed |
| Elastic IP | Release if instance stopped long-term |
| EBS snapshots | Avoid automatic snapshot sprawl |
| Log retention | Docker log rotation or 7–14 day max |
| Data transfer | Keep API payloads lean; no large file hosting on EC2 |

**Founder rule:** No paid AWS resource without explicit approval.

---

## 6. Instance / security plan

### Layout

| Item | Value |
|---|---|
| Linux user | `vibenovel` (non-root) |
| App directory | `/opt/vibenovel` |
| Env file | `/opt/vibenovel/.env.staging` — `chmod 600`, owner `vibenovel` |
| Compose file | `/opt/vibenovel/docker-compose.staging.yml` |
| Logs | `docker compose logs` or `/var/log/vibenovel/` |
| Deploy key | Dedicated SSH key; optional `deploy` user with limited sudo |

### Security checklist

- [ ] SSH key authentication only; disable password login
- [ ] Security group: SSH restricted to founder IP where possible
- [ ] UFW: allow 22, 80, 443; deny public 3000/8787
- [ ] App runs as `vibenovel`, not root
- [ ] `.env.staging` never in git; never on Hermes
- [ ] Rotate secrets if leaked (Supabase, Duitku, Mayar, OpenRouter)
- [ ] `unattended-upgrades` for security patches
- [ ] fail2ban optional for SSH
- [ ] Smoke/health output: no secret values in logs
- [ ] Backup: EBS snapshot before major changes (operator approval)

### Hermes interaction

```txt
Hermes MAY:  run ansible/ssh deploy scripts, hold deploy SSH private key (not app secrets)
Hermes MUST NOT:  run VibeNovel process, store .env.staging, store payment keys
```

---

## 7. Runtime adapter plan (Task 11.4)

### Proposed file layout

```txt
apps/api/src/
  app.ts           # createApp(): Hono<AppEnv> — routes + middleware
  worker.ts        # Cloudflare: export default app (or fetch wrapper)
  node-server.ts   # Node: serve from @hono/node-server
  bindings.ts      # loadBindingsFromProcessEnv(): AppBindings
  index.ts         # re-export for Wrangler compatibility (thin shim)
```

### Node server sketch (not implemented in 11.3)

```typescript
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadBindingsFromProcessEnv } from "./bindings.js";

const bindings = loadBindingsFromProcessEnv();
const app = createApp();
// Middleware injects bindings into c.env per request
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
```

### Wrangler compatibility

- Keep `wrangler.toml` `[env.staging]` for Cloudflare path
- AWS uses same **variable names** in `.env.staging`
- `APP_ENV=staging` on both targets for smoke harness

### Dependencies to add (Task 11.4)

- `@hono/node-server` (runtime)
- Optional: `dotenv` for local Node dev (not committed)

---

## 8. Docker / PM2 strategy comparison

| Aspect | Docker Compose ✅ | PM2 on host |
|---|---|---|
| Env isolation | Strong | Weaker |
| Rollback | `docker compose pull && up` | Git checkout + restart |
| Node version | Pinned in image | nvm on host |
| Portability to VPS | Same compose file | Reconfigure PM2 |
| Ops complexity | Medium | Lower |
| **Recommendation** | **Primary for staging** | Fallback if Docker blocked |

### Proposed files (Task 11.4 — not created in 11.3)

| File | Purpose |
|---|---|
| `apps/api/Dockerfile` | Multi-stage: build shared + API, run Node server |
| `docker-compose.staging.yml` | API service, env_file, restart policy |
| `apps/api/.dockerignore` | Exclude `.dev.vars`, node noise |
| `scripts/aws-deploy-api-staging.ps1` | Optional SSH/rsync + compose up (operator) |

### Container concept

```dockerfile
# Build stage: npm ci, build:shared, compile API
# Run stage: node dist/node-server.js (or tsx entry)
# EXPOSE 3000
# ENV NODE_ENV=production
```

```yaml
# docker-compose.staging.yml (concept)
services:
  api:
    build: .
    env_file: .env.staging
    ports:
      - "127.0.0.1:3000:3000"
    restart: unless-stopped
```

---

## 9. Reverse proxy / SSL plan

### Recommended: Caddy

```caddyfile
# /etc/caddy/Caddyfile on EC2
api-staging.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

- Automatic HTTPS (Let's Encrypt)
- Minimal config vs Nginx + certbot
- Ensure DNS A record points to EC2 **before** first start

### Alternative: Nginx

```nginx
server {
    listen 80;
    server_name api-staging.example.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then certbot for TLS.

### Routes that must be publicly reachable

| Path | Purpose |
|---|---|
| `GET /api/health` | Smoke + monitoring |
| `POST /api/payments/duitku/callback` | Duitku server grant (Mode B later) |
| `POST /api/payments/mayar/webhook` | Mayar server grant (Mode B later) |
| All `/api/*` authenticated routes | Web app via `VITE_API_URL` |

### CORS

Set on AWS API:

```txt
ALLOWED_ORIGINS=https://vibenovel-web-staging.pages.dev
```

Add custom web domain later if Pages custom domain is used.

---

## 10. Env matrix — Cloudflare Worker vs AWS EC2 staging

| Variable | Cloudflare Worker staging | AWS EC2 staging | Notes |
|---|---|---|---|
| `APP_ENV` | `staging` (wrangler var) | `staging` (.env.staging) | Smoke expects `appEnv=staging` |
| `ALLOWED_ORIGINS` | `https://vibenovel-web-staging.pages.dev` | Same (or add AWS web later) | Comma-separated |
| `SUPABASE_URL` | `wrangler secret` | `.env.staging` | Hosted Supabase URL |
| `SUPABASE_ANON_KEY` | `wrangler secret` | `.env.staging` | JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret` | `.env.staging` | Server-only; chmod 600 |
| `CREDIT_TOPUP_ENABLED` | `false` | `false` | Mode A — do not enable |
| `PAYMENT_PROVIDER` | `mock` | `mock` | Mode A |
| `PAYMENT_PROVIDER_MOCK` | `true` | `true` | Mode A |
| `PAYMENT_PROVIDER_MOCK_MODE` | `success` | `success` | Fixture behavior |
| `DUITKU_ENV` | `sandbox` (default) | `sandbox` | When Mode B |
| `DUITKU_MERCHANT_CODE` | secret | `.env.staging` | Mode B only |
| `DUITKU_MERCHANT_KEY` | secret | `.env.staging` | Mode B only |
| `DUITKU_BASE_URL` | var optional | `.env.staging` | Sandbox URL |
| `DUITKU_CALLBACK_URL` | secret/var | `.env.staging` | `https://api-staging.<domain>/api/payments/duitku/callback` |
| `DUITKU_RETURN_URL` | var | `.env.staging` | Web staging origin |
| `MAYAR_API_KEY` | secret | `.env.staging` | Mode B only |
| `MAYAR_BASE_URL` | var optional | `.env.staging` | Sandbox default |
| `MAYAR_REDIRECT_BASE_URL` | var | `.env.staging` | Web return base |
| `AI_GENERATION_ENABLED` | `false` | `false` | Mode A |
| `AI_PROVIDER_MOCK` | `true` | `true` | Mode A |
| `OPENROUTER_API_KEY` | secret (unset) | unset | Mode C deferred |

**Injection mechanism:**

- Cloudflare: `c.env` from Worker bindings
- AWS: `process.env` → `loadBindingsFromProcessEnv()` → same `AppBindings` shape

---

## 11. Smoke strategy (Task 11.2 harness)

After Task 11.4 deploy, verify AWS API with **no code changes** to smoke scripts:

```powershell
# Phase A–C only (no Supabase required)
npm run smoke:staging -- `
  -TargetName "aws-staging" `
  -ApiBaseUrl "https://api-staging.<domain>" `
  -WebBaseUrl "https://vibenovel-web-staging.pages.dev"

# Health only
npm run smoke:staging -- -TargetName "aws-staging" `
  -ApiBaseUrl "https://api-staging.<domain>" -HealthOnly
```

When hosted Supabase + API secrets ready (Task 11.2b + 11.4):

```powershell
npm run smoke:staging -- `
  -TargetName "aws-staging" `
  -ApiBaseUrl "https://api-staging.<domain>" `
  -WebBaseUrl "https://vibenovel-web-staging.pages.dev" `
  -SupabaseUrl "<hosted-url>" `
  -SupabaseAnonKey "<anon-key>" `
  -IncludeApiMode
```

### Expected Mode A on AWS

| Check | Expected |
|---|---|
| `GET /api/health` | `ok=true`, `appEnv=staging` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `aiGenerationEnabled` | `false` |
| CORS | `Access-Control-Allow-Origin` = web staging URL |
| Callback routes | Exist; payment disabled — no live grant |
| Secret leak | None in health JSON |

### Web rebuild for AWS API

Rebuild Pages (build-time only):

```powershell
$env:VITE_API_URL="https://api-staging.<domain>"
$env:VITE_SUPABASE_URL="https://<project>.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="<anon-key>"
$env:VITE_USE_MOCKS="false"
npm run build:web
npm run deploy:web:staging
```

---

## 12. Callback URL plan

| Target | Duitku callback URL | When to register |
|---|---|---|
| **Cloudflare (current)** | `https://vibenovel-api-staging.moxsenna.workers.dev/api/payments/duitku/callback` | Mode B on CF — after full smoke |
| **AWS (future)** | `https://api-staging.<domain>/api/payments/duitku/callback` | After AWS health + smoke PASS |

### Decision rules

1. **Do not register AWS callback** until AWS `smoke:staging` Phase A–C PASS.
2. **One active sandbox callback at a time** — avoid split-brain grants.
3. Document which callback is active in ops log before live smoke (Task 10.13b).
4. Mayar webhook follows same rule: one public URL per sandbox test window.

---

## 13. Migration path

```txt
Today:
  Cloudflare API staging  → GO Mode A (shell)
  Cloudflare Pages web    → GO shell
  Hosted Supabase         → BLOCKED (operator)
  AWS EC2                 → NOT DEPLOYED

Task 11.4:
  Add Node adapter + Docker
  Deploy API to separate EC2
  smoke:staging against AWS -ApiBaseUrl

Parallel (not replacement):
  Cloudflare staging stays live for comparison
  Web can point to AWS via VITE_API_URL rebuild
  Supabase remains hosted (same project for both API targets if desired)

Later decision (founder):
  Compare CF Worker vs AWS EC2: cost, logs, cold start, ops burden
  Production target TBD — not in Sprint 11 scope
```

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Accidental cost (EIP, NAT, LB) | Cost guard checklist; Budget alert |
| Secrets on Hermes | Policy: secrets only on VibeNovel EC2 `.env.staging` |
| Split callback URLs | One active sandbox callback; document in ops |
| Node adapter bugs | Task 11.4: keep Worker path; run `smoke:all:local` + `smoke:staging` |
| Supabase still blocked | AWS API useless for auth until 11.2b; health/CORS still testable |
| Security group too open | Restrict SSH; no public app port |
| Instance compromise | Non-root user, minimal packages, rotate keys |
| Cloudflare staging regression | Do not delete Worker; independent smoke per target |

---

## 15. Rollback plan

| Scenario | Action |
|---|---|
| AWS misconfigured | `docker compose down`; stop EC2 |
| Bad deploy | Revert to previous image tag / git SHA on EC2 |
| Callback confusion | Re-register Duitku to Cloudflare URL; disable AWS |
| Secrets leaked | Rotate in Supabase/Duitku/Mayar; redeploy `.env.staging` |
| Cost overrun | Stop EC2; release Elastic IP |

Cloudflare staging rollback unchanged: redeploy Mode A vars via `npm run deploy:api:staging`.

---

## 16. Next implementation task

| Priority | Task | Scope |
|---|---|---|
| **11.4** | AWS API Staging Adapter + Deploy Prep | ✅ [`docs/66`](66-aws-api-staging-adapter-and-docker-prep-report.md) |
| **11.2b** | Operator Supabase gate (parallel) | Worker secrets + web rebuild — unblocks full smoke on **either** CF or AWS |
| **11.5** | AWS EC2 provision + first deploy | Operator creates EC2, DNS, Caddy — **next** |

**Founder decision:**

- **Supabase first (11.2b)** if auth/full API smoke is priority on existing Cloudflare staging.
- **Adapter first (11.4)** if AWS path is priority while Supabase operator work proceeds in parallel.

---

## Go / No-Go (Task 11.3)

| Criterion | Met |
|---|---|
| docs/65 created | ✅ |
| Separate EC2 from Hermes documented | ✅ |
| Minimal AWS architecture recommended | ✅ |
| Cost guards documented | ✅ |
| Env matrix documented | ✅ |
| Runtime adapter needs documented | ✅ |
| Docker/PM2 comparison | ✅ |
| Reverse proxy/SSL plan | ✅ |
| Smoke strategy with `-ApiBaseUrl` | ✅ |
| Callback URL decision | ✅ |
| No AWS deploy | ✅ |
| No production touched | ✅ |
| No secrets committed | ✅ |

**Verdict: GO (plan complete)** — Task 11.4 adapter implemented ([`docs/66`](66-aws-api-staging-adapter-and-docker-prep-report.md)). Task 11.5 operator implementation: [`docs/68`](68-aws-ec2-api-staging-deploy-report.md) (**BLOCKED** in agent session — bootstrap scripts in `deploy/ec2/`).

---

*Authored Task 11.3 — 9 Juni 2026. Docs-only; no AWS resources created.*