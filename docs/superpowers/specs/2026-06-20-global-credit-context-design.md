# Global Credit Context Design

**Status:** Approved design

**Date:** 2026-06-20

**Scope:** Web application credit-balance state only

**Production issue:** Header credit remains stale after a paid AI action until the page reloads.

## 1. Problem

Credit balance is currently fetched and stored independently by multiple
surfaces:

- `CreditIndicator` calls `useCreditBalance`, which fetches only when auth or
  mock mode changes.
- Foundation, Outline, Write, and Publish keep their own local credit state.
- Intake and Concept display the balance returned by the mutation only inside a
  success notice.
- Dashboard, Settings, Top-up, and Top-up Return fetch separate copies.

A paid mutation can therefore return the correct new balance while the header
continues rendering an older state owned by another hook instance. Reloading
the page mounts the header hook again and fetches the correct balance, which
explains the observed production behavior.

## 2. Goals

1. Provide one global, server-authoritative credit state for the signed-in web
   application.
2. Update the header immediately when any paid action returns a new balance.
3. Make header, AI panels, Dashboard, Settings, Top-up, and Top-up Return read
   the same state.
4. Keep balance updates correct during concurrent fetches and mutations.
5. Preserve mock-mode behavior and signed-out behavior.
6. Keep public payment behavior unchanged.
7. Avoid optimistic debit calculations; the server remains authoritative.

## 3. Non-goals

- No API, database, pricing, ledger, or payment changes.
- No new caching library.
- No cross-browser-tab synchronization.
- No automatic polling.
- No balance animation redesign.
- No live paid OpenRouter smoke as part of implementation.

## 4. Considered approaches

### A. Window event after each mutation

Each mutation dispatches a custom event and the header refetches.

Advantages:

- Small patch.
- Low initial migration cost.

Disadvantages:

- Balance remains duplicated across hooks.
- Stringly typed event contracts.
- Dashboard, Settings, and Top-up can still drift.
- Refetch-only behavior creates unnecessary requests and race conditions.

### B. React Credit Context

One provider owns the full `CreditBalance`, exposes controlled update methods,
and all consumers use the same state.

Advantages:

- No new dependency.
- Fits the existing `AuthProvider` architecture.
- Mutation responses update every consumer synchronously.
- Full balance data supports monthly usage as well as remaining credits.
- Easy to test with API route mocks.

Disadvantages:

- Requires migrating several existing hooks.
- Context must defend against stale asynchronous fetches.

### C. TanStack Query

Use a query cache for `/api/credits/balance`, then update or invalidate the
query after mutations.

Advantages:

- Mature request deduplication and invalidation.
- Scales well to broader server-state migration.

Disadvantages:

- Adds a dependency and provider solely for one resource.
- Larger architectural migration than the current bug requires.
- Existing hooks are not query-cache based.

**Decision:** Use approach B, a native React Credit Context.

## 5. Architecture

Provider nesting:

```tsx
<AuthProvider>
  <CreditProvider>
    <RouterProvider router={router} />
    <DevAuthPanel />
  </CreditProvider>
</AuthProvider>
```

`CreditProvider` is mounted once for the whole application. It observes the
current auth session through `useAuth`, loads the balance when the authenticated
user changes, and resets immediately on logout.

The Context stores the complete shared `CreditBalance` object so consumers can
derive:

- remaining balance;
- monthly used credits;
- monthly quota;
- reset date;
- source and update timestamp.

## 6. Public Context contract

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

Rules:

- `creditBalance` is the canonical state.
- `balance` is a convenience projection.
- `loading` is used only for the initial load after auth identity changes.
- `refreshing` is used for later background refreshes and must not blank the
  currently displayed balance.
- `error` is user-safe and never contains raw provider or database details.
- `applyServerBalance` accepts only a complete server response.
- Callers must use `refresh()` when an endpoint does not return
  `creditBalance`.
- Reset remains an internal provider behavior driven by session changes; it is
  not exposed to feature hooks.

The existing `useCreditBalance()` hook becomes a compatibility facade over this
Context so `CreditIndicator` does not need an unrelated rendering rewrite.

## 7. State lifecycle

### Signed out

```txt
creditBalance = null
loading = false
refreshing = false
error = null
isAuthenticated = false
```

### Mock mode

The provider exposes a synthetic `CreditBalance` built from `SHELL_MOCK.credits`
with stable mock monthly quota/usage fields. It never calls the API.

### Login or authenticated session change

1. Clear balance and errors from the previous identity.
2. Mark initial `loading=true`.
3. Fetch `/api/credits/balance`.
4. Commit the returned complete `CreditBalance`.
5. Mark `loading=false`.

### Logout

Clear the balance synchronously when the auth session becomes null. No stale
credit amount from the previous user may flash on the login screen or next
account.

### Paid mutation success

```ts
if (result.creditBalance) {
  applyServerBalance(result.creditBalance);
} else {
  await refresh();
}
```

The success notice uses the balance already committed to Context.

### Paid mutation failure

The feature shows its safe no-charge/refund message, then runs `refresh()` in
the failure path. This is necessary because a provider failure may have caused
a debit and refund lifecycle even though the mutation itself returned an error.

