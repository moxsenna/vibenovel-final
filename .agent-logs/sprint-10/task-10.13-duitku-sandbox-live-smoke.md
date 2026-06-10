# Task 10.13 — Duitku Sandbox Live Smoke

## Task goal

Run live Duitku POP sandbox smoke: real createInvoice, paymentUrl, server callback, grant, duplicate replay, and sanitized payload capture. Determine whether Duitku can move from fixture PASS to sandbox GO. Do not enable production payment.

## Files read

- `docs/58-duitku-callback-idempotent-grant-report.md`
- `docs/57-duitku-checkout-integration-report.md`
- `docs/56-duitku-pop-provider-adapter-shell.md`
- `docs/55-duitku-provider-spike-and-migration-feasibility.md`
- `docs/52-sprint-10-payment-ops-and-safety-regression.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/54-mayar-staging-live-execution-report.md` (pattern reference)
- `.agent-logs/sprint-10/task-10.10-duitku-pop-provider-env-adapter-shell.md`
- `.agent-logs/sprint-10/task-10.11-duitku-checkout-integration.md`
- `.agent-logs/sprint-10/task-10.12-duitku-callback-idempotent-grant.md`
- `apps/api/src/services/duitku-pop-client.ts`
- `apps/api/src/services/duitku-callback.ts`
- `apps/api/src/services/process-duitku-payment-callback.ts`
- `apps/api/src/routes/payment-webhooks.ts`
- `apps/api/src/services/credit-topup.ts`
- `apps/api/src/services/credit-topup-grant.ts`
- `apps/api/src/services/payment-webhook-event.ts`
- `scripts/sprint10-duitku-smoke-api.ps1`
- `apps/web/src/pages/CreditTopupPage.tsx`
- `apps/web/src/pages/CreditTopupReturnPage.tsx`
- `package.json`
- `.agents/rules/09-agent-work-logs.md`
- `apps/api/.dev.vars` (names only — not committed)
- Duitku POP docs (Create Invoice, Callback, Signature)

## Files created/changed

| Path | Note |
|---|---|
| `docs/59-duitku-sandbox-live-smoke-report.md` | **Created** — full live smoke report, BLOCKED verdict |
| `.agent-logs/sprint-10/task-10.13-duitku-sandbox-live-smoke.md` | **Created** — this log |
| `apps/api/src/env.ts` | Added `hasDuitkuCallbackUrl`, `duitkuCallbackUrlIsPublic` health flags |
| `scripts/sprint10-duitku-smoke-api.ps1` | Task 10.13 preflight, live-blocked steps, `-ExpectCallback` |
| `README.md` | Task 10.13 row + next task |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Task 10.13 addendum |
| `docs/56-duitku-pop-provider-adapter-shell.md` | Post-10.13 addendum |
| `docs/57-duitku-checkout-integration-report.md` | Post-10.13 addendum |
| `docs/58-duitku-callback-idempotent-grant-report.md` | Post-10.13 addendum |
| `scripts/README.md` | Task 10.13 smoke note |
| `apps/api/README.md` | Health flags + docs/59 reference |

## Commands run

```text
curl.exe -s http://127.0.0.1:8787/api/health
npm run typecheck:api
npm run typecheck
npm run build:shared
npm run build:web
npm run build:api
npm run smoke:api:sprint10:duitku
npm run smoke:api:sprint10
npm run smoke:api
npm run smoke:api:sprint5
npm run smoke:api:sprint6
npm run smoke:api:sprint7
npm run smoke:api:sprint8
npm run smoke:api:sprint9
npm run smoke:web:topup
npm run smoke:all:local
```

Not run:

- `npm run smoke:api:sprint10:duitku -- -LiveCreate` — blocked (no credentials, mock mode)
- Sandbox payment in Duitku UI — blocked
- Tunnel/staging callback setup — not configured

## Results

### Preflight (`GET /api/health`)

- `creditTopupEnabled=true`
- `paymentProviderMock=true`
- `paymentProvider=mock`
- `hasDuitkuMerchantCode=false`
- `hasDuitkuMerchantKey=false`
- `hasDuitkuCallbackUrl=false`
- `duitkuCallbackUrlIsPublic=false`
- `duitkuSmokeCallbackFixture=true`
- `aiGenerationEnabled=false`

### Live steps

| Step | Result |
|---|---|
| LiveCreate | **NOT RUN** — BLOCKED |
| Sandbox payment | **NOT RUN** |
| Real callback capture | **NOT RUN** |
| Live grant verify | **NOT RUN** |
| Live duplicate replay | **NOT RUN** |
| Live negative tests | **NOT RUN** |

### Fixture regression

- `smoke:api:sprint10:duitku`: **PASS** 15/15, 1 BLOCKED preflight, 0 FAIL
- Full regression suite: **PASS** (all commands above exit 0)

### Go/No-Go

**BLOCKED** — no Duitku credentials, no public callback URL, mock mode active.

## Decisions

1. **Stopped live execution** when preflight failed — no faked live PASS.
2. **Added safe health booleans** `hasDuitkuCallbackUrl` / `duitkuCallbackUrlIsPublic` instead of logging callback URL.
3. **Extended smoke script** with explicit live-blocked step matrix and `-ExpectCallback` for operator follow-up.
4. **Kept rollback unchanged** — environment already safe (`PAYMENT_PROVIDER_MOCK=true`).
5. **Fixture evidence** used for negative/duplicate grant safety until live payload available.

## Limitations

- No Duitku sandbox merchant credentials in local `.dev.vars`
- No staging Worker URL or tunnel for public callback
- No real Duitku callback payload/headers captured
- Return page live redirect not manually validated (API guarantee + mock web smoke only)
- Production payment not enabled

## Next recommended task

**Task 10.13b** — operator configures Duitku sandbox credentials + public `DUITKU_CALLBACK_URL`, then re-runs `-LiveCreate` + sandbox payment + callback capture. Or **Task 11.0** staging deploy for public callback endpoint.