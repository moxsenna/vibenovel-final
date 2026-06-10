# Sprint 10a — Remove Initial Mock Hook States, Live Credit Indicator, and CTA Route Alignment

## 1. Goal & Objectives
This report documents the implementation of Phase 0 of the Structural Repo Audit (Task 10.30a). The objective was to eliminate faked data and mock visual states from the production application, establishing clean, honest interfaces that retrieve and render live state.

Key achievements:
- **Zero Mock State Leaks:** Replaced all hardcoded Sprint 1 initial React states with genuinely empty/null structures, preventing mock content from flickering on load.
- **Client Security Guard:** Safe-gated Playwright testing overrides (`window.__MOCK_OVERRIDE__`) to dev and test environments only.
- **Live User Balance:** Wired the layout header's `CreditIndicator` component to retrieve live authenticated credits from the API.
- **Workflow-Aware Navigation:** Integrated a dynamic route resolver into the dashboard `ActiveProjectCard` CTA.
- **Regression Suite:** Added E2E tests validating the mock boundaries, credit indicator display, and dynamic CTA routes.

---

## 2. Security Guard: Playwright Override Gating
The testing utility `window.__MOCK_OVERRIDE__` is used in Playwright tests to force mock mode on the frontend. To prevent any malicious script or user from forcing mocks/altering app behavior in production, the guard has been hardened:

```typescript
// apps/web/src/lib/env.ts
const isDevOrTest = import.meta.env.MODE === 'test' || import.meta.env.DEV;

export function shouldRunInMockMode(): boolean {
  if (!isDevOrTest) {
    return false; // Force false in production - ignores all overrides
  }
  
  if (typeof window !== 'undefined' && (window as any).__MOCK_OVERRIDE__ !== undefined) {
    return !!(window as any).__MOCK_OVERRIDE__;
  }
  
  return import.meta.env.VITE_USE_MOCKS === 'true';
}
```

---

## 3. Audited React Hooks (Before & After)

Below is the summary of audited and cleaned React hooks. They now initialize with clean, empty states instead of mock templates:

| Hook File | Before (Sprint 1 Initial Mock State) | After (Clean Initial State / Dynamic Fetch) |
| :--- | :--- | :--- |
| `useDashboardData` | Pre-populated lists of mock projects | Empty arrays `[]` |
| `useIntakeData` | Template book title, target audience, and synopsis | Empty strings and `null` fields |
| `useConceptsData` | Pre-filled mock story concept cards | Empty arrays `[]` and `null` selection |
| `useFoundationData` | Stubbed canon items, tone, structure, characters | Genuinely empty schema/data structures |
| `useFoundationFlow` | Hardcoded step progress & default mock foundation data | Initialized to default blank stages |
| `useOutlineData` | Predefined draft outline outline chapters (Chapter 1-3 stubs) | Clean outline state `null` / empty arrays |
| `useWriteRoomData` | Stubbed chapters, content prose drafts | Clean editor data structure |
| `useSummaryData` | Hardcoded chapter summaries & character canon mappings | Genuinely empty mapping records |
| `usePublishData` | Pre-filled title, book description, cover placeholders | Empty fields, pending status indicator |
| `useSettingsData` | Prepopulated profile settings | Empty default settings payload |
| `useActiveProject` | Static lookup returning a mock project | Queries local storage / API for active project and returns live workspace profile |

---

## 4. Live Credit Indicator Integration
The header's `CreditIndicator` component has been decoupled from the static mock `SHELL_MOCK.credits = 1.250`. 

- **Custom Hook:** Created a new reusable hook `useCreditBalance` to fetch user credit balances from `/api/users/profile`.
- **States Handled:**
  - **Loading:** Renders a subtle shimmer/loading indicator.
  - **Success:** Displays the real formatted credit balance (e.g., `1,250`).
  - **Error:** Renders `0` or hides safely (does not crash or show faked static values).
  - **Unauthenticated:** Hides the credit panel gracefully if no session exists.

---

## 5. Workflow-Aware Active Project Routing
Previously, clicking the CTA on the dashboard `ActiveProjectCard` always redirected to `/write`. We introduced `resolveActiveProjectCta(project)` to dynamically resolve the route and button text:

| Project `workflowPhase` | Routed Destination | Button Text |
| :--- | :--- | :--- |
| `intake` | `/intake` | "Continue Intake" |
| `concept` | `/concept` | "Refine Concept" |
| `foundation` | `/foundation` | "Build Foundation" |
| `outline` | `/outline` | "Structure Outline" |
| `write` | `/write` | "Enter Write Room" |
| `summary` | `/summary` | "Generate Summary" |
| `publish` | `/publish` | "Publish Novel" |
| *default/unknown* | `/intake` | "Continue Project" |

---

## 6. Regression Testing
Created Playwright test spec [sprint10a-mock-boundary-regression.spec.ts](file:///d:/Coding/vibenovel-unified-blueprint/apps/web/e2e/sprint10a-mock-boundary-regression.spec.ts) to verify the mock boundaries and routing logic:
1. **Mock Boundary Verification:** Validates that the application operates in API/mock mode correctly depending on the environmental state.
2. **Credit Indicator Balance:** Asserts that layout credit matches mock/API payloads dynamically.
3. **CTA Route Action:** Mocks different project phases (`concept`, `write`, `publish`) and verifies the card button redirects to the corresponding path.

Local execution of tests and typechecks successfully passed:
```bash
$ npm run typecheck
# All modules (shared, web, api) compile with zero errors.

$ npx playwright test apps/web/e2e/sprint10a-mock-boundary-regression.spec.ts
# 4/4 tests passed.
```

---

## 7. Deployment Status
- **Target URL:** `https://38b7552f.narraza-web-production.pages.dev`
- **Asset Status:** All routes, static layouts, and forms are live. Production build successfully ignored the test overrides, maintaining clean API bounds.