Refreshing must not replace the current balance with a loading placeholder.

## 8. Stale-response protection

Global state introduces a race that local state did not solve: an older balance
fetch can finish after a newer paid mutation.

The provider maintains a monotonic revision:

```ts
const revisionRef = useRef(0);
```

- `applyServerBalance` increments the revision before committing.
- `refresh` captures `revisionAtStart`.
- A refresh response is committed only if the current revision still equals
  `revisionAtStart`.
- An auth identity change increments the revision and invalidates all requests
  from the previous identity.

Example:

```txt
GET balance starts at revision 4
AI action succeeds and applies balance at revision 5
old GET returns
GET result is ignored because current revision is 5
```

Concurrent refresh calls are deduplicated through one in-flight promise per
authenticated token. This avoids duplicate balance requests from pages mounting
at the same time.

## 9. Consumer migration

### Shared layout

- `CreditIndicator` continues using `useCreditBalance`, now backed by Context.
- Desktop and mobile header therefore update in the same React commit as the
  paid mutation response.

### Paid AI actions

The following hooks call `applyServerBalance` on success and `refresh` when the
response balance is absent or the action fails:

- `useIntakeData`
- `useConceptsData`
- `useFoundationFlow`
- `useOutlineData`
- `useWriteRoomData` for prose and rewrite
- `usePublishData`

Feature-local balance state is removed from Foundation, Outline, Write, and
Publish. Their panels read Context directly. Estimate state remains local
because estimates are feature-specific, not global credit state.

### Dashboard

`useDashboardData` stops fetching credit balance. It loads projects only and
derives usage with:

```ts
mapCreditToUsage(creditBalance)
```

Because the full balance object lives in Context, Dashboard monthly usage
changes without another page-specific credit fetch.

### Settings

`useSettingsData` stops fetching credit balance in its data-loading promises.
Profile and project settings remain local API data. Credit-derived fields are
merged from Context, and a small effect updates `creditsRemaining` and
`monthlyUsage` whenever global credit state changes.

### Top-up

`CreditTopupPage` reads balance/loading/error from Context and no longer owns
parallel balance state.

`CreditTopupReturnPage` renders Context balance and its Refresh button calls the
global `refresh()`. A successful refresh updates the header, return page, and
any later navigation consistently.

## 10. Error behavior

- Initial balance load failure:
  - header shows the existing unavailable state;
  - pages may still load non-credit data;
  - retry is available through `refresh`.
- Background refresh failure:
  - retain the last known balance;
  - set a safe error string;
  - do not revert to `null`.
- Paid action failure:
  - retain safe refund copy;
  - attempt global refresh;
  - do not hide the original action error if refresh also fails.
- Missing `creditBalance` in a successful mutation:
  - treat as a compatibility case;
  - refetch globally;
  - do not estimate the new balance by subtracting the displayed cost.

## 11. Testing strategy

### Pure state contracts

Create pure helpers/reducer tests for:

- session reset;
- mock state;
- applying a complete server balance;
- initial load versus background refresh flags;
- stale refresh rejection after a newer mutation revision;
- preserving last known balance on background refresh error.

### Source contracts

Assert:

- `CreditProvider` wraps the router under `AuthProvider`;
- header uses Context-backed `useCreditBalance`;
- all paid hooks call `applyServerBalance`;
- missing response balance and failure paths call `refresh`;
- Dashboard, Settings, Top-up, and Top-up Return no longer call
  `fetchCreditBalance` directly.

### Browser E2E

Use Playwright API mocks to prove:

1. Header starts at 10,000.
2. Foundation success returns 8,000.
3. Header and Foundation panel show 8,000 without reload.
4. Outline success returns 5,500.
5. Header and Outline panel show 5,500 without reload.
6. Prose and Rewrite update the same header state.
7. Publish success updates header and Publish panel.
8. A success response without `creditBalance` triggers one balance refetch.
9. A provider failure triggers balance refresh and keeps the refunded amount.
10. Logout clears the global balance.

## 12. Rollout and rollback

Rollout:

1. Implement pure Context state and provider.
2. Migrate header compatibility hook.
3. Migrate paid action hooks.
4. Migrate read-only surfaces.
5. Run full web and Credit v2 gates.
6. Deploy web only; API and database are unchanged.
7. Verify the header updates after a controlled paid action.

Rollback:

- Revert the web commit and redeploy the previous Pages deployment.
- No API, database, ledger, payment, or migration rollback is required.

## 13. Acceptance criteria

- Header credit changes immediately after every paid AI success without reload.
- Header shows the refunded/final balance after a failed paid AI action.
- AI panels, Dashboard, Settings, Top-up, and Top-up Return share one balance.
- No migrated surface calls `fetchCreditBalance` independently.
- No client-side optimistic debit arithmetic determines authoritative balance.
- A stale GET cannot overwrite a newer mutation balance.
- Logout clears balance immediately.
- Mock mode remains functional.
- Full Credit v2 launch gate and focused Playwright tests pass.
- Production payment remains OFF.
