# Task 10.23c — Verify Production App Custom Domain

**Date:** 2026-06-10  
**Status:** GO  
**Agent:** verification only — no deploy, no payment, no migration

## Scope executed

1. DNS via `nslookup … 8.8.8.8`
2. HTTP checks on `app.narraza.web.id` (/, /login, /dashboard, assets)
3. Live bundle audit (`index-CCUIgaLV.js` — 658,841 bytes)
4. API health production + staging
5. Root domain safety (`narraza.web.id`)
6. Report `docs/84` + doc cross-refs

## Commands run

```powershell
nslookup app.narraza.web.id 8.8.8.8
nslookup api.narraza.web.id 8.8.8.8
nslookup api-staging.narraza.web.id 8.8.8.8
nslookup narraza.web.id 8.8.8.8

curl.exe -sS -o NUL -w "app:%{http_code}" https://app.narraza.web.id/
curl.exe -sS https://app.narraza.web.id/
curl.exe -sS https://api.narraza.web.id/api/health
curl.exe -sS https://api-staging.narraza.web.id/api/health

# Bundle download + pattern counts
curl.exe -sS -o agent-tools/live-index-CCUIgaLV.js https://app.narraza.web.id/assets/index-CCUIgaLV.js
powershell -File agent-tools/task-10.23c-bundle-audit.ps1
```

## Results

| Check | Result |
|---|---|
| `app.narraza.web.id` DNS | Cloudflare proxied PASS |
| `api.narraza.web.id` DNS | `13.251.228.117` PASS |
| `api-staging` DNS | `13.212.245.32` PASS |
| App HTTP 200 + bundles | PASS |
| No staging API in bundle | PASS |
| `api.narraza.web.id` in bundle | PASS |
| Production API health Mode A | PASS |
| Staging API health Mode A | PASS |
| Root apex | NXDOMAIN — homepage pending, no dashboard leak |
| Payment / 00010 | OFF / NOT applied |

## Bundle notes

- `localhost` / `127.0.0.1` appear only in vendor/minified fallback (Supabase auth, `getApiUrl` dead fallback) — not staging wiring.
- Active API: `"https://api.narraza.web.id"`.

## Stop rule

Stopped after verification. No payment, migration 00010, Duitku prod, callback, or homepage build.

## Deliverables

- `docs/84-production-app-custom-domain-verify-report.md`
- README + docs/36, 63, 81–83, scripts/README updates