# 86 — Private Beta Launch Readiness Audit (Task 10.25)

**Date:** 2026-06-10  
**Status:** **GO** (with documented beta limitations + founder auth smoke required)  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/85`](85-production-homepage-placeholder-report.md), [`docs/84`](84-production-app-custom-domain-verify-report.md), [`docs/83`](83-production-ec2-api-mode-a-deploy-report.md), [`.agent-logs/sprint-10/task-10.25-private-beta-launch-readiness-audit.md`](../.agent-logs/sprint-10/task-10.25-private-beta-launch-readiness-audit.md)

Task 10.25 audits production readiness for **private beta without payment**. **Payment NOT enabled.** **Migration `00010` NOT applied.**

**Critical fix applied during audit:** production app had no login UI (`DevAuthPanel` is dev-only) and no `/login` route despite homepage CTAs → added `LoginPage` and redeployed app.

---

## Final summary

```txt
Task 10.25 — Private Beta Launch Readiness Audit
Status: GO

Domains: homepage + app + API live; staging PASS
User path: narraza.web.id → app/login → auth UI → dashboard (structural)
Payment: OFF | 00010: NOT APPLIED | no staging leakage
Founder gate: live auth smoke + Supabase Auth settings before inviting users
```

---

## Domains

| Surface | DNS (8.8.8.8) | HTTP | Notes |
|---|---|---|---|
| **Homepage** `narraza.web.id` | Cloudflare proxied | **200** | Static landing; no dashboard bundle |
| **App** `app.narraza.web.id` | Cloudflare proxied | **200** | SPA; `/login` **200** |
| **API** `api.narraza.web.id` | `13.251.228.117` | health **PASS** | Mode A production |
| **Staging API** | `13.212.245.32` | health **PASS** | Mode A unchanged |

**Redirect behavior:** No apex→dashboard redirect. Homepage CTAs link to `app.narraza.web.id` and `/login`. SPA routes return shell HTML (200) for client routing.

**Root separation:** Apex has no `index-NDBw2L4h.js` (app bundle). App serves dashboard bundle only on `app.` subdomain.

---

## Homepage

| Check | Result |
|---|---|
| HTTP 200 | **PASS** |
| Approved copy | **PASS** |
| CTA → `app.narraza.web.id` | **PASS** |
| CTA → `app.narraza.web.id/login` | **PASS** |
| Static (no breaking JS) | **PASS** — minimal nav scroll script only |
| Assets | **PASS** — `/styles.css` loads |
| Mobile viewport meta | **PASS** |
| Title + description | **PASS** |
| Canonical | **PASS** — `https://narraza.web.id/` (added Task 10.25) |
| Open Graph | **PASS** — `og:title`, `og:description`, `og:url` (added Task 10.25) |
| OG image | **N/A** — not set (non-blocking) |
| Favicon | **PASS** — inline SVG |
| Heading hierarchy | **PASS** — single h1 in hero, section h2s |
| Focus visible / touch targets | **PASS** — UI/UX Pro Max patterns in CSS |
| Dashboard on apex | **NO** |

---

## App

| Check | Result |
|---|---|
| HTTP `/` | **200** |
| HTTP `/login` | **200** |
| HTTP `/dashboard` | **200** (SPA shell) |
| Login UI in production bundle | **PASS** — `LoginPage` with sign-in/sign-up |
| API wiring | **PASS** — `https://api.narraza.web.id` |
| `VITE_USE_MOCKS` | **false** in production build |
| Production Supabase ref | **PASS** — `qjmbobvarspwvaalnjct` (≠ staging) |

### Bundle audit (`index-NDBw2L4h.js`)

| Pattern | Count | Verdict |
|---|---|---|
| `api-staging.narraza.web.id` | 0 | **PASS** |
| `vibenovel-web-staging.pages.dev` | 0 | **PASS** |
| `jdxyhrnibmmwlbtbokqo` | 0 | **PASS** |
| `service_role` / `SERVICE_ROLE` | 0 | **PASS** |
| `api.narraza.web.id` | 1+ | **PASS** |
| `duitku` | 1 | **Acceptable** — shared enum/copy strings only; no keys |

---

## API / CORS

| Check | Result |
|---|---|
| Production health Mode A | **PASS** |
| CORS `Origin: https://app.narraza.web.id` | **PASS** — `Access-Control-Allow-Origin` set |
| CORS `Origin: https://narraza.web.id` | **PASS** |
| `GET /api/projects` without auth | **401** — expected |
| Staging regression | **PASS** |

---

## Auth

| Check | Result |
|---|---|
| Production login route | **PASS** — `/login` after fix |
| Register UI | **PASS** — sign-up mode on `LoginPage` |
| Login UI | **PASS** |
| Logout | **Available** via Supabase client (session clear) |
| Session persistence | **Designed** — `AuthContext` + `onAuthStateChange` |
| Route guard | **Soft** — dashboard loads without auth; shows mock + notice until login |
| Live E2E register/login | **Not run by agent** — no test credentials in docs |
| Email confirmation | **Founder verify** — check Supabase Auth → Email provider → confirm email setting |

