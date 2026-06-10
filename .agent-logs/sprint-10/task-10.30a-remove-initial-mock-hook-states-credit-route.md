# Task 10.30a — Remove Initial Mock Hook States + Wire Credit Indicator + Route Alignment

## Task goal
Implement Phase 0 fixes to stop faked visual content loading, ensure honest layout rendering of credit indicators, dynamically route ActiveProjectCard CTAs according to workflow phase, and gate all Playwright testing overrides securely.

## Files read
- `apps/web/src/lib/env.ts`
- `apps/web/src/lib/workflow-truth.ts`
- `apps/web/src/components/dashboard/ActiveProjectCard.tsx`
- `apps/web/src/components/layout/CreditIndicator.tsx`
- `apps/web/src/hooks/useCreditBalance.ts`
- `apps/web/src/hooks/useDashboardData.ts`
- `apps/web/src/hooks/useIntakeData.ts`
- `apps/web/src/hooks/useConceptsData.ts`
- `apps/web/src/hooks/useFoundationData.ts`
- `apps/web/src/hooks/useFoundationFlow.ts`
- `apps/web/src/hooks/useOutlineData.ts`
- `apps/web/src/hooks/useWriteRoomData.ts`
- `apps/web/src/hooks/useSummaryData.ts`
- `apps/web/src/hooks/usePublishData.ts`
- `apps/web/src/hooks/useSettingsData.ts`
- `apps/web/src/hooks/useActiveProject.ts`

## Files created/changed
### Created
- `.agent-logs/sprint-10/task-10.30a-remove-initial-mock-hook-states-credit-route.md`
- `apps/web/src/hooks/useCreditBalance.ts`
- `apps/web/e2e/sprint10a-mock-boundary-regression.spec.ts`
- `docs/93-remove-initial-mock-hook-states-credit-route-report.md`

### Modified
- `apps/web/src/lib/env.ts`
- `apps/web/src/lib/workflow-truth.ts`
- `apps/web/src/components/dashboard/ActiveProjectCard.tsx`
- `apps/web/src/components/layout/CreditIndicator.tsx`
- `apps/web/src/hooks/useDashboardData.ts`
- `apps/web/src/hooks/useIntakeData.ts`
- `apps/web/src/hooks/useConceptsData.ts`
- `apps/web/src/hooks/useFoundationData.ts`
- `apps/web/src/hooks/useFoundationFlow.ts`
- `apps/web/src/hooks/useOutlineData.ts`
- `apps/web/src/hooks/useWriteRoomData.ts`
- `apps/web/src/hooks/useSummaryData.ts`
- `apps/web/src/hooks/usePublishData.ts`
- `apps/web/src/hooks/useSettingsData.ts`
- `apps/web/src/hooks/useActiveProject.ts`
- `apps/web/src/lib/api-mappers.ts`
- `apps/web/src/mocks/dashboard.ts`
- `docs/91-remove-misleading-mock-flow-report.md`
- `README.md`

## Commands run
- `npm run typecheck`
- `npx playwright test apps/web/e2e/sprint10a-mock-boundary-regression.spec.ts` (Smoke & regression testing verification)

## Results
- **Mock Gating Safety:** Playwright test override `window.__MOCK_OVERRIDE__` is gated dynamically. It is now only functional if `import.meta.env.MODE === 'test'` or `import.meta.env.DEV`, preventing any browser-level override/injection of mock behavior in live production environments.
- **Initial State Cleanup:** Cleaned all 11 hooks (`useDashboardData`, `useIntakeData`, etc.) to initialize with genuinely empty structure (e.g. `null` or empty arrays/strings) instead of Sprint 1 mock templates, eliminating initial visual faking/leakage before API data resolves.
- **Live Credit Indicator:** Replaced layout header `SHELL_MOCK` credits with a real fetch hook (`useCreditBalance`) calling the user profile API `/api/users/profile`. Implemented error, loading, and zero-balance states without mock fallback.
- **Workflow-Aware Routing:** ActiveProjectCard CTA resolves dynamically based on the project's current `workflowPhase` via `resolveActiveProjectCta(project)`.
- **E2E Regression Coverage:** Created a dedicated spec `sprint10a-mock-boundary-regression.spec.ts` asserting all conditions (loading, gating, routing, and credit layout values) under both mock and API environments.

## Decisions
- Ensured absolute unauthenticated safety (handled case where `useCreditBalance` or navigation is invoked without active user session by returning `0` or null gracefully without crashes).
- Set testing port overrides dynamically in E2E configuration to prevent collisions on port 5173.

## Limitations
- Did not touch backend databases, payment provider modules (Duitku/Mayar sandbox), or apply DB migration `00010`.

## Next recommended task
Align backend generator stubs to invoke genuine AI models (Phase 1 & Phase 2 roadmap items).
