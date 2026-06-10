# Task 10.4 — Credit Topup UI

**Date:** 2026-06-08  
**Sprint:** sprint-10  
**Status:** completed

## Goal

Minimal web UI for credit topup: show packages, checkout via existing 10.2/10.3 APIs, redirect to `paymentUrl`, pending/return page with balance refresh. Frontend must **never** grant credits — balance changes only after server webhook.

## Files read

- `README.md`, `docs/50`, `docs/36`, `.agents/rules/09-agent-work-logs.md`
- Task 10.1–10.3d work logs
- `apps/api/src/routes/credits.ts`, `payment-webhooks.ts`, `credit-topup.ts`, `credit-topup-grant.ts`, `process-mayar-payment-webhook.ts`
- `apps/web/src/services/credits.ts`, `useWriteRoomData.ts`, `WritePage.tsx`, `WriterAssistantPanel.tsx`, router setup
- `scripts/sprint10-smoke-api.ps1`, `sprint10-dual-app-smoke.ps1`, `sprint9-smoke-web.ps1`

## Files created/changed

| Path | Change |
|---|---|
| `apps/web/src/services/credits.ts` | Topup API client, health flags, error mapping, idempotency key helper |
| `apps/web/src/pages/CreditTopupPage.tsx` | **Created** — package cards, balance, checkout, mock/disabled/login states |
| `apps/web/src/pages/CreditTopupReturnPage.tsx` | **Created** — pending verification, Refresh Saldo |
| `apps/web/src/routes/paths.ts` | `creditTopup`, `creditTopupMockReturn` |
| `apps/web/src/routes/index.tsx` | Routes `/credits/topup`, `/mock-return`, `/return` |
| `apps/web/src/hooks/useWriteRoomData.ts` | `creditTopupEnabled` from `/api/health` |
| `apps/web/src/components/writer/WriterAssistantPanel.tsx` | Top up link / mock / disabled copy |
| `apps/web/src/pages/WritePage.tsx` | Pass `creditTopupEnabled`, `isMockMode` |
| `apps/web/e2e/sprint10-topup-flow.spec.ts` | **Created** — mock, disabled, checkout, webhook grant E2E |
| `apps/web/e2e/sprint8-write-ai-flow.spec.ts` | Topup line accepts link or disabled text |
| `scripts/sprint10-smoke-web.ps1` | **Created** — mock + optional `-IncludeApiMode`; API health probe fix |
| `package.json` | `smoke:web:topup`, `smoke:web:sprint10` |
| `apps/web/.env.example` | Task 10.4 note |
| `README.md`, `docs/50`, `docs/36`, `scripts/README.md` | Status + smoke docs |

**Not committed:** `apps/web/.env.local`, `apps/api/.dev.vars`

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `npm run smoke:api:sprint10` | **PASS** — 24/24 (+4 SKIP/NOT RUN) |
| `npm run smoke:api` | **PASS** — 17/17 |
| `npm run smoke:api:sprint5` | **PASS** |
| `npm run smoke:api:sprint6` | **PASS** |
| `npm run smoke:api:sprint7` | **PASS** |
| `npm run smoke:api:sprint8` | **PASS** — 8 (+5 NOT RUN AI disabled) |
| `npm run smoke:api:sprint9` | **PASS** — 10 (+11 NOT RUN AI disabled) |
| `npm run smoke:web:topup` | **PASS** — mock mode |
| `smoke:web:topup -IncludeApiMode -SkipMockMode` | **PASS** — checkout redirect + webhook grant refresh |
| `npm run smoke:api:sprint10:dual-app` | **PASS** — 13/13 |
| `npm run smoke:all:local` | **PASS** — 13/13 phases |

## Results

- Topup products visible in API mode when `CREDIT_TOPUP_ENABLED=true` and logged in.
- Checkout POST → redirect to mock return URL or Mayar `paymentUrl`.
- UI does not mutate balance or mark paid; E2E posts webhook via Playwright `request` only.
- Mock mode (`VITE_USE_MOCKS=true`) shows explanation; no checkout, no fake payment.
- Disabled mode shows safe “Top up belum tersedia”.
- No secrets/raw provider payload/ledger rows in DOM (E2E leak guards).

## Decisions

- Global route `/credits/topup` (no project context required).
- `fetchApiHealthFlags()` via public `GET /api/health` for topup enabled state (no auth).
- E2E webhook simulation in Playwright `request.post`, not product UI.
- `sprint10-smoke-web.ps1` probes `/api/health` (not API root 404) for reachability.

## Limitations

- No admin dashboard, refund/chargeback, live Mayar sandbox UI test.
- `smoke:all:local` does not yet include Sprint 10 web phase (run `smoke:web:topup` separately).
- API-mode E2E requires manual `VITE_USE_MOCKS=false` + restart `dev:web`.
- `WriterMobileLayout` credit card does not duplicate topup link (desktop assistant panel only).
- Production: enable topup only after Siklusio staging router replay Go/No-Go.

## Next recommended task

**Task 10.5** — Mayar sandbox live smoke (capture real `payment.received` JSON, validate parser against production shape).