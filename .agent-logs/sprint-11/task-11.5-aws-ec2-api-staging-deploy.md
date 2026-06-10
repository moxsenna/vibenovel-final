# Task 11.5 — AWS EC2 Provision + Deploy API Staging

## Task goal

Deploy VibeNovel API staging to separate AWS EC2 (not Hermes) via Docker Compose + Caddy, Mode A only, verify smoke, preserve Cloudflare staging.

## Files read

- `docs/65`–`docs/68`, `docker-compose.staging.yml`, `apps/api/Dockerfile`, `.env.staging.example`
- `deploy/caddy/Caddyfile.staging.example`, `scripts/operator-aws-ec2-staging-smoke.ps1`

## Files created/changed

| Path | Note |
|---|---|
| `deploy/ec2/bootstrap-ubuntu.sh` | Created (prior session) |
| `deploy/ec2/deploy-app.sh` | Created (prior session) |
| `scripts/operator-aws-ec2-staging-smoke.ps1` | Created (prior session) |
| `deploy/caddy/Caddyfile.ec2-http-ip` | **Created** — HTTP :80 → 127.0.0.1:8787 |
| `apps/api/src/node-server.ts` | **Updated** — `ws` WebSocket polyfill for Node 20 |
| `apps/api/package.json` | **Updated** — `ws`, `@types/ws` |
| `package-lock.json` | **Updated** |
| `docs/68-aws-ec2-api-staging-deploy-report.md` | **Updated** — live deploy results |

## Commands run

```powershell
# SSH key ACL
icacls D:\0Project\VibeNovel\vibenovel-staging-key.pem /inheritance:r ...

# EC2
ssh -i <key> ubuntu@13.212.245.32 uname -a
scp bootstrap-ubuntu.sh → EC2; sudo bash bootstrap
tar + scp repo + .env.staging → /opt/vibenovel
docker compose up -d --build
Caddy :80 reverse_proxy (Caddyfile.ec2-http-ip)
curl http://13.212.245.32/api/health

# Fix Node 20 WebSocket → rebuild container on EC2
npm install -w @vibenovel/api  # ws
scp node-server.ts + package-lock → rebuild

# Smoke
npm run operator:aws:staging:smoke -- -ApiBaseUrl http://13.212.245.32 -IncludeApiMode -TestEmail staging-smoke@vibenovel.test -CloudflareRegression

npm run typecheck:api
```

## Results

| Item | Result |
|---|---|
| EC2 `13.212.245.32` (ap-southeast-1 inferred) | **LIVE** |
| Bootstrap (Docker, Caddy, ufw, user vibenovel) | **PASS** |
| Docker API healthy on 127.0.0.1:8787 | **PASS** |
| Caddy HTTP :80 public | **PASS** |
| External health Mode A flags | **PASS** |
| `operator:aws:staging:smoke -IncludeApiMode` | **PASS** (17/17 sprint2) |
| Cloudflare health regression | **PASS** |
| HTTPS / custom domain | **NOT CONFIGURED** |
| Secrets committed | **NO** |

## Decisions

- Deploy via **tarball scp** (local repo ahead of remote git); `.env.staging` copied separately, chmod 600.
- **Caddy HTTP-only** on `:80` until `api-staging.<domain>` DNS ready.
- **ws polyfill** in `node-server.ts` only (Worker bundle unchanged) — fixes Supabase 500 on Node 20 Docker.

## Limitations

- No AWS Console/CLI provision from agent — operator created instance + key.
- HTTPS / Let's Encrypt deferred (no domain).
- Web still points to Cloudflare API (`VITE_API_URL` unchanged).

## Next recommended task

**Task 11.6** — DNS `api-staging.<domain>` + Caddy HTTPS; optional web rebuild to AWS API. Or **10.13b** after HTTPS callback URL exists.