# Task 10.23a — Production Infra Unblock for API/App/Homepage Mode A

## Task goal

Unblock production infrastructure from Task 10.23 with corrected domain model: homepage (`narraza.web.id`), app (`app.narraza.web.id`), API (`api.narraza.web.id`). Preflight AWS/EC2/DNS/Pages without enabling payment or applying `00010`.

## Files read

- `docs/81-production-api-web-mode-a-deploy-report.md`
- `docs/80-production-api-web-dns-mode-a-preflight-report.md`
- `docs/78-production-environment-foundation-plan.md`
- `docs/79-production-supabase-baseline-setup-report.md`
- `README.md`, `scripts/README.md`
- `deploy/ec2/deploy-app-production.sh`, `deploy/caddy/Caddyfile.production.example`
- `docker-compose.production.yml`
- `scripts/operator-production-api-web-deploy.ps1`, `scripts/build-production-web.ps1`
- `.env.production.example`, `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `scripts/operator-production-infra-unblock.ps1` | New 10.23a preflight gate |
| `scripts/build-production-web.ps1` | VITE_PUBLIC_SITE_URL, VITE_APP_URL |
| `scripts/operator-production-aws-deploy.ps1` | App host app.narraza.web.id |
| `scripts/operator-production-api-web-deploy.ps1` | Three-domain preflight |
| `apps/web/src/vite-env.d.ts` | VITE env types |
| `.env.production.example` | Domain model + env |
| `.env.production` (gitignored) | ALLOWED_ORIGINS + app subdomain |
| `package.json` | operator:production:infra:unblock |
| `docs/82-production-infra-unblock-report.md` | Closure report |
| `docs/78`, `docs/80`, `docs/81`, `docs/36`, `docs/63`, `README.md`, `scripts/README.md` | Domain model |

## Commands run

```powershell
aws sts get-caller-identity  # NoCredentials
nslookup api.narraza.web.id 8.8.8.8  # NXDOMAIN
nslookup app.narraza.web.id 8.8.8.8  # NXDOMAIN
nslookup narraza.web.id 8.8.8.8  # resolvable
npm run operator:production:infra:unblock  # PARTIAL GO exit 1
powershell -File scripts/build-production-web.ps1  # PASS
Invoke-RestMethod api-staging .../health  # Mode A PASS (via preflight script)
git check-ignore .env.production  # PASS
```

**Not run:** EC2 provision, bootstrap, DNS create, API deploy, Pages custom domain attach (Dashboard required).

## Results

| Item | Result |
|---|---|
| Domain model | **PASS** — homepage / app / API split documented |
| AWS credentials | **BLOCKED** — NoCredentials |
| EC2/EIP | **NOT provisioned** |
| DNS api/app | **PENDING** — NXDOMAIN |
| .env.production Mode A | **PASS** — includes app.narraza.web.id |
| App build | **PASS** — VITE_API_URL + VITE_APP_URL |
| Pages preview | **PASS** HTTP 200 |
| API health | **PENDING** — NXDOMAIN |
| Staging regression | **PASS** Mode A |
| Payment / 00010 | **NO** |
| Status | **PARTIAL GO** |

## Decisions

- **Option A (Fast MVP):** App on `app.narraza.web.id`; apex `narraza.web.id` = homepage/placeholder, not dashboard.
- **EC2 STOP** when AWS NoCredentials — no provision attempted.
- **DNS/custom domain** documented as manual Cloudflare Dashboard steps (wrangler zone read only).
- Task 10.23 approval treated as still valid; API deploy deferred until infra PASS.

## Limitations

- Cannot provision EC2 or edit DNS without operator AWS/Cloudflare credentials.
- `VITE_PUBLIC_SITE_URL` / `VITE_APP_URL` typed but not yet consumed in app UI code.
- Homepage landing not built; apex redirect/placeholder is plan only.

## Next recommended task

Operator: `aws configure` → EC2+EIP → DNS `api` → attach `app.narraza.web.id` on Pages → `operator:production:aws:deploy`.