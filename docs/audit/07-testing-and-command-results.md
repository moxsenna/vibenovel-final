# 07 - Testing and Command Results

## Commands run in this audit

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | PASS | Shared, web, and API TypeScript checks passed. |
| `npm run build:shared` | PASS | `@vibenovel/shared` compiled with `tsc`. |
| `npm run build:web` | PASS with warning | Vite built 241 modules. Warning: JS chunk `assets/index-CGfrPeMB.js` is 684.47 kB after minification. |
| `npm run build:api` | PASS with warning | Wrangler dry-run succeeded. Warning: Wrangler `3.114.17` is out of date; suggests v4. |
| `npm pkg get scripts.test` | PASS query, no script | Returned `{}`. Root `test` script is not defined. |
| `npm pkg get scripts.lint` | PASS query, no script | Returned `{}`. Root `lint` script is not defined. |

## Commands not run

| Command/class | Why not run | Follow-up |
|---|---|---|
| Full Playwright E2E | Needs controlled dev server, Supabase session, and possibly production/staging credentials; audit is read-only and should not mutate account state blindly. | Rerun after auth/session env is fixed. |
| Smoke PowerShell suites | Many require local Supabase/API/web and seeded users. | Run targeted smoke after stabilization. |
| Production API probes | User requested repo audit; no explicit approval to hit prod credentials/state. | Use operator smoke scripts after env review. |

## Existing automated test surface

| Area | Evidence |
|---|---|
| CI | `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`, `build:shared`, `build:web`, `build:api`. |
| Playwright | `apps/web/e2e/*.spec.ts` includes auth/settings regression, mock boundary, intake/concept, sprint3-10 flows. |
| Smoke scripts | `scripts/smoke-all-local.ps1`, `sprint2` through `sprint10` API/web scripts, staging/operator scripts. |
| Auth/settings regression | `apps/web/e2e/auth-settings-regression.spec.ts` covers signed-out dashboard block, stale token refresh retry, quality mode persistence, numeric cost estimates. |

## Warnings and risks

1. No root test script means `npm test` is not a reliable quality gate.
2. No root lint script means style/static safety is not enforced by CI.
3. Web bundle warning should be tracked for mobile performance.
4. Wrangler out-of-date warning should be handled before deploy toolchain drift causes issues.
5. E2E tests exist but depend on env conventions; production-like tests need explicit setup.

## Recommended verification order

1. `npm run typecheck`
2. `npm run build:web`
3. `npm run build:api`
4. `SMOKE_WEB_BASE_URL=<local web> npx playwright test apps/web/e2e/auth-settings-regression.spec.ts`
5. Real API-mode E2E for concepts/foundation/outline/write after Supabase token alignment.
6. Only after above, run broader sprint smoke suite.
