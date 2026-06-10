# 87 — Real Private Beta Story Flow (Task 10.26)

**Date:** 2026-06-10  
**Status:** **GO** (founder smoke Task 10.26b — core path verified; logout UI fixed separately)  
**Brand:** **Narraza**  
**Related:** [`docs/86`](86-private-beta-launch-readiness-audit.md), [`.agent-logs/sprint-10/task-10.26-real-private-beta-story-flow.md`](../.agent-logs/sprint-10/task-10.26-real-private-beta-story-flow.md)

Task 10.26 replaces misleading demo-only onboarding with a minimal **real** private-beta story path. **Payment NOT enabled.** **Migration `00010` NOT applied.** At Task 10.26 close, AI prose was OFF; **Task 10.28** enabled founder AI test — see [`docs/90`](90-ai-founder-test-mode-report.md).

---

## Final summary

```txt
Task 10.26 — Replace Dummy Workflow with Real Private Beta Story Flow
Status: GO

Real path: login → dashboard → POST /api/projects → /projects/:id/intake (persisted) — founder verified
AI prose: OFF (honest UI); concept/intake stubs work without OpenRouter
Logout UI gap fixed in Task 10.26b — see docs/88
```

---

## Dummy workflow audit

| Area | Route | Before | After Task 10.26 | Classification | Fix status |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Mock when empty API | Real list or empty state | **REAL** (authed) / mock (unauthed) | **SAFE TO FIX NOW** ✅ |
| Start / create | `/start` | All links → `DEMO_PROJECT_ID` | `POST /api/projects` → real id | **REAL** (authed) / demo (mocks) | **SAFE TO FIX NOW** ✅ |
| Intake | `/projects/:id/intake` | API ready; demo id remap | Real id + API persist; stub agent | **REAL** persistence | Already wired ✅ |
| Concepts | `/projects/:id/concepts` | API; no prod mock fallback (Task 10.29) | Template concept generation (no OpenRouter) | **REAL PARTIAL** | **DEFER** AI prose only |
| Foundation | `/projects/:id/foundation` | API; honest empty fields (Task 10.29) | API when authed | **REAL PARTIAL** | Partial |
| Outline | `/projects/:id/outline` | API; honest empty/locked (Task 10.29) | API when authed | **REAL PARTIAL** | Partial |
| Write room | `/projects/:id/write` | Manual save real; AI gated | AI shows disabled when `aiGenerationEnabled=false` | **MIXED** | AI **BLOCKED** |
| Summary | `/projects/:id/summary` | Locked until write ready (Task 10.29) | API when authed | **LOCKED / PARTIAL** | Partial |
| Publish | `/projects/:id/publish` | Locked in beta nav; no prod mock (Task 10.29) | API load; copy AI off | **LOCKED / PARTIAL** | AI **BLOCKED** |
| Settings | `/settings` | API when authed | Unchanged | **REAL** / mock | OK |
| Credits / topup | `/credits/topup` | Disabled UI | Unchanged (`creditTopupEnabled=false`) | **BLOCKED** (payment) | By design |
| Sidebar nav | shell | Hardcoded `DEMO_PROJECT_ID` | Active project id or disabled | **REAL** | **SAFE TO FIX NOW** ✅ |

**Key files (pre-change offenders):**

- `apps/web/src/mocks/startProject.ts` — demo routes
- ~~`apps/web/src/hooks/useDashboardData.ts` — mock fallback on empty API~~ **Addressed Task 10.29** — [`docs/91-mock-flow`](91-remove-misleading-mock-flow-report.md)
- `apps/web/src/utils/navigation.ts` / `Sidebar.tsx` — `DEMO_PROJECT_ID` sidebar

---

## Real flow implemented

| Step | Status |
|---|---|
| **auth** | Login/register at `/login`; session via Supabase + `AuthContext` |
| **dashboard** | `GET /api/projects?includeArchived=true`; empty → `NoActiveProjectCard` |
| **create project** | `/start` entry cards → `POST /api/projects` with `entryPath` |
| **project detail** | Navigate to `/projects/{realUuid}/intake|outline|summary` |
| **intake / story seed** | `POST /api/projects/:id/intake/messages` persists user + stub agent reply |
| **generation** | Template concepts (`POST .../concepts/generate`) — **no OpenRouter**. Prose/rewrite/publish AI **off** |

---

## Generation readiness

