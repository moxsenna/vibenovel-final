# Task 10.8 — Mayar Staging Live Execution

**Date:** 2026-06-08  
**Sprint:** sprint-10  
**Status:** completed — **BLOCKED** (live steps not executed)

## Task goal

Execute live/staging Mayar verification: sandbox invoice create, GET invoice detail, capture real `payment.received` webhook, validate parser against real payload, duplicate/idempotency replay, Siklusio staging router replay. Determine Go/No-Go for production payment. No new product features.

## Files read

- `README.md`, `docs/50`, `docs/51`, `docs/52`, `docs/53`, `docs/36`
- `.agent-logs/sprint-10/task-10.5`, `task-10.6`, `task-10.7`
- `apps/api/src/services/mayar-client.ts`, `mayar-webhook.ts`, `process-mayar-payment-webhook.ts`, `credit-topup-grant.ts`
- `apps/api/src/routes/credits.ts`, `payment-webhooks.ts`
- `scripts/sprint10-mayar-live-smoke.ps1`, `sprint10-smoke-api.ps1`, `sprint10-dual-app-smoke.ps1`, `sprint10-smoke-web.ps1`, `smoke-all-local.ps1`
- `package.json`, `apps/api/.dev.vars.example`
- Mayar docs: introduction, invoice create/detail, webhook integration, register URL hook

## Files created/changed

| Path | Change |
|---|---|
| `docs/54-mayar-staging-live-execution-report.md` | **Created** — full Task 10.8 report; verdict BLOCKED |
| `.agent-logs/sprint-10/task-10.8-mayar-staging-live-execution.md` | **Created** — this log |
| `scripts/sprint10-mayar-live-smoke.ps1` | Task 10.8 label + report pointer `docs/54` |
| `README.md`, `docs/50`, `docs/51`, `docs/52`, `docs/53`, `docs/36`, `scripts/README.md` | Task 10.8 status |

**Not changed:** product source, migrations, UI, pricing, `.dev.vars`, `.env.local`

## Preflight (secret-safe)

| Check | Result |
|---|---|
| `.dev.vars` exists | Yes (gitignored) |
| `MAYAR_API_KEY` line non-empty | **No** |
| `hasMayarApiKey` via `/api/health` | **false** |
| `paymentProviderMock` | **true** |
| `creditTopupEnabled` | **true** |
| Staging VibeNovel deploy | **Not available** |
| Public webhook / tunnel | **Not configured** |

**Decision:** STOP live execution per task rules. Do not fake live.

## Commands run

| Command | Result |
|---|---|
| `GET /api/health` | **PASS** — booleans recorded (no secrets) |
| `npm run smoke:api:sprint10:mayar-live` | **PASS** precheck; live **NOT RUN** (no key + mock on) |
| `npm run smoke:api:sprint10` | **PASS** 25/25 |
| `npm run smoke:api:sprint10:dual-app` | **PASS** 13/13 |
| `npm run smoke:web:topup` | **PASS** |
| `npm run smoke:all:local` | **NOT RUN** — sprint10 + web:topup cover regression; no code changes |
| `npm run typecheck` / `build:*` | **NOT RUN** — no code changes |
| Live invoice create | **NOT RUN** |
| GET invoice detail | **NOT RUN** |
| Sandbox payment / webhook capture | **NOT RUN** |
| Siklusio staging router replay | **NOT RUN** |

## Results

- **Go/No-Go:** **BLOCKED** — missing `MAYAR_API_KEY`, mock mode on, no public webhook URL
- **Production payment:** **NOT PRODUCTION READY** / **PARTIAL GO** (unchanged)
- Mock/dual-app regression: **PASS** (cannot substitute for live proof)
- Parser: docs/fixture compatible — no real payload to validate
- No secrets committed or logged

## Decisions

- Halt live path immediately when `hasMayarApiKey=false` — no env mutation with placeholder keys
- Document Option B (Siklusio staging router) as preferred when unblocked
- Cite mock duplicate/idempotency as regression evidence only — not live verified
- Minimal script update: report pointer only, no new product endpoints

## Limitations

- Operator must supply sandbox key and public webhook URL outside agent session
- `mayar-client.ts` has create only — no GET invoice helper (detail step manual/deferred)
- Staging deploy not in scope for this session

## Next recommended task

**Task 10.8b — Operator Mayar Sandbox Live Run** (human-in-the-loop with key + tunnel/staging), or **Task 11.0** staging deploy plan if deploy-first path chosen.