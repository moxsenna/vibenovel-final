# 84 — Production App Custom Domain Verify (Task 10.23c)

**Date:** 2026-06-10  
**Status:** **GO** — `app.narraza.web.id` live; production API wiring verified; Mode A path closed  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/83`](83-production-ec2-api-mode-a-deploy-report.md), [`docs/82`](82-production-infra-unblock-report.md), [`docs/81`](81-production-api-web-mode-a-deploy-report.md), [`.agent-logs/sprint-10/task-10.23c-production-app-custom-domain-verify.md`](../.agent-logs/sprint-10/task-10.23c-production-app-custom-domain-verify.md)

Task 10.23c verifies production app custom domain `https://app.narraza.web.id` and closes the production API/app Mode A deployment path. **Payment NOT enabled.** **Migration `00010` NOT applied.** **No Duitku production setup.**

---

## Final summary

```txt
Task 10.23c — Verify Production App Custom Domain
Status: GO

app.narraza.web.id: HTTP 200, bundles load, production API wired
api.narraza.web.id: Mode A PASS
Staging regression: PASS Mode A
Root narraza.web.id: homepage pending (no accidental dashboard)
Payment: OFF | 00010: NOT APPLIED
```

---

## DNS

| Host | `nslookup` via `8.8.8.8` | Result |
|---|---|---|
| `app.narraza.web.id` | **PASS** | Cloudflare proxied — `104.21.22.85`, `172.67.203.191` (+ IPv6) |
| `api.narraza.web.id` | **PASS** | `13.251.228.117` (production EIP) |
| `api-staging.narraza.web.id` | **PASS** | `13.212.245.32` (unchanged) |
| `narraza.web.id` (apex) | **Pending** | Name exists; no A/AAAA answer — homepage not configured (expected) |

---

## App domain

### HTTP

| URL | Status |
|---|---|
| `https://app.narraza.web.id/` | **200** |
| `https://app.narraza.web.id/login` | **200** (SPA shell) |
| `https://app.narraza.web.id/dashboard` | **200** (SPA shell) |
| `https://app.narraza.web.id/assets/index-CCUIgaLV.js` | **200** (658,841 bytes) |
| `https://app.narraza.web.id/assets/index-u6ZJoxD9.css` | **200** |

- HTML loads with Vite production bundle references.
- No Cloudflare Pages error page observed.
- No redirect to staging URL (`vibenovel-web-staging.pages.dev`).

### Bundle / env / API URL

Live bundle scan (`index-CCUIgaLV.js`):

| Pattern | Count | Verdict |
|---|---|---|
| `api.narraza.web.id` | 1 | **PASS** — baked as `https://api.narraza.web.id` |
| `api-staging.narraza.web.id` | 0 | **PASS** |
| `vibenovel-web-staging.pages.dev` | 0 | **PASS** |
| `jdxyhrnibmmwlbtbokqo` (staging Supabase) | 0 | **PASS** |
| `localhost` | 3 | **Acceptable** — Supabase auth-js WebAuthn domain helper only |
| `127.0.0.1` | 2 | **Acceptable** — Vite env fallback string in minified `getApiUrl()` + Supabase storage allowlist; **not** active API endpoint |

Production API URL context in bundle:

```txt
function Gy(){return"https://api.narraza.web.id".trim()||"http://127.0.0.1:8787"}
```

App calls production API, not staging.

### Browser-safe smoke (HTTP-level)

| Check | Result |
|---|---|
| App shell (`#root` + JS/CSS) | **PASS** |
| `/login` route | **PASS** — SPA returns shell |
| `/dashboard` route | **PASS** — SPA returns shell (auth gate client-side) |
| Blank screen risk from missing env | **Low** — Supabase + API URL present in bundle |
| Staging API calls | **None detected** in bundle |

Full Playwright E2E against production not run (out of scope); HTTP + bundle audit sufficient for Mode A gate.

---

## API health

### Production — `https://api.narraza.web.id/api/health`

| Flag | Value |
|---|---|
| `ok` | `true` |
| `appEnv` | `production` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

**PASS** — Mode A safe.

### Staging — `https://api-staging.narraza.web.id/api/health`

| Flag | Value |
|---|---|
| `ok` | `true` |
| `appEnv` | `staging` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

**PASS** — Mode A unchanged; staging DB/EC2 not touched.

---

## Root domain

| Check | Result |
|---|---|
| `https://narraza.web.id/` | **NXDOMAIN** / not resolvable from verifier host |
| Dashboard on apex | **NO** — apex has no DNS answer; app only on `app.` subdomain |
| Status | **Pending** — dedicated homepage/landing per [`docs/82`](82-production-infra-unblock-report.md) Option A; **not a failure** |

---

## Security

| Item | Result |
|---|---|
| Payment enabled | **NO** |
| Migration `00010` on production | **NOT applied** |
| Duitku production | **NOT setup** |
| Callback registered (production) | **NO** |
| Secrets exposed in report/logs | **NO** |
| Staging DB touched | **NO** |

---

## Files changed

| File | Change |
|---|---|
| `docs/84-production-app-custom-domain-verify-report.md` | **Created** — this report |
| `.agent-logs/sprint-10/task-10.23c-production-app-custom-domain-verify.md` | **Created** — agent work log |
| `agent-tools/task-10.23c-bundle-audit.ps1` | **Created** — verification helper (local only) |
| `README.md` | Updated — Task 10.23c GO; production URLs |
| `docs/36`, `docs/63`, `docs/81`–`docs/83` | Updated — closure cross-refs |
| `scripts/README.md` | Updated — 10.23c verification note |

---

## Docs updated

- [`docs/84`](84-production-app-custom-domain-verify-report.md) (this file)
- [`README.md`](../README.md)
- [`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`docs/63`](63-updated-product-roadmap-after-sprint-11.md)
- [`docs/81`](81-production-api-web-mode-a-deploy-report.md)
- [`docs/82`](82-production-infra-unblock-report.md)
- [`docs/83`](83-production-ec2-api-mode-a-deploy-report.md)
- [`scripts/README.md`](../scripts/README.md)

---

## Remaining blockers

| Item | Status |
|---|---|
| Apex homepage `narraza.web.id` | **Pending** — non-blocking for Mode A app/API |
| Production payment | **BLOCKED** — founder approval + [`docs/73`](73-duitku-production-payment-enable-plan.md) |
| Production migration `00010` | **BLOCKED** — [`docs/77`](77-production-payment-preflight-migration-approval-gate.md) |
| Duitku production callback | **NOT registered** — by design |

---

## Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | App custom domain live; bundles load; production API wired; staging regression PASS; payment OFF; apex not serving dashboard |

---

## Next recommended task

**Task 10.24** — [`docs/85`](85-production-homepage-placeholder-report.md): homepage **GO** on `narraza.web.id`.

**Do not** without separate founder approval: enable payment, apply `00010` on production, Duitku production setup, callback registration, or live payment test.