| Item | Value |
|---|---|
| **current env** | Production `aiGenerationEnabled=false`, `hasOpenRouterApiKey=false`, `creditTopupEnabled=false` |
| **provider keys** | `OPENROUTER_API_KEY` not configured in production |
| **credit requirement** | Prose/rewrite/publish AI debit via `credit-ledger.ts` when enabled; intake/concepts use stubs/templates |
| **depends on 00010** | **No** — atomic grant RPC not required for generation |
| **depends on payment** | **No** for generation; credits can be seeded manually |
| **safe AI test mode** | **Proposed, NOT activated** — see approval gate below |
| **decision** | **E** for OpenRouter prose (remain off; real project/intake shipped). **A‑like** for template concepts/intake (safe without AI flag) |

### Approval gate — **ACTIVATED (Task 10.28)**

```txt
APPROVE TASK 10.26 AI FOUNDER TEST MODE ONLY
```

**Status:** Activated 2026-06-10 — see [`docs/90`](90-ai-founder-test-mode-report.md), [`docs/91`](91-founder-browser-e2e-story-workflow-report.md). Production API + Write Room UI AI verified; payment remains OFF.

Requires explicit founder approval before:

1. Set production `AI_GENERATION_ENABLED=true` on EC2 API only
2. Set `OPENROUTER_API_KEY` (server-side only)
3. Seed founder account credits via operator SQL / admin path
4. Optionally restrict to founder user id / email allowlist (future hardening)
5. Test one endpoint: `POST /api/projects/:id/ai/generate-prose`
6. Revert `AI_GENERATION_ENABLED=false` after test if desired

**Payment remains OFF.** **No Duitku.** **No migration 00010.**

---

## Production verification

| Check | Result |
|---|---|
| `https://narraza.web.id` | **200** |
| `https://app.narraza.web.id` | **200** |
| `https://app.narraza.web.id/login` | **200** |
| `https://api.narraza.web.id/api/health` | **PASS** Mode A |
| `https://api-staging.narraza.web.id/api/health` | **PASS** Mode A |
| Staging URL in production bundle | **0 hits** |
| Staging Supabase ref in bundle | **0 hits** |
| `npm run typecheck` | **PASS** |
| `npm run build:web:production` | **PASS** |
| `npm run deploy:web:production` | **PASS** — `index-Bh8UjhTP.js` |
| Founder create project E2E | **Not run** (no credentials in repo) |

---

## Payment / security

| Check | Result |
|---|---|
| `creditTopupEnabled` | **false** |
| `paymentProvider` | **mock** |
| Migration `00010` | **NOT applied** |
| Duitku production | **NOT setup** |
| Secrets in bundle | **None** |
| Service role exposed | **No** |

---

## Files changed

- `apps/web/src/services/projects.ts`
- `apps/web/src/config/startProjectOptions.ts`
- `apps/web/src/hooks/useActiveProject.ts`
- `apps/web/src/hooks/useDashboardData.ts`
- `apps/web/src/hooks/useWriteRoomData.ts`
- `apps/web/src/pages/StartProjectPage.tsx`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/components/dashboard/NoActiveProjectCard.tsx`
- `apps/web/src/components/dashboard/index.ts`
- `apps/web/src/components/start-project/EntryOptionCard.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/NavItem.tsx`
- `apps/web/src/utils/navigation.ts`
- `apps/web/src/mocks/startProject.ts`
- `apps/web/src/services/credits.ts`

---

## Docs updated

- `docs/87-real-private-beta-story-flow-report.md` (this file)
- `docs/86-private-beta-launch-readiness-audit.md`
- `docs/63-updated-product-roadmap-after-sprint-11.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `README.md`
- `.agent-logs/sprint-10/task-10.26-real-private-beta-story-flow.md`

---

## Remaining blockers

1. **Founder live smoke** — register/login → create project → intake message persists (required before inviting beta users).
2. **OpenRouter AI** — intentionally off; needs separate approval gate above.
3. **Workflow pages** — foundation/outline/write/summary/publish still fall back to mock on API errors (non-blocking if API healthy).
4. **Header credit indicator** — still shell mock; real balance shown on write/settings paths.

---

## Next recommended task

**Task 10.26b — Founder private-beta story smoke:** Execute live E2E on production (create project, intake save, optional template concept generate). If PASS → invite first beta testers. AI prose enablement remains gated behind `APPROVE TASK 10.26 AI FOUNDER TEST MODE ONLY`.