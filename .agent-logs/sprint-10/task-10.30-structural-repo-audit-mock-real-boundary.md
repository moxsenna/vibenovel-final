# Task 10.30 — Structural Repo Audit: Mock Leakage, Real Workflow Boundary, and Repair Plan

## Task goal
Audit the entire repository to find why the production app Narraza still behaves/feels like a mock or technical demo, design a clean mock boundary for frontend pages/hooks, check workflowPhase computations and API/DB coverage, and output a detailed repair roadmap.

## Files read
- `README.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/61-roadmap-and-sprint-number-reconciliation.md`
- `docs/63-updated-product-roadmap-after-sprint-11.md`
- `docs/89-full-repo-audit-vs-sprint-plan.md`
- `docs/90-ai-founder-test-mode-report.md`
- `docs/91-remove-misleading-mock-flow-report.md`
- `apps/web/src/hooks/*Data.ts` (especially `useConceptsData.ts`, `useFoundationData.ts`, `useOutlineData.ts`, `useDashboardData.ts`, `useIntakeData.ts`, `useActiveProject.ts`)
- `apps/web/src/components/layout/CreditIndicator.tsx`
- `apps/web/src/components/dashboard/ActiveProjectCard.tsx`
- `apps/web/src/lib/api-mappers.ts`
- `apps/web/src/lib/workflow-truth.ts`
- `apps/api/src/routes/concepts.ts`
- `apps/api/src/services/concept.ts`
- `apps/api/src/services/outline-generator.ts`
- `apps/api/src/services/prose-beat-generation.ts`
- `apps/api/src/services/model-router.ts`

## Files created/changed
- `docs/92-structural-repo-audit-mock-real-boundary.md` (created)
- `.agent-logs/sprint-10/task-10.30-structural-repo-audit-mock-real-boundary.md` (created)

## Commands run
- `git status`
- `git status -s`
- `git diff --name-status`
- Grep queries for mock text patterns and hooks state definitions.

## Results
- **Mocks Initial State (Severe):** All web hooks initialize React state with Sprint 1 mock templates (e.g. `mockOutline` in `useOutlineData`). This leaks mock data into authed API views during the loading phase.
- **Hardcoded Credits (Medium-High):** Layout header `CreditIndicator` defaults to display `1250` credits instead of fetching user balance.
- **Stub API Generators (Medium):** Outline and concept generation APIs return deterministic templates instead of querying live models.
- **CTA Routing mismatch (Medium):** ActiveProjectCard defaults to `/write` route instead of routing dynamic phases.
- **Workspace State:** Clean. All previous local changes successfully staged, committed, and pushed to remote branch `main`.

## Decisions
- Audit and repair plan completed without performing code modifications or deployment, adhering to the Task 10.30 stop rule.
- Gating checks (payment, Duitku, migration `00010`) remain unapplied on production.

## Limitations
- No changes made to production resources.
- Gaps in automated validator suite remain deferred to Phase D of roadmap.

## Next recommended task
**Task 10.30a — Remove Initial Mock Hook States + Wire Credit Indicator + Route Alignment**
Implement Phase 0 fixes to stop faked visual content loading and ensure honest layout rendering.
