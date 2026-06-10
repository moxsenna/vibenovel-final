# Task 10.24 — Production Homepage on narraza.web.id

**Date:** 2026-06-10  
**Status:** GO (closed on apex DNS rerun)  
**Agent:** verify only on rerun; no redeploy

## Initial deploy (PARTIAL GO)

- Static homepage → `narraza-homepage-production`
- Custom domain attached; CNAME pending (OAuth zone:read)

## Apex DNS rerun (founder)

Founder added Cloudflare DNS:

- Type: CNAME
- Name: @
- Target: narraza-homepage-production.pages.dev
- Proxy: Proxied

## Rerun verification commands

```powershell
nslookup narraza.web.id 8.8.8.8
nslookup app.narraza.web.id 8.8.8.8
nslookup api.narraza.web.id 8.8.8.8
curl.exe -sS -o NUL -w "apex:%{http_code}" https://narraza.web.id/
curl.exe -sS https://narraza.web.id/ | findstr /i "Build long fiction Start Writing"
curl.exe -sS https://narraza.web.id/ | findstr /i "index-CCUIgaLV"   # expect no match
curl.exe -sS https://app.narraza.web.id/ | findstr /i "index-CCUIgaLV"  # expect match
curl.exe -sS https://api.narraza.web.id/api/health
curl.exe -sS https://api-staging.narraza.web.id/api/health
```

## Rerun results

| Check | Result |
|---|---|
| `narraza.web.id` DNS | Cloudflare proxied PASS |
| `app.narraza.web.id` DNS | PASS |
| `api.narraza.web.id` DNS | `13.251.228.117` PASS |
| `https://narraza.web.id/` | HTTP 200 |
| Static homepage copy | PASS |
| No dashboard bundle on apex | PASS |
| `app.narraza.web.id` | HTTP 200, dashboard bundle present |
| Production API Mode A | PASS |
| Staging API Mode A | PASS |
| Payment / 00010 | OFF / NOT applied |

## Verdict

**GO** — Task 10.24 closed.

## Deliverables

- `docs/85-production-homepage-placeholder-report.md` (updated GO)
- README + docs index updates