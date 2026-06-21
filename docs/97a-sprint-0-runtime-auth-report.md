# Sprint 0 Runtime/Auth Report

Date: 2026-06-13

## Scope

Sprint 0 stabilizes production runtime/auth boundaries for Narraza:

- web/API Supabase project-ref audit without printing keys
- `/api/health` safe boolean env flags only
- API-mode logout route blocking
- production web build guardrails for `VITE_USE_MOCKS=false` and staging Supabase refs
- production preflight smoke commands

## Changes

- Added targeted Supabase auth storage cleanup on logout and expired-token cleanup.
- Hid the public login-page `Lanjut ke dashboard` shortcut when signed out in API mode.
- Added Playwright logout regression coverage for dashboard content clearing and route blocking.
- Reduced health env output to safe booleans only:
  - `hasSupabaseUrl`
  - `hasSupabaseAnonKey`
  - `hasSupabaseServiceRoleKey`
  - `aiGenerationEnabled`
  - `aiProviderMock`
  - `hasOpenRouterApiKey`
  - `creditTopupEnabled`
  - `paymentProviderMock`
- Added production Supabase project-ref audit to:
  - `scripts/operator-production-api-web-deploy.ps1`
  - `scripts/operator-production-supabase-baseline.ps1`
  - `scripts/build-production-web.ps1`
- Added optional founder bearer-token API smoke to `operator-production-api-web-deploy.ps1`.

## Verification Evidence

Command: `npm run test:health-env-flags -w @vibenovel/api`

Result: PASS

Evidence: `PASS env health flags are safe booleans only`

Command: `SMOKE_WEB_BASE_URL=http://127.0.0.1:5176 npx playwright test e2e/auth-settings-regression.spec.ts --project=chromium`

Result: PASS

Evidence: 4 passed, covering signed-out dashboard block, logout/dashboard block, stale token refresh retry, and settings cost persistence.

Command: `npm run typecheck`

Result: PASS

Command: `npm run lint`

Result: PASS with pre-existing warnings, 0 errors.

Command: `npm run build:web:production`

Result: PASS

Evidence: Supabase audit passed with matching production project ref `qjmbobvarspwvaalnjct`; build forced `VITE_USE_MOCKS=false`.

Command: `npm run build:api`

Result: PASS

Evidence: Wrangler dry-run completed.

Command: `npm run operator:production:supabase:baseline`

Result: PASS preflight

Evidence: production ref `qjmbobvarspwvaalnjct` confirmed not staging; web/API Supabase refs matched; staging Mode A unchanged.

Command: `npm run operator:production:api-web:deploy`

Result: PASS preflight

Evidence:

- `.env.production` Mode A passed.
- web/API Supabase refs matched.
- production API DNS did not resolve to staging EC2.
- production app DNS resolved.
- production API health Mode A passed.
- founder authenticated API smoke passed with a temporary founder session token supplied via process environment.
- authenticated endpoints verified:
  - `GET /api/me`
  - `GET /api/credits/balance`
  - `GET /api/projects`
  - `GET /api/projects/bcc5fb5d-03c7-4e4e-9905-6cec483e6e78/concepts`
  - `GET /api/projects/bcc5fb5d-03c7-4e4e-9905-6cec483e6e78/foundation`
  - `GET /api/projects/bcc5fb5d-03c7-4e4e-9905-6cec483e6e78/outline`

## Residual Risks

- Current production deployment may still run the previously deployed API/web bundle until the updated build is deployed.
- `FOUNDER_ACCESS_TOKEN` must be supplied through process environment only; passing it as a CLI argument can expose it in command logs.

## Exit Gate Status

Pass.

Local API-mode auth/logout regression is fixed, production preflight guardrails pass, and founder authenticated production API smoke passes.
