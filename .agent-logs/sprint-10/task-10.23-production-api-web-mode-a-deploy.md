# Task 10.23 — Production API/Web Mode A Deploy on narraza.web.id (rerun #2)

## Task goal

Deploy production API + web Mode A on `narraza.web.id` / `api.narraza.web.id` with founder approval.

## Approval

**YES** — `APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY` received in session rerun #2.

## Files created/changed

| Path | Note |
|---|---|
| `scripts/build-production-web.ps1` | Forces production VITE_* from `.env.production` (fixes .env.local bleed) |
| `package.json` | `build:web:production`; `deploy:web:production` uses build script |
| `docs/81-production-api-web-mode-a-deploy-report.md` | PARTIAL GO closure rerun #2 |

## Commands run

```powershell
npm run operator:production:api-web:deploy -- -Mode preflight
aws sts get-caller-identity  # NoCredentials
nslookup api.narraza.web.id 8.8.8.8  # NXDOMAIN
nslookup api-staging.narraza.web.id 8.8.8.8  # 13.212.245.32
powershell -File scripts/build-production-web.ps1
npx wrangler pages deploy ... narraza-web-production  # 03f5654d...
Invoke-WebRequest https://03f5654d.narraza-web-production.pages.dev  # 200
Invoke-RestMethod api-staging .../health  # Mode A PASS
```

**Not run:** EC2 provision, DNS A record, Caddy on prod, API health on api.narraza.web.id

## Results

| Item | Result |
|---|---|
| Approval | **YES** |
| Production API | **NOT DEPLOYED** — no AWS creds, no EC2 IP, DNS NXDOMAIN |
| Production web | **PASS** — corrected build (prod Supabase + api.narraza.web.id); Pages HTTP 200 |
| VITE_API_URL | `https://api.narraza.web.id` |
| Staging regression | **PASS** |
| Payment / 00010 | **NO** |
| Status | **PARTIAL GO** |

## Next

Operator: `aws configure` → EC2+EIP → DNS `api` → `npm run operator:production:aws:deploy -- -Ec2Ip <EIP> -ApprovalText "..."` → attach `narraza.web.id` in Cloudflare Pages.