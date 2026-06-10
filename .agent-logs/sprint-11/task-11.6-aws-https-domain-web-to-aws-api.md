# Task 11.6 — AWS HTTPS Domain + Web-to-AWS API Staging Integration

## Status

**COMPLETE / GO FULL** — founder accepted 2026-06-09.

## Task goal

HTTPS on `api-staging.narraza.web.id`, smoke against AWS API, rebuild web staging to AWS `VITE_API_URL`, web-to-AWS smoke, Cloudflare API fallback regression.

## Brand & domain

| Item | Value |
|---|---|
| Product brand | **Narraza** — *Build long fiction without losing the plot.* |
| Historical | VibeNovel / Novory — repo/code only |
| Staging apex | `narraza.web.id` (temporary MVP) |
| Future prod | `narraza.id` |

## Staging endpoints

| Surface | URL |
|---|---|
| API (primary) | `https://api-staging.narraza.web.id` |
| Web | `https://vibenovel-web-staging.pages.dev` → AWS API |
| API fallback | `https://vibenovel-api-staging.moxsenna.workers.dev` |

## Files read

- `docs/68`, `docs/65`, `docs/66`, `docs/64`, `deploy/caddy/Caddyfile.staging.example`
- `scripts/operator-aws-ec2-staging-smoke.ps1`, `docker-compose.staging.yml`

## Files created/changed

| Path | Note |
|---|---|
| `scripts/operator-aws-https-web-gate.ps1` | Gate script + fixes (Caddy spacing, preflight, TLS, LE wait) |
| `package.json` | `operator:aws:https:gate` |
| `apps/web/.env.example` | Task 11.6 AWS API URL note |
| `docs/69-aws-https-domain-and-web-to-aws-api-report.md` | Closure report — GO FULL |
| README, docs/36, docs/63, docs/01, docs/68, scripts/README, apps/api/README | Updated |

## Commands run

```powershell
Resolve-DnsName api-staging.narraza.web.id -Type A        # 13.212.245.32 PASS

npm run operator:aws:https:gate -- -Domain narraza.web.id -SkipCaddyDeploy  # PASS (after fixes + retry)
```

## Results (founder checklist)

| # | Item | Result |
|---|---|---|
| 1 | DNS `api-staging.narraza.web.id` → `13.212.245.32` | **PASS** |
| 2 | Caddy + Let's Encrypt HTTPS | **PASS** |
| 3 | `https://api-staging.narraza.web.id/api/health` Mode A safe | **PASS** |
| 4 | AWS HTTPS smoke | **PASS** |
| 5 | Web rebuild `VITE_API_URL` → AWS | **PASS** |
| 6 | Web-to-AWS smoke (Pages propagation retry) | **PASS** |
| 7 | Cloudflare Worker API regression | **PASS** |

## Script fixes

- Caddyfile: space before `{`
- Preflight: HTTPS hostname / SSH docker health fallback (IP-only HTTP invalid after hostname Caddy)
- PowerShell: TLS 1.2
- Let's Encrypt: 20s wait after Caddy reload

## Decisions

- Single gate script `operator:aws:https:gate` with mandatory `-Domain` apex param.
- DNS-only first; payment callback deferred until GO FULL (now unblocks 10.13b).
- Web deploy uses `wrangler pages deploy` directly after `build:web`.

## Limitations still in force

- Production payment **NOT READY**
- Duitku sandbox live **NOT RUN** (next: 10.13b)
- Mayar live **NOT RUN**
- Do not enable production payment/provider dashboards
- `narraza.web.id` = temporary staging domain

## Next recommended task

**Task 10.13b** — Duitku Mode B sandbox-only:

- Callback: `https://api-staging.narraza.web.id/api/payments/duitku/callback`
- Verify: createInvoice sandbox, valid paymentUrl, callback to AWS HTTPS, grant once, duplicate no double grant, invalid sig/amount/unknown order no grant, rollback to Mode A documented