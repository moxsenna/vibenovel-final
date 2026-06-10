# 68 — AWS EC2 API Staging Deploy Report (Task 11.5)

**Date:** 2026-06-09  
**Status:** Closed — **PARTIAL GO** (API live HTTP; HTTPS domain pending)  
**Verdict:** EC2 Docker API staging **live**; `smoke:staging -IncludeApiMode` **PASS** against AWS; Cloudflare baseline **intact**  
**Endpoint:** `http://13.212.245.32/api/health` (Caddy :80 → container :8787)  
**Related:** [`docs/65`](65-aws-staging-readiness-and-ec2-plan.md), [`docs/66`](66-aws-api-staging-adapter-and-docker-prep-report.md), [`.agent-logs/sprint-11/task-11.5-aws-ec2-api-staging-deploy.md`](../.agent-logs/sprint-11/task-11.5-aws-ec2-api-staging-deploy.md)

Task 11.5 deploys VibeNovel API staging to a **separate AWS EC2** instance (not Hermes) using Docker Compose + Caddy. **Mode A only.** **No production touched.** **No secrets committed.**

---

## 1. Goal and scope

| In scope | Out of scope |
|---|---|
| EC2 bootstrap + Docker API | Production |
| Caddy HTTP reverse proxy | Payment live / sandbox |
| Portable smoke against AWS `-ApiBaseUrl` | `CREDIT_TOPUP_ENABLED=true` |
| Cloudflare staging regression | Hermes hosting |
| Node 20 `ws` fix for Supabase on Docker | HTTPS domain (deferred) |

---

## 2. AWS resources created

| Resource | Status |
|---|---|
| EC2 Ubuntu 24.04 (`13.212.245.32`) | **LIVE** — operator-provisioned |
| Instance separation from Hermes | **Operator confirmed** (dedicated staging key) |
| Security group | **Assumed** 22/80/443 (operator) |
| Elastic IP | Unknown — may be default public IP |
| DNS `api-staging.<domain>` | **NOT CONFIGURED** |
| `/opt/vibenovel` app directory | **Created** |
| Linux user `vibenovel` | **Created** (bootstrap script) |

SSH key: `vibenovel-staging-key.pem` (local operator machine, not in repo).

---

## 3. Server bootstrap

Executed on EC2:

```bash
sudo bash /tmp/bootstrap-ubuntu.sh
```

Installed: Docker, Compose plugin, Caddy, UFW (22/80/443), fail2ban, `vibenovel` user.

---

## 4. Deploy method

1. Tarball from local repo (excludes `node_modules`, `.git`) → `/opt/vibenovel`
2. `.env.staging` copied separately → `chmod 600`, owner `vibenovel`
3. `docker compose -f docker-compose.staging.yml up -d --build`
4. Caddy [`deploy/caddy/Caddyfile.ec2-http-ip`](../deploy/caddy/Caddyfile.ec2-http-ip) → `/etc/caddy/Caddyfile`

**Code fix post-deploy:** Node 20 Docker lacked WebSocket for Supabase — added `ws` polyfill in `apps/api/src/node-server.ts`, rebuilt container on EC2.

---

## 5. Env / secrets status

| Variable | EC2 `.env.staging` |
|---|---|
| `SUPABASE_*` (staging project) | **Set** (operator; not logged) |
| `CREDIT_TOPUP_ENABLED` | `false` |
| `PAYMENT_PROVIDER` | `mock` |
| `AI_GENERATION_ENABLED` | `false` |
| Payment/AI live keys | **Not set** |

---

## 6. Docker deploy result

```bash
curl -s http://127.0.0.1:8787/api/health   # on EC2 — PASS
docker compose ps                           # healthy
```

| Health flag | Value |
|---|---|
| `ok` | `true` |
| `appEnv` | `staging` |
| `hasSupabaseUrl/AnonKey/ServiceRoleKey` | all `true` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `aiGenerationEnabled` | `false` |

---

## 7. Caddy / HTTPS result

| Item | Status |
|---|---|
| Caddy `:80` → `127.0.0.1:8787` | **PASS** |
| Public `http://13.212.245.32/api/health` | **PASS** |
| HTTPS + custom domain | **BLOCKED** — no DNS yet |

When domain ready: replace Caddyfile with [`deploy/caddy/Caddyfile.staging.example`](../deploy/caddy/Caddyfile.staging.example) and point DNS A record to EC2 IP.

---

## 8. AWS smoke result

```powershell
npm run operator:aws:staging:smoke -- `
  -ApiBaseUrl "http://13.212.245.32" `
  -IncludeApiMode `
  -TestEmail "staging-smoke@vibenovel.test" `
  -CloudflareRegression
```

| Phase | Result |
|---|---|
| A — Health Mode A | **PASS** |
| B — Web 200 | **PASS** |
| C — CORS | **PASS** |
| D — Sprint 2 API (17 steps) | **PASS** |
| E — Web API-mode topup safe | **PASS** |

**Failures: 0** — `PASS: full staging smoke`

Web still uses Cloudflare API URL (no `VITE_API_URL` rebuild to AWS in 11.5).

---

## 9. Cloudflare staging regression

```powershell
npm run smoke:staging:health   # PASS — Worker Mode A intact
```

Cloudflare full `smoke:staging -IncludeApiMode` not re-run; health regression **PASS**.

---

## 10. Rollback

```bash
cd /opt/vibenovel
docker compose -f docker-compose.staging.yml down
# restore prior image/git tag && up -d --build
```

Emergency: stop EC2, remove DNS, rotate `.env.staging` if leaked. Cloudflare Worker remains fallback API.

---

## 11. Cost guard

- No NAT / ALB / RDS / ECS
- Stop EC2 when idle; release Elastic IP if unused
- Set AWS Budget alert (operator)

---

## 12. Remaining blockers

| Blocker | Next |
|---|---|
| HTTPS `api-staging.<domain>` | Task 11.6 or operator DNS + Caddy TLS |
| Web browser → AWS API | Rebuild Pages with `VITE_API_URL=http(s)://...` |
| Payment callback registration | Only after HTTPS stable |

---

## 13. Go / No-Go

| Level | Verdict |
|---|---|
| **GO FULL AWS** (HTTPS + domain) | **NO** — HTTP IP only |
| **GO AWS API staging** (Mode A smoke) | **YES** — IncludeApiMode PASS |
| **PARTIAL GO** | **YES** — overall task verdict |
| **NO-GO** | **NO** — no secrets leak, CF intact, Mode A safe |

---

## 14. Next recommended task

1. **Task 11.6** — [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md) DNS + `operator:aws:https:gate` (**BLOCKED** until A record)  
2. **Task 10.13b** — Duitku sandbox after GO FULL HTTPS on AWS

---

## Operator quick reference

```powershell
$Key = 'D:\0Project\VibeNovel\vibenovel-staging-key.pem'
ssh -i $Key ubuntu@13.212.245.32

# On EC2
cd /opt/vibenovel
sudo -u vibenovel docker compose -f docker-compose.staging.yml logs -f api
curl -s http://127.0.0.1:8787/api/health

# Local smoke
npm run operator:aws:staging:smoke -- -ApiBaseUrl "http://13.212.245.32" -IncludeApiMode -TestEmail "staging-smoke@vibenovel.test" -CloudflareRegression
```