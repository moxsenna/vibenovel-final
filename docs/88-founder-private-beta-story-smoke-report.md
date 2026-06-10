# 88 — Founder Private Beta Story Smoke (Task 10.26b)

**Date:** 2026-06-10  
**Status:** **GO** (founder re-smoke 2026-06-10 — all steps pass including Keluar)  
**Device:** Chrome, Acer Swift GO 14  
**Related:** [`docs/87`](87-real-private-beta-story-flow-report.md), [`.agent-logs/sprint-10/task-10.26b-founder-private-beta-story-smoke.md`](../.agent-logs/sprint-10/task-10.26b-founder-private-beta-story-smoke.md)

Founder manual smoke on production. **Payment OFF.** **Migration `00010` NOT applied.** **OpenRouter enabled for founder AI test (Task 10.28)** — see [`docs/90`](90-ai-founder-test-mode-report.md).

---

## Final summary

```txt
Task 10.26b — Founder Private Beta Story Smoke Verification
Status: GO

Founder verified: login → dashboard → create project → real UUID intake → reload persist → Keluar → login PASS
Task 10.26 + 10.26b closed for private-beta story onboarding
Task 10.28: production API redeployed — `aiGenerationEnabled=true`, `hasOpenRouterApiKey=true`; founder 50 test credits; one live prose beat GO
```

---

## Founder smoke

| Step | Classification | Notes |
|---|---|---|
| **login/register** | **PASS** | Founder confirmed |
| **dashboard** | **PASS** | Real data after auth |
| **create project** | **PASS** | `POST /api/projects` from `/start` |
| **real project ID** | **PASS** | UUID route, not `DEMO_PROJECT_ID` |
| **intake send** | **PASS** | Message sent via API |
| **reload persistence** | **PASS** | Project + messages survive reload |
| **logout/login persistence** | **PASS** | Founder confirmed after Keluar UI deploy |

**Root cause (logout):** `DevAuthPanel` (with Keluar) renders only in `import.meta.env.DEV`. Production shell had no sign-out control.

---

## Fixes applied

| Fix | File |
|---|---|
| Desktop **Keluar** in sidebar user footer | `apps/web/src/components/layout/Sidebar.tsx` |
| Mobile **Keluar** in top bar | `apps/web/src/components/layout/MobileHeader.tsx` |
| Redirect to `/login` after `signOut()` | Both components |
| Document `OPENROUTER_API_KEY` in production env example | `.env.production.example` |

**Deployed:** `npm run deploy:web:production` → bundle `index-D-0atp4z.js`

---

## Production regression

| Check | Result |
|---|---|
| `https://narraza.web.id` | **200** |
| `https://app.narraza.web.id` | **200** |
| `https://app.narraza.web.id/login` | **200** |
| Production API health Mode A | **PASS** — `aiGenerationEnabled=false`, `creditTopupEnabled=false`, `hasOpenRouterApiKey=false` |
| Staging API health Mode A | **PASS** |
| Staging API in production bundle | **0 hits** |
| `npm run typecheck` | **PASS** |

---

## Post Task 10.28 / 10.29 (AI founder test + browser E2E + mock-removal)

**Task 10.29 mock-removal (2026-06-10):** Authenticated production no longer shows Sprint 1 mock as user data — see [`docs/91-mock-flow`](91-remove-misleading-mock-flow-report.md). Write/foundation/outline for intake-only projects now show locked states.

| Check | Result |
|---|---|
| Production API AI | **ON** — [`docs/90`](90-ai-founder-test-mode-report.md) |
| Write Room UI AI | **GO** — [`docs/91`](91-founder-browser-e2e-story-workflow-report.md) |
| Founder credits | Seeded; write room shows real balance |
| Payment | **Still OFF** |

---

## Security (10.26b snapshot)

| Check | Result |
|---|---|
| Payment OFF | **PASS** |
| Migration 00010 | **NOT applied** |
| OpenRouter AI | **NOT enabled** (at 10.26b; enabled 10.28) |
| Secrets in frontend | **None** |
| Service role exposed | **No** |

---

## OpenRouter API key — where to put it

**Never** in `apps/web`, Cloudflare Pages env, or git.

| Environment | File / location |
|---|---|
| **Production API (EC2)** | `/opt/vibenovel/.env.production` on the API server — add `OPENROUTER_API_KEY=...` (see `.env.production.example`) |
| **Local dev API** | `apps/api/.dev.vars` (copy from `apps/api/.dev.vars.example`) |
| **Staging API (EC2)** | `/opt/vibenovel/.env.staging` |

**Also required before live AI works (founder approval only):**

```env
AI_GENERATION_ENABLED=true
AI_PROVIDER_MOCK=false
OPENROUTER_API_KEY=<your-key>
```

Then restart API: `docker compose -f docker-compose.production.yml up -d --build` (production EC2).

Seed founder credits manually. Use approval gate from [`docs/87`](87-real-private-beta-story-flow-report.md):

```txt
APPROVE TASK 10.26 AI FOUNDER TEST MODE ONLY
```

Health check after change: `GET https://api.narraza.web.id/api/health` → expect `hasOpenRouterApiKey=true` (boolean only, never the key value).

---

## Files changed

- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/MobileHeader.tsx`
- `.env.production.example`

---

## Docs updated

- `docs/88-founder-private-beta-story-smoke-report.md` (this file)
- `docs/87-real-private-beta-story-flow-report.md`
- `docs/86-private-beta-launch-readiness-audit.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/63-updated-product-roadmap-after-sprint-11.md`
- `README.md`

---

## Remaining blockers

1. **Founder re-smoke logout** — click **Keluar** (sidebar bawah / mobile header) → login lagi → confirm project + intake still visible.
2. **OpenRouter** — optional; separate approval; no action taken in this task.

---

## Next recommended task

- **Quick:** Founder logout/login re-smoke (5 min) → if PASS, Task 10.26b → **GO**.
- **Optional:** OpenRouter founder test mode (EC2 `.env.production` + credit seed) after explicit approval.
- **Product:** Invite first private-beta users once logout re-smoke PASS.