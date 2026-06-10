# Task 10.26 — Replace Dummy Workflow with Real Private Beta Story Flow

## Task goal

Remove the private-beta blocker where production dashboard/start still routed founders through `DEMO_PROJECT_ID` mock paths. Wire minimal real workflow: login → dashboard → create/list real project → intake persistence → honest AI-disabled UI. No payment, migration `00010`, Duitku production, or silent AI enablement.

## Files read

- `docs/86-private-beta-launch-readiness-audit.md`
- `docs/85-production-homepage-placeholder-report.md`
- `docs/84-production-app-custom-domain-verify-report.md`
- `docs/83-production-ec2-api-mode-a-deploy-report.md`
- `docs/79-production-supabase-baseline-setup-report.md`
- `docs/63-updated-product-roadmap-after-sprint-11.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `README.md`
- `.agents/rules/09-agent-work-logs.md`
- `apps/web/src/pages/StartProjectPage.tsx`, `DashboardPage.tsx`
- `apps/web/src/hooks/useDashboardData.ts`, `useIntakeData.ts`, `useWriteRoomData.ts`, `useConceptsData.ts`, `useFoundationData.ts`
- `apps/web/src/services/projects.ts`, `intake.ts`, `credits.ts`, `ai.ts`
- `apps/api/src/routes/projects.ts`, `intake.ts`, `concepts.ts`, `ai.ts`
- `apps/api/src/services/project.ts`, `intake.ts`, `concept.ts`, `model-router.ts`
- `packages/shared/src/enums.ts`
- `.env.production.example`

## Files created/changed

| Path | Note |
|---|---|
| `apps/web/src/services/projects.ts` | `createProject`, `fetchProjects(includeArchived)` |
| `apps/web/src/config/startProjectOptions.ts` | Entry option defs + route resolver |
| `apps/web/src/hooks/useActiveProject.ts` | Sidebar active project lookup |
| `apps/web/src/hooks/useDashboardData.ts` | Real empty state; no mock fallback when authed |
| `apps/web/src/hooks/useWriteRoomData.ts` | Honest `aiGenerationEnabled=false` UI message |
| `apps/web/src/pages/StartProjectPage.tsx` | `POST /api/projects` on entry click |
| `apps/web/src/pages/DashboardPage.tsx` | `NoActiveProjectCard` when empty |
| `apps/web/src/components/dashboard/NoActiveProjectCard.tsx` | Private-beta empty state |
| `apps/web/src/components/dashboard/index.ts` | Export |
| `apps/web/src/components/start-project/EntryOptionCard.tsx` | Button + create flow |
| `apps/web/src/components/layout/Sidebar.tsx` | Real active project nav |
| `apps/web/src/components/layout/NavItem.tsx` | Disabled state |
| `apps/web/src/utils/navigation.ts` | `buildSidebarNavItems(projectId)` |
| `apps/web/src/mocks/startProject.ts` | Demo routes only; re-export config |
| `apps/web/src/services/credits.ts` | `aiGenerationEnabled` in health flags |
| `docs/87-real-private-beta-story-flow-report.md` | Sprint report |
| `docs/36`, `docs/63`, `docs/86`, `README.md` | Status updates |

## Commands run

```powershell
npm run typecheck                    # PASS
npm run build:web:production         # PASS
npm run deploy:web:production        # PASS (bundle index-Bh8UjhTP.js)
Invoke-WebRequest https://narraza.web.id           # 200
Invoke-WebRequest https://app.narraza.web.id        # 200
Invoke-WebRequest https://app.narraza.web.id/login  # 200
Invoke-WebRequest https://api.narraza.web.id/api/health       # PASS Mode A
Invoke-WebRequest https://api-staging.narraza.web.id/api/health # PASS Mode A
rg staging leakage on apps/web/dist   # 0 hits api-staging / staging supabase ref
```

**Not run:** Live founder register/login → create project → intake save E2E (no test credentials in repo).

## Results

| Check | Result |
|---|---|
| Typecheck | **PASS** |
| Production web build + deploy | **PASS** |
| Homepage / app / login HTTP | **200** |
| Production + staging API health | **PASS** (`aiGenerationEnabled=false`, `creditTopupEnabled=false`) |
| Staging leakage in production bundle | **PASS** (0 hits) |
| Payment OFF | **PASS** |
| Migration 00010 | **NOT applied** (unchanged) |
| AI production enablement | **NOT changed** (`AI_GENERATION_ENABLED` untouched) |
| Founder live create/intake E2E | **Not run** — founder smoke required |

**Task status:** **PARTIAL GO**

## Decisions

1. **MVP real path:** `POST /api/projects` from `/start` → navigate to real `/projects/:id/intake` (or outline/summary per entry). Intake uses API stub agent (no OpenRouter); messages persist to `intake_sessions` / `intake_messages`.
2. **Dashboard:** Authenticated empty list shows `NoActiveProjectCard` — no mock fallback masking empty API state.
3. **Sidebar:** Project-scoped nav uses active project id; disabled links when no project (production). Demo mode (`VITE_USE_MOCKS=true`) keeps labeled demo paths.
4. **Concept generation:** Template drafts in `concept.ts` — not gated by `AI_GENERATION_ENABLED`; available after intake without AI approval.
5. **OpenRouter prose/rewrite/publish AI:** Remains off; UI reads `/api/health` → `aiGenerationEnabled` and shows *"AI generation belum aktif di lingkungan ini."*
6. **Founder AI test mode:** Documented as separate approval gate — `APPROVE TASK 10.26 AI FOUNDER TEST MODE ONLY` (not activated).

## Limitations

- Founder live E2E (create project + intake message round-trip) not executed by agent.
- Outline/foundation/write/summary/publish still show mock fallback on API errors — not removed entirely.
- `CreditIndicator` in header still uses shell mock defaults (non-blocking).
- Second+ projects created with `isActive=false` appear in dashboard via `includeArchived=true` but sidebar picks `isActive` project only.

## Next recommended task

**Task 10.26b (founder smoke):** Founder signs in at `https://app.narraza.web.id/login` → Buat Proyek Baru → send intake message → reload page → confirm message persisted. Optional: generate concepts (template) without enabling OpenRouter AI.