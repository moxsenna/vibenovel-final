# Task 10.25 — Private Beta Launch Readiness Audit

**Date:** 2026-06-10  
**Status:** GO (founder auth smoke gate)  
**Agent:** audit + critical login fix + redeploy

## Audit scope

Production domain model, homepage, app bundle, API/CORS, payment-off, security, auth/first-use path.

## Critical finding + fix

**Blocker:** Production app had no login UI (`DevAuthPanel` gated on `import.meta.env.DEV`). Homepage CTAs pointed to `/login` but router had no such route.

**Fix:**

- `apps/web/src/pages/LoginPage.tsx` — sign-in/sign-up
- Route `/login` in `routes/index.tsx`
- Redeploy: `npm run deploy:web:production` → bundle `index-NDBw2L4h.js`

**Homepage SEO (minor):** canonical + OG meta in `apps/homepage/index.html`; redeploy `npm run deploy:homepage:production`

## Verification results

| Area | Result |
|---|---|
| DNS apex/app/api | PASS |
| Homepage HTTP 200, static, CTAs | PASS |
| App /login HTTP 200, LoginPage in bundle | PASS |
| Bundle: no staging refs, no service_role | PASS |
| API Mode A production + staging | PASS |
| CORS app + homepage origins | PASS |
| Payment off UI messaging | PASS |
| .env.production gitignored | PASS |
| Live auth E2E | Not run — founder gate |
| POST /api/projects from UI | Not wired — demo project beta limitation |

## Commands

```powershell
nslookup narraza.web.id 8.8.8.8
curl.exe -I https://narraza.web.id/
curl.exe -I https://app.narraza.web.id/login
curl.exe https://api.narraza.web.id/api/health
npm run typecheck:web
npm run deploy:web:production
npm run deploy:homepage:production
```

## Deliverables

- `docs/86-private-beta-launch-readiness-audit.md`
- README + docs/36, docs/63, docs/85, scripts/README updates

## Stop rule

No payment, 00010, Duitku prod, callback, or live payment.