**Pre-audit blocker (fixed):** `DevAuthPanel` only renders when `import.meta.env.DEV`; production had **no** auth UI. Homepage `/login` CTAs hit SPA with no matching route.

**Founder smoke (required before inviting beta users):**

1. Open `https://app.narraza.web.id/login`
2. Register or sign in with controlled private-beta test email
3. Confirm redirect to `/dashboard` and API data loads (not mock notice)
4. Sign out and confirm session cleared

---

## First-use flow

| Check | Result (Task 10.25) | Updated (Task 10.26) |
|---|---|---|
| Dashboard reachable | **PASS** | **PASS** |
| Empty / unauthenticated state | Mock + login notice | Unauthed notice; authed empty → *Belum ada proyek* |
| Create project CTA visible | **PASS** | **PASS** |
| `/start` entry options | Demo `DEMO_PROJECT_ID` links | **`POST /api/projects`** → real `/projects/:id/...` |
| API `POST /api/projects` from UI | Not wired | **Wired** — see [`docs/87`](87-real-private-beta-story-flow-report.md) |
| Intake persistence | Demo id remap | Real project id + DB persist (stub agent) |
| AI prose features | Disabled | **Disabled** — UI: *AI generation belum aktif* |
| Beta messaging | **PASS** | **PASS** |

**Task 10.26 (GO):** Founder verified create/intake persist — [`docs/87`](87-real-private-beta-story-flow-report.md). **Task 10.26b (PARTIAL GO):** logout UI fixed; re-smoke Keluar — [`docs/88`](88-founder-private-beta-story-smoke-report.md).

---

## Payment-off

| Check | Result |
|---|---|
| `creditTopupEnabled` | **false** |
| `paymentProviderMock` | **true** |
| `paymentProvider` | **mock** |
| `/credits/topup` UI when disabled | Shows *"Top up belum tersedia"* |
| Write room topup link | Hidden; shows *"Top up belum tersedia di versi ini"* |
| Duitku production vars in frontend | **NO keys** |
| Migration `00010` on production | **NOT applied** (per docs/79, docs/77) |
| Live payment / callback | **NOT active** |

---

## Security

| Check | Result |
|---|---|
| Service role in frontend bundle | **NO** |
| AWS/Cloudflare/Duitku secrets in bundle | **NO** |
| `.env.production` gitignored | **PASS** (`git check-ignore`) |
| `.pem` / `.csv` keys tracked in git | **NO** |
| HTTPS homepage/app/API | **PASS** |
| Staging separation | **PASS** |

---

## Verification (executed)

```powershell
nslookup narraza.web.id 8.8.8.8
nslookup app.narraza.web.id 8.8.8.8
nslookup api.narraza.web.id 8.8.8.8
curl.exe -I https://narraza.web.id/
curl.exe -I https://app.narraza.web.id/
curl.exe -I https://app.narraza.web.id/login
curl.exe https://api.narraza.web.id/api/health
curl.exe https://api-staging.narraza.web.id/api/health
curl.exe -X OPTIONS https://api.narraza.web.id/api/health -H "Origin: https://app.narraza.web.id" ...
git check-ignore -v .env.production
npm run typecheck:web
npm run deploy:web:production   # LoginPage fix
npm run deploy:homepage:production   # SEO meta
```

---

## Files changed (Task 10.25)

| File | Change |
|---|---|
| `apps/web/src/pages/LoginPage.tsx` | **New** — production auth UI |
| `apps/web/src/routes/index.tsx` | `/login` route |
| `apps/web/src/routes/paths.ts` | `ROUTES.login` |
| `apps/homepage/index.html` | Canonical + Open Graph meta |

---

## Docs updated

- `docs/86-private-beta-launch-readiness-audit.md` (this file)
- `.agent-logs/sprint-10/task-10.25-private-beta-launch-readiness-audit.md`
- `README.md`, `docs/36`, `docs/63`, `docs/85`, `scripts/README.md`

---

## Remaining blockers

| Item | Severity | Action |
|---|---|---|
| Founder live auth smoke | **Gate** | Test register/login on production before inviting users |
| Supabase email confirmation | **Verify** | Disable or document confirm-email flow in prod Auth settings |
| `POST /api/projects` from UI | **Beta limitation** | Demo project paths only; not a payment blocker |
| App `/` landing still shows legacy VibeNovel brand | **P2 UX** | Rebrand or redirect `/` → `/login` in future sprint |
| Production payment | **BLOCKED** | Founder approval — docs/73 |

---

## Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | Infra live; user path unblocked; payment off; no staging leak; security pass; auth UI deployed |

---

## Next recommended task

1. **Founder:** Run production auth smoke on `https://app.narraza.web.id/login` with controlled beta test account; confirm Supabase Auth settings.
2. **Optional product:** Wire `POST /api/projects` from `/start` or redirect app `/` to `/login` for cleaner beta onboarding.
3. **Do not** enable payment, `00010`, or Duitku production without explicit approval.

**Stop rule honored:** No payment, migration, Duitku prod, callback, or live payment changes.