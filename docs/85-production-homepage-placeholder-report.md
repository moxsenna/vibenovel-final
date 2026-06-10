# 85 — Production Homepage on narraza.web.id (Task 10.24)

**Date:** 2026-06-10  
**Status:** **GO** — apex `narraza.web.id` live; homepage/app/API separation verified  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/84`](84-production-app-custom-domain-verify-report.md), [`docs/82`](82-production-infra-unblock-report.md), [`.agent-logs/sprint-10/task-10.24-production-homepage-placeholder.md`](../.agent-logs/sprint-10/task-10.24-production-homepage-placeholder.md)

Task 10.24 creates and deploys a production marketing homepage (Option B — separate Pages project). **Payment NOT enabled.** **Migration `00010` NOT applied.**

**Rerun (apex DNS):** Founder added proxied CNAME `@` → `narraza-homepage-production.pages.dev`. Verification **GO**.

---

## Final summary

```txt
Task 10.24 — Production Homepage on narraza.web.id
Status: GO

https://narraza.web.id — HTTP 200 (static landing)
https://app.narraza.web.id — HTTP 200 (dashboard, unchanged)
https://api.narraza.web.id/api/health — Mode A PASS
Staging regression — PASS
Payment: OFF | 00010: NOT APPLIED
```

---

## DNS (rerun verification)

| Host | `nslookup` via `8.8.8.8` | Result |
|---|---|---|
| `narraza.web.id` | **PASS** | Cloudflare proxied — `104.21.22.85`, `172.67.203.191` (+ IPv6) |
| `app.narraza.web.id` | **PASS** | Cloudflare proxied (unchanged) |
| `api.narraza.web.id` | **PASS** | `13.251.228.117` (production EIP) |

**Founder DNS record:** CNAME `@` → `narraza-homepage-production.pages.dev` (proxied).

---

## Deployment

| Item | Value |
|---|---|
| **Pages project** | `narraza-homepage-production` (separate from `narraza-web-production` app) |
| **Deploy path** | `apps/homepage/dist` |
| **Live URL** | `https://narraza.web.id` |
| **Preview URL** | `https://narraza-homepage-production.pages.dev` |
| **App project (untouched)** | `narraza-web-production` → `app.narraza.web.id` |

---

## Homepage

### HTTP

| URL | Status |
|---|---|
| `https://narraza.web.id/` | **200** |
| `https://narraza-homepage-production.pages.dev/` | **200** |

### Content & separation

| Check | Result |
|---|---|
| Static landing (not dashboard) | **PASS** — no `index-CCUIgaLV.js` on apex |
| Approved copy present | **PASS** — Hero, Problem, Solution, Workflow, Audience, Status, CTA, Footer |
| CTA → `https://app.narraza.web.id` | **PASS** |
| CTA → `https://app.narraza.web.id/login` | **PASS** |
| Dashboard bundle on apex | **NO** |

### Design (initial deploy)

- UI/UX Pro Max Skill: hero-centric SaaS, Soft UI, mobile-first, SVG icons, a11y
- Brand tokens from `stitch-reference/design_system.md`
- Static HTML/CSS in `apps/homepage/`

---

## App / API regression

### Production app

| URL | Status |
|---|---|
| `https://app.narraza.web.id/` | **200** — dashboard SPA (`index-CCUIgaLV.js`) |

### Production API — `https://api.narraza.web.id/api/health`

| Flag | Value |
|---|---|
| `appEnv` | `production` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

**PASS** — Mode A unchanged.

### Staging — `https://api-staging.narraza.web.id/api/health`

| Flag | Value |
|---|---|
| `appEnv` | `staging` |
| Mode A flags | Unchanged |

**PASS** — staging not touched.

---

## Security

| Item | Result |
|---|---|
| Payment enabled | **NO** |
| Migration `00010` | **NOT applied** |
| Duitku production | **NOT setup** |
| Callback registered | **NO** |
| Secrets exposed | **NO** |
| Staging DB touched | **NO** |

---

## Domain model (closed)

| Role | URL | Status |
|---|---|---|
| Homepage / landing | `https://narraza.web.id` | **GO** |
| App / dashboard | `https://app.narraza.web.id` | **GO** |
| API | `https://api.narraza.web.id` | **GO** Mode A |

---

## Files changed (Task 10.24)

| File | Change |
|---|---|
| `apps/homepage/index.html` | Production landing page |
| `apps/homepage/styles.css` | Landing styles |
| `scripts/build-production-homepage.ps1` | Build dist |
| `scripts/operator-production-homepage-deploy.ps1` | Deploy + verify |
| `scripts/lib/attach-pages-domain.ps1` | Pages domain API helper |
| `package.json` | `build:homepage:production`, `deploy:homepage:production` |

---

## Docs updated

- `docs/85-production-homepage-placeholder-report.md` (this file)
- `.agent-logs/sprint-10/task-10.24-production-homepage-placeholder.md`
- `README.md`, `docs/36`, `docs/63`, `scripts/README.md`

---

## Remaining blockers

| Item | Status |
|---|---|
| Production payment | **BLOCKED** — founder approval ([`docs/73`](73-duitku-production-payment-enable-plan.md)) |
| Production migration `00010` | **BLOCKED** — [`docs/77`](77-production-payment-preflight-migration-approval-gate.md) |

---

## Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | Apex homepage live; separation verified; app/API/staging regression PASS |

---

## Next recommended task

**Task 10.25 complete** — [`docs/86`](86-private-beta-launch-readiness-audit.md): private beta readiness **GO** (payment-off). Founder auth smoke on `https://app.narraza.web.id/login` before inviting users.

**Stop rule:** No payment, `00010`, Duitku production, callback, or live payment without founder approval.