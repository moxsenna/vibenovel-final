# Global Credit Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated web credit-balance state with one server-authoritative React Context so the header and all existing balance displays update immediately after paid actions without a page reload.

**Architecture:** Mount a native `CreditProvider` below `AuthProvider`, store the complete shared `CreditBalance`, and expose `refresh()` plus `applyServerBalance()`. Paid mutations apply complete server responses synchronously or refresh when a response has no balance. A monotonic revision and one in-flight promise prevent stale GET responses and duplicate refreshes.

**Tech Stack:** React 18 Context/hooks, TypeScript 5.6, Vite 5, Node `assert` contract tests via `tsx`, Playwright API-route mocks, npm workspaces.

---

## Scope guard

This is Approach B from the approved design:

- no API, database, pricing, ledger, or payment changes;
- no TanStack Query or other dependency;
- no optimistic client-side debit arithmetic;
- no polling or cross-tab synchronization;
- no new Foundation/Outline balance label;
- web-only production deployment after all gates pass.

The complete approved behavior is documented in
`docs/superpowers/specs/2026-06-20-global-credit-context-design.md`.

## Task 1: Build and test the pure credit-state transition module

**Files:**

- Create: `apps/web/src/context/credit-context-state.ts`
- Create: `apps/web/scripts/credit-context-state.test.mts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write the failing pure-state tests**

Create `apps/web/scripts/credit-context-state.test.mts` with fixtures for a
complete `CreditBalance` and assertions covering:

```ts
import assert from "node:assert/strict";
import type { CreditBalance } from "@vibenovel/shared";
import {
  applyCreditBalance,
  applyCreditRefreshError,
  applyCreditRefreshResult,
  beginCreditLoad,
  createEmptyCreditState,
  createMockCreditBalance,
} from "../src/context/credit-context-state.ts";

const serverBalance: CreditBalance = {
  id: "balance-1",
  userId: "user-1",
  balance: 8_000,
  monthlyQuota: 100_000,
  monthlyUsed: 2_000,
  resetAt: null,
  source: "admin_grant",
  updatedAt: "2026-06-20T10:00:00.000Z",
};

const empty = createEmptyCreditState();
assert.equal(empty.creditBalance, null);
assert.equal(empty.loading, false);
assert.equal(empty.refreshing, false);

const initialLoad = beginCreditLoad(empty, true);
assert.equal(initialLoad.loading, true);
assert.equal(initialLoad.refreshing, false);

const backgroundLoad = beginCreditLoad(
  { ...empty, creditBalance: serverBalance },
  false,
);
assert.equal(backgroundLoad.loading, false);
assert.equal(backgroundLoad.refreshing, true);
assert.equal(backgroundLoad.creditBalance?.balance, 8_000);

const applied = applyCreditBalance(empty, serverBalance, 2);
assert.equal(applied.creditBalance?.balance, 8_000);
assert.equal(applied.revision, 2);
assert.ok(applied.lastSyncedAt);

const stale = applyCreditRefreshResult(applied, {
  creditBalance: { ...serverBalance, balance: 10_000 },
  revisionAtStart: 1,
  committedRevision: 1,
});
assert.equal(stale.creditBalance?.balance, 8_000);

const refreshed = applyCreditRefreshResult(applied, {
  creditBalance: { ...serverBalance, balance: 7_500 },
  revisionAtStart: 2,
  committedRevision: 3,
});
assert.equal(refreshed.creditBalance?.balance, 7_500);
assert.equal(refreshed.revision, 3);

const refreshError = applyCreditRefreshError(
  { ...applied, refreshing: true },
  "Saldo belum bisa dimuat.",
);
assert.equal(refreshError.creditBalance?.balance, 8_000);
assert.equal(refreshError.refreshing, false);
assert.equal(refreshError.error, "Saldo belum bisa dimuat.");

const mock = createMockCreditBalance("mock-user", 25_000);
assert.equal(mock.userId, "mock-user");
assert.equal(mock.balance, 25_000);
```

The exact helper parameter shape may be tightened during implementation, but
the observable assertions above must remain.

- [ ] **Step 2: Add the test to the existing Credit v2 UI contract command**

Change `apps/web/package.json`:

```json
"test:credit-v2-ui": "tsx scripts/credit-estimate-ui-contracts.test.mts && tsx scripts/credit-transparency-ui-contracts.test.mts && tsx scripts/credit-context-state.test.mts"
```

- [ ] **Step 3: Run the test and confirm it fails for the missing module**

Run:

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
```

Expected: FAIL because `credit-context-state.ts` or its exports do not exist.

- [ ] **Step 4: Implement the smallest pure state module**

Create `apps/web/src/context/credit-context-state.ts`:

```ts
import type { CreditBalance } from "@vibenovel/shared";

export interface CreditStoreState {
  creditBalance: CreditBalance | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  revision: number;
  lastSyncedAt: string | null;
}

export function createEmptyCreditState(revision = 0): CreditStoreState {
  return {
    creditBalance: null,
    loading: false,
    refreshing: false,
    error: null,
    revision,
    lastSyncedAt: null,
  };
}

export function createMockCreditBalance(
  userId: string,
  balance: number,
): CreditBalance {
  return {
    id: `mock-credit-${userId}`,
    userId,
    balance,
    monthlyQuota: balance,
    monthlyUsed: 0,
    resetAt: null,
    source: "admin_grant",
    updatedAt: "2026-06-20T00:00:00.000Z",
  };
}
```

Add pure transitions for initial/background loading, applying a complete
server balance, committing only a matching refresh revision, and preserving a
known balance on background failure. Do not perform fetching or read React
state in this module.

- [ ] **Step 5: Run the pure contract tests**

Run:

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
```

Expected: PASS, including `credit-context-state.test.mts`.

- [ ] **Step 6: Commit the pure state foundation**

```powershell
git add apps/web/src/context/credit-context-state.ts apps/web/scripts/credit-context-state.test.mts apps/web/package.json
git commit -m "test(credit): define global balance state transitions"
```

## Task 2: Add `CreditProvider`, wire it into the application, and preserve the header hook

**Files:**

- Create: `apps/web/src/context/CreditContext.tsx`
- Create: `apps/web/scripts/credit-context-contracts.test.mts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/hooks/useCreditBalance.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Write failing source-contract tests**

Create `apps/web/scripts/credit-context-contracts.test.mts`. Read the provider,
App, and compatibility hook as text and assert:

```ts
assert.match(appSource, /<AuthProvider>[\s\S]*<CreditProvider>/);
assert.match(providerSource, /createContext<CreditContextValue \| null>/);
assert.match(providerSource, /revisionRef/);
assert.match(providerSource, /inFlightRef/);
assert.match(providerSource, /applyServerBalance/);
assert.match(providerSource, /refresh/);
assert.match(providerSource, /useMemo<CreditContextValue>/);
assert.doesNotMatch(hookSource, /fetchCreditBalance/);
assert.match(hookSource, /useCredit\(\)/);
```

Append it to `test:credit-v2-ui` after the pure-state test.

- [ ] **Step 2: Run the contracts and confirm they fail**

Run:

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
```

Expected: FAIL because the provider and new wiring do not exist.

- [ ] **Step 3: Implement the public Context contract**

Create `apps/web/src/context/CreditContext.tsx` with:

```ts
export interface CreditContextValue {
  creditBalance: CreditBalance | null;
  balance: number | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isMock: boolean;
  lastSyncedAt: string | null;
  refresh: () => Promise<CreditBalance | null>;
  applyServerBalance: (next: CreditBalance) => void;
}
```

Provider requirements:

- consume `session`, `user`, and `loading` from `useAuth()`;
- derive `token`, authenticated identity, and `shouldUseMocks()`;
- keep `revisionRef`, `identityRef`, and
  `inFlightRef: MutableRefObject<Promise<CreditBalance | null> | null>`;
- reset synchronously when identity changes or logout occurs;
- expose a synthetic full balance from `SHELL_MOCK.credits` in mock mode;
- never call `/api/credits/balance` in mock mode or while signed out;
- keep the old balance visible during background refresh;
- return the same promise to concurrent `refresh()` callers;
- clear `inFlightRef` in `finally`;
- commit a GET result only if its captured identity and revision are current;
- increment the revision before `applyServerBalance()` commits;
- memoize callbacks with `useCallback` and the Context value with `useMemo`;
- use effect cleanup/identity guards so React Strict Mode cannot commit an
  obsolete request.

The critical race guard should follow this shape:

```ts
const revisionAtStart = revisionRef.current;
const identityAtStart = identityRef.current;
const result = await fetchCreditBalance(token);

if (
  identityRef.current !== identityAtStart ||
  revisionRef.current !== revisionAtStart
) {
  return stateRef.current.creditBalance;
}

const committedRevision = revisionAtStart + 1;
revisionRef.current = committedRevision;
commitRefreshResult(result, revisionAtStart, committedRevision);
return result;
```

Do not use a stale state closure to decide whether a request is initial or
background; maintain a state ref or functional transition.

- [ ] **Step 4: Mount the provider once below auth**

Modify `apps/web/src/App.tsx`:

```tsx
import { CreditProvider } from "@/context/CreditContext";

export function App() {
  return (
    <AuthProvider>
      <CreditProvider>
        <RouterProvider router={router} />
        <DevAuthPanel />
      </CreditProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Convert `useCreditBalance` into a compatibility facade**

Remove local state, effects, mock construction, and direct fetching from
`apps/web/src/hooks/useCreditBalance.ts`. Keep the existing return shape:

```ts
export function useCreditBalance(): CreditBalanceState {
  const {
    balance,
    loading,
    error,
    isAuthenticated,
    isMock,
  } = useCredit();

  return {
    balance,
    loading,
    error: Boolean(error),
    isAuthenticated,
    isMock,
  };
}
```

This keeps `CreditIndicator` rendering behavior stable while changing its
state owner.

- [ ] **Step 6: Verify contracts, typecheck, and build**

Run:

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
npm run typecheck:web
npm run build:web
```

Expected: all PASS. The existing Vite chunk-size warning is acceptable if no
new error appears.

- [ ] **Step 7: Commit provider and application wiring**

```powershell
git add apps/web/src/context/CreditContext.tsx apps/web/src/App.tsx apps/web/src/hooks/useCreditBalance.ts apps/web/scripts/credit-context-contracts.test.mts apps/web/package.json
git commit -m "feat(credit): add global balance provider"
```

## Task 3: Migrate Intake, Concepts, Foundation, and Outline paid actions

**Files:**

- Modify: `apps/web/src/hooks/useIntakeData.ts`
- Modify: `apps/web/src/hooks/useConceptsData.ts`
- Modify: `apps/web/src/hooks/useFoundationFlow.ts`
- Modify: `apps/web/src/hooks/useOutlineData.ts`
- Modify: `apps/web/scripts/credit-context-contracts.test.mts`

- [ ] **Step 1: Extend contracts before changing hooks**

Add source assertions that each paid hook imports and uses `useCredit`, and
that Foundation/Outline no longer import `fetchCreditBalance`:

```ts
for (const source of [
  intakeHookSource,
  conceptHookSource,
  foundationHookSource,
  outlineHookSource,
]) {
  assert.match(source, /useCredit\(\)/);
}

assert.doesNotMatch(foundationHookSource, /fetchCreditBalance/);
assert.doesNotMatch(outlineHookSource, /fetchCreditBalance/);
assert.match(foundationHookSource, /applyServerBalance/);
assert.match(outlineHookSource, /applyServerBalance/);
assert.match(foundationHookSource, /await refresh\(\)/);
assert.match(outlineHookSource, /await refresh\(\)/);
```

- [ ] **Step 2: Run the contracts and confirm failure**

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
```

Expected: FAIL on unmigrated hooks.

- [ ] **Step 3: Update Intake and Concepts**

In both hooks:

```ts
const { applyServerBalance, refresh } = useCredit();
```

On paid success:

```ts
if (result.creditBalance) {
  applyServerBalance(result.creditBalance);
} else {
  await refresh();
}
```

Use the committed result balance for the existing success notice. In the paid
action `catch`, preserve existing safe error copy and then:

```ts
await refresh().catch(() => null);
```

Do not let a failed balance refresh replace the original AI action error.

- [ ] **Step 4: Update Foundation**

In `useFoundationFlow`:

- consume `balance`, `loading`, `error`, `applyServerBalance`, and `refresh`
  from Context;
- remove feature-local `creditBalance`, `creditLoading`, and `creditError`
  state;
- keep only `fetchCreditEstimate("foundation_setup", ...)` in the estimate
  effect;
- keep the returned `FoundationFlowData` shape by projecting Context values;
- after normal proposal generation, apply `result.creditBalance`, otherwise
  refresh;
- on paid failure, set the existing refund-safe notice and best-effort refresh;
- after successful `generateFoundationProposalsFromNarra`, call `refresh()`
  because that response lacks a complete balance;
- also refresh its failure path.

Use the authoritative value in success copy:

```ts
const nextBalance = result.creditBalance
  ? (applyServerBalance(result.creditBalance), result.creditBalance.balance)
  : (await refresh())?.balance ?? balance;
```

Prefer clearer imperative code over the comma expression in the final
implementation.

- [ ] **Step 5: Update Outline**

In `useOutlineData`:

- consume global balance state;
- remove local balance state and `fetchCreditBalance`;
- keep estimate loading independent from global balance loading;
- apply `result.creditBalance` after generation, otherwise refresh;
- best-effort refresh after paid failure;
- project Context values into the existing `OutlineData` return contract.

Do not add a new balance label to `OutlineWorkflowActions`.

- [ ] **Step 6: Run focused contracts and typecheck**

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
npm run typecheck:web
```

Expected: PASS.

- [ ] **Step 7: Commit the first paid-flow migration**

```powershell
git add apps/web/src/hooks/useIntakeData.ts apps/web/src/hooks/useConceptsData.ts apps/web/src/hooks/useFoundationFlow.ts apps/web/src/hooks/useOutlineData.ts apps/web/scripts/credit-context-contracts.test.mts
git commit -m "refactor(credit): sync foundation and outline actions"
```

## Task 4: Migrate Write Room and Summary paid actions

**Files:**

- Modify: `apps/web/src/hooks/useWriteRoomData.ts`
- Modify: `apps/web/src/hooks/useSummaryData.ts`
- Modify: `apps/web/scripts/credit-context-contracts.test.mts`

- [ ] **Step 1: Add failing migration contracts**

Assert:

```ts
assert.doesNotMatch(writeHookSource, /fetchCreditBalance/);
assert.doesNotMatch(writeHookSource, /setCreditBalance/);
assert.match(writeHookSource, /applyServerBalance/);
assert.match(writeHookSource, /generateSessionBeats[\s\S]*refresh/);

assert.match(summaryHookSource, /useCredit\(\)/);
assert.match(summaryHookSource, /generateSummary[\s\S]*refresh/);
assert.match(summaryHookSource, /extractDelta[\s\S]*refresh/);
```

- [ ] **Step 2: Confirm the contracts fail**

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
```

Expected: FAIL.

- [ ] **Step 3: Replace Write Room local balance state**

In `useWriteRoomData`:

- remove its `CreditBalance` state, direct balance fetch, and
  `refreshCreditBalance`;
- consume Context `creditBalance`, `balance`, `loading`, `error`,
  `applyServerBalance`, and `refresh`;
- preserve the hook’s public numeric `creditBalance` field by returning
  `balance`;
- preserve existing estimate state and insufficient-credit checks;
- for prose and rewrite success, call `applyServerBalance` when provided and
  `refresh` otherwise;
- for prose and rewrite failure, preserve the existing error then run a
  best-effort refresh;
- remove fallback arithmetic such as
  `Math.max(0, creditBalance.balance - cost)` from authoritative balance copy;
- after successful or failed `generateSessionBeats`, refresh because that
  endpoint does not return `creditBalance`.

For notices, use:

```ts
const refreshed = result.creditBalance
  ? result.creditBalance
  : await refresh();
const remaining = refreshed?.balance ?? balance;
```

- [ ] **Step 4: Sync Summary generation and delta extraction**

In `useSummaryData`:

- consume `refresh` from Context;
- call `await refresh()` after successful `generateSummary`;
- call best-effort refresh in its failure path;
- call `await refresh()` after successful `extractDelta`;
- call best-effort refresh in its failure path.

These endpoints currently lack complete balance responses. Do not infer cost
or subtract locally.

- [ ] **Step 5: Run tests and typecheck**

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
npm run typecheck:web
```

Expected: PASS.

- [ ] **Step 6: Commit Write/Summary migration**

```powershell
git add apps/web/src/hooks/useWriteRoomData.ts apps/web/src/hooks/useSummaryData.ts apps/web/scripts/credit-context-contracts.test.mts
git commit -m "refactor(credit): sync writing paid actions"
```

## Task 5: Migrate Publish and all read-only balance consumers

**Files:**

- Modify: `apps/web/src/hooks/usePublishData.ts`
- Modify: `apps/web/src/hooks/useDashboardData.ts`
- Modify: `apps/web/src/hooks/useSettingsData.ts`
- Modify: `apps/web/src/pages/CreditTopupPage.tsx`
- Modify: `apps/web/src/pages/CreditTopupReturnPage.tsx`
- Modify: `apps/web/scripts/credit-context-contracts.test.mts`

- [ ] **Step 1: Add failing source contracts**

Assert all five files consume `useCredit()` and none imports or calls
`fetchCreditBalance`:

```ts
for (const [label, source] of readOnlyAndPublishSources) {
  assert.match(source, /useCredit\(\)/, `${label} must consume Credit Context`);
  assert.doesNotMatch(
    source,
    /fetchCreditBalance/,
    `${label} must not fetch a private balance copy`,
  );
}
```

Also assert Publish uses `applyServerBalance` and has no optimistic subtraction.

- [ ] **Step 2: Confirm the contracts fail**

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
```

Expected: FAIL.

- [ ] **Step 3: Migrate Publish**

In `usePublishData`:

- remove local `CreditBalance`, loading, error, and direct refresh function;
- consume the complete Context balance and actions;
- keep estimate fetching local;
- apply the complete balance after `improvePublishCopy`;
- refresh when missing and after a paid failure;
- remove fallback `Math.max(... - cost)` arithmetic;
- continue returning the same numeric values expected by `PublishPage` and
  `PublishAiCopyPanel`.

The existing Publish panel remains an existing shared balance display and
should update in the same React commit as the header.

- [ ] **Step 4: Migrate Dashboard**

In `useDashboardData`:

- remove `fetchCreditBalance` from imports and `Promise.all`;
- load project data only;
- consume `creditBalance` from Context;
- derive usage with `mapCreditToUsage(creditBalance)`;
- update usage in an effect whenever `creditBalance` changes;
- retain current mock and non-credit error behavior.

- [ ] **Step 5: Migrate Settings**

In `useSettingsData`:

- remove balance requests from both data-loading branches;
- consume `creditBalance` from Context;
- keep profile and project-settings requests unchanged;
- use an effect to merge `creditsRemaining` and `monthlyUsage` whenever the
  global balance changes;
- do not overwrite unrelated locally edited settings.

- [ ] **Step 6: Migrate Top-up and Return**

In `CreditTopupPage.tsx`:

- read `creditBalance`, `loading`, and `error` from Context;
- remove private balance state and its balance-only fetch;
- retain product, health flag, checkout, and disabled-payment behavior.

In `CreditTopupReturnPage.tsx`:

- render Context balance;
- make its Refresh button call global `refresh()`;
- keep `toCreditTopupUserMessage` for safe errors;
- ensure the button’s loading state uses `refreshing`;
- remove `fetchCreditBalance`.

- [ ] **Step 7: Prove there are no remaining private web balance fetches**

Run:

```powershell
rg -n "fetchCreditBalance" apps/web/src
```

Expected: only:

```txt
apps/web/src/services/credits.ts
apps/web/src/context/CreditContext.tsx
```

- [ ] **Step 8: Run contracts, typecheck, and build**

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
npm run typecheck:web
npm run build:web
```

Expected: PASS.

- [ ] **Step 9: Commit the remaining consumer migration**

```powershell
git add apps/web/src/hooks/usePublishData.ts apps/web/src/hooks/useDashboardData.ts apps/web/src/hooks/useSettingsData.ts apps/web/src/pages/CreditTopupPage.tsx apps/web/src/pages/CreditTopupReturnPage.tsx apps/web/scripts/credit-context-contracts.test.mts
git commit -m "refactor(credit): unify balance consumers"
```

## Task 6: Add browser regressions for immediate header updates and refresh fallbacks

**Files:**

- Create: `apps/web/e2e/credit-context-live-balance.spec.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the focused Playwright command**

Add:

```json
"test:e2e:credit-context": "playwright test e2e/credit-context-live-balance.spec.ts"
```

- [ ] **Step 2: Write the first failing success-path E2E**

Reuse the API-mode session and route-mocking style from
`credit-v2-foundation-outline.spec.ts`.

The first test must:

1. initialize mocked server balance at 10,000;
2. navigate to Foundation;
3. assert `page.getByLabel("10.000 kredit tersisa")`;
4. generate Foundation with response balance 8,000;
5. assert `page.getByLabel("8.000 kredit tersisa")` without reload;
6. assert the existing success notice says `Sisa kredit: 8.000`;
7. navigate to Outline without resetting mock server state;
8. generate Outline with response balance 5,500;
9. assert `page.getByLabel("5.500 kredit tersisa")` without reload;
10. assert the existing Outline success notice.

There must be no assertion for a new Foundation/Outline panel balance label.

- [ ] **Step 3: Run it before implementation is complete**

```powershell
npm run test:e2e:credit-context -w @vibenovel/web
```

Expected before Tasks 2–5 are complete: FAIL because the header remains stale.
Expected at this point in the sequence: PASS.

- [ ] **Step 4: Add the missing-balance fallback test**

Track GET balance calls in the route mock. Return a paid mutation response with
no `creditBalance`, update mocked server state to 8,000, and assert:

- exactly one post-mutation `/api/credits/balance` request occurs;
- the header becomes 8,000;
- no page reload is used.

- [ ] **Step 5: Add the provider-failure/refund test**

Mock a failed paid action, model the server’s final/refunded balance, and
assert:

- the existing safe refund notice remains visible;
- one global balance refresh occurs;
- the header shows the server’s final balance;
- refresh failure, if separately tested, does not erase the last known header
  balance or replace the original action error.

- [ ] **Step 6: Add stale-response and dedup browser coverage**

Use deferred route fulfillment:

- start a balance GET returning 10,000;
- complete a paid mutation returning 8,000;
- release the older GET afterward;
- assert the header remains 8,000.

Trigger two consumers/refresh callers during the same in-flight request and
assert only one GET is issued.

- [ ] **Step 7: Add logout clearing coverage**

After showing an authenticated balance, trigger the existing logout control
or clear the session through the app-supported path. Assert the authenticated
credit label disappears and no previous-user amount remains visible.

- [ ] **Step 8: Run the focused E2E repeatedly**

```powershell
npm run test:e2e:credit-context -w @vibenovel/web
npm run test:e2e:credit-context -w @vibenovel/web
```

Expected: both runs PASS with no reload-based workaround and no timing flake.

- [ ] **Step 9: Commit the browser regression**

```powershell
git add apps/web/e2e/credit-context-live-balance.spec.ts apps/web/package.json
git commit -m "test(credit): cover live global balance updates"
```

## Task 7: Run the full gates and record implementation evidence

**Files:**

- Create: `docs/audit/24-global-credit-context-2026-06-20.md`
- Modify only if required by actual results: implementation files from prior
  tasks

- [ ] **Step 1: Run focused static and browser tests**

```powershell
npm run test:credit-v2-ui -w @vibenovel/web
npm run test:e2e:credit-context -w @vibenovel/web
npm run test:e2e:credit-v2-foundation-outline -w @vibenovel/web
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and production web build**

```powershell
npm run typecheck
npm run build:web:production
```

Expected: PASS. Record the generated web asset name.

- [ ] **Step 3: Run the full Credit v2 launch gate**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/credit-system-v2-launch-gate.ps1
```

Expected: exit code 0 and all Credit v2 checks PASS.

- [ ] **Step 4: Inspect the final diff for scope and accidental optimistic arithmetic**

```powershell
git diff --check
rg -n "fetchCreditBalance" apps/web/src
rg -n "Math\.max\(0,.*credit|balance\s*-\s*(cost|creditCost)" apps/web/src/hooks apps/web/src/pages
git status --short
```

Expected:

- no whitespace errors;
- private balance fetches exist only in service + Context;
- no authoritative balance is inferred by subtraction;
- no API/database/payment file has changed.

- [ ] **Step 5: Perform local browser QA**

Verify at desktop and mobile widths:

- initial header balance;
- immediate Foundation/Outline header changes;
- existing Writer and Publish panel balance matches header;
- Dashboard, Settings, Top-up, and Return show the same balance after
  navigation;
- background refresh does not blank the displayed amount;
- mock mode still renders its synthetic credit amount;
- logout clears the amount.

- [ ] **Step 6: Write the audit report**

Create `docs/audit/24-global-credit-context-2026-06-20.md` containing:

- root cause;
- files migrated;
- race/dedup behavior;
- exact commands and PASS/FAIL results;
- local browser QA evidence;
- asset name;
- confirmation that API, DB, pricing, and payment flags were unchanged;
- rollback instructions.

- [ ] **Step 7: Commit verification evidence**

```powershell
git add docs/audit/24-global-credit-context-2026-06-20.md
git commit -m "docs(credit): record global balance verification"
```

## Task 8: Deploy the web-only change to production

**Files:**

- No source changes expected
- Update after successful deployment:
  `docs/audit/24-global-credit-context-2026-06-20.md`

This task performs an external production mutation. At execution time, confirm
the user still wants production deployment before running the deploy command
if that approval is not already active in the execution thread.

- [ ] **Step 1: Capture the rollback target**

```powershell
npx wrangler pages deployment list --project-name narraza-web-production
```

Record the latest successful Pages deployment and asset before deployment.

- [ ] **Step 2: Re-run the production build immediately before deployment**

```powershell
npm run build:web:production
git diff --check
```

Expected: PASS.

- [ ] **Step 3: Deploy Pages only**

```powershell
npm run deploy:web:production
```

Do not deploy the API Worker and do not run database migrations.

- [ ] **Step 4: Verify production health and flags**

Verify:

- `https://app.narraza.web.id` returns HTTP 200;
- the HTML references the newly built asset;
- `https://api.narraza.web.id/api/health` reports production;
- `creditTopupEnabled` remains `false`;
- `aiGenerationEnabled` remains `true`;
- the API Worker deployment/version did not change.

- [ ] **Step 5: Run a controlled production browser verification**

With a safe authenticated test account:

1. note the header balance;
2. run one approved low-cost paid action;
3. verify the header changes without reload;
4. navigate to an existing balance surface and verify the same value;
5. do not enable or exercise payment/top-up checkout.

If a paid live action is not authorized, use read-only production checks and
state explicitly that mutation behavior is covered by Playwright route mocks.

- [ ] **Step 6: Update and commit deployment evidence**

Append deployment URL, deployment ID, asset name, health flags, verification
result, and rollback target to the audit report:

```powershell
git add docs/audit/24-global-credit-context-2026-06-20.md
git commit -m "docs(credit): record global context production deploy"
```

- [ ] **Step 7: Roll back if production verification fails**

Redeploy the captured previous Pages deployment or revert the web commit and
redeploy. No API, database, ledger, or payment rollback is required.

## Final definition of done

- [ ] Header updates immediately after every covered paid action without reload.
- [ ] Paid failures refresh to the server’s final/refunded balance.
- [ ] Stale GET responses cannot overwrite newer mutation balances.
- [ ] Concurrent refreshes issue one balance request.
- [ ] Writer/Publish and all read-only balance surfaces share Context.
- [ ] Foundation/Outline retain existing UI and only synchronize the header.
- [ ] Logout clears balance synchronously; mock mode remains functional.
- [ ] Only Context calls `fetchCreditBalance` outside the service module.
- [ ] Focused tests, typecheck, production build, and full Credit v2 gate pass.
- [ ] Production payment remains OFF.
