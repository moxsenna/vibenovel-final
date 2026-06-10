# Task 10.5 — Mayar Sandbox Live Smoke

**Date:** 2026-06-08  
**Sprint:** sprint-10  
**Status:** completed — **PARTIAL GO**

## Goal

Limited Mayar sandbox/live verification: invoice create, paymentUrl, real webhook payload shape, parser compatibility, idempotency, amount validation, rollback safety, and Go/No-Go before production. No new product features.

## Files read

- `README.md`, `docs/50`, `docs/36`, Tasks 10.1–10.4 work logs
- `mayar-client.ts`, `mayar-webhook.ts`, `process-mayar-payment-webhook.ts`, `credit-topup-grant.ts`, `payment-webhooks.ts`
- `scripts/sprint10-smoke-api.ps1`, `sprint10-dual-app-smoke.ps1`, `sprint10-smoke-web.ps1`
- Mayar docs: introduction, invoice create/detail, webhook integration, register/test URL hook

## Files created/changed

| Path | Change |
|---|---|
| `docs/51-mayar-sandbox-live-smoke-report.md` | **Created** — full smoke report + PARTIAL GO |
| `scripts/sprint10-mayar-live-smoke.ps1` | **Created** — live smoke orchestrator (no secret logging) |
| `apps/api/src/services/mayar-webhook.ts` | Parser fix: exclude `data.id` from invoice id (webhook row id); `payment.received` implicit paid |
| `scripts/sprint10-dual-app-smoke.ps1` | Webhook fixture `invoiceId` field |
| `apps/web/e2e/sprint10-topup-flow.spec.ts` | Webhook `invoiceId` field |
| `scripts/sprint10-smoke-api.ps1` | Mayar docs-shaped webhook fixture regression |
| `package.json` | `smoke:api:sprint10:mayar-live` |
| `README.md`, `docs/50`, `docs/36`, `scripts/README.md`, `apps/api/README.md` | Status updates |

**Not committed:** `apps/api/.dev.vars`, `apps/web/.env.local`, Siklusio `.dev.vars`

## Environment decision

- **Used:** local VibeNovel API + local Supabase
- **Not used:** production Siklusio Mayar dashboard, production Workers deploy, tunnel
- **Blocker for live invoice:** `hasMayarApiKey=false` in local `.dev.vars`
- **Blocker for live webhook:** no public URL to receive Mayar POST locally

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run smoke:api:sprint10 -- -MockMode success` | **PASS** 25/25 (incl. docs-shaped fixture) |
| `npm run smoke:api:sprint10:mayar-live` | **PASS** (pre-check; live NOT RUN — no key) |
| `npm run smoke:api:sprint10:dual-app` | **PASS** 13/13 |
| `npm run smoke:web:topup` | **PASS** |
| `npm run build:shared` / `build:api` | **PASS** |
| `npm run smoke:all:local` | **PASS** 13/13 |

## Results summary

| Area | Result |
|---|---|
| Live invoice create | **NOT RUN** — no `MAYAR_API_KEY` |
| Invoice detail GET | **NOT RUN** |
| Real network webhook capture | **NOT RUN** — no tunnel/staging |
| Parser docs compatibility | **PASS** (fixture + hardening) |
| Mock/dual-app grant + idempotency | **PASS** |
| Siklusio router live staging | **NOT RUN** |
| Signature/HMAC | **Not documented** by Mayar public docs |
| Rollback | **PASS** — mock mode default preserved |

## Decisions

- **PARTIAL GO:** parser + regression sufficient for continued dev; production enable blocked until operator runs live smoke with sandbox key + captures one real webhook on staging/tunnel.
- Parser infers paid on `payment.received` when `status` absent (per Mayar event semantics).
- `data.id` may be webhook row id — correlate via `extraData.orderId` + `transactionId` first.
- No Mayar dashboard URL change; no repeated sandbox payments in this session.

## Limitations

- No live Mayar invoice or paid webhook in agent session (no API key in env).
- No Siklusio staging router replay.
- No `GET /invoice/{id}` server endpoint (operator uses Mayar dashboard/API with key locally if needed).

## Next recommended task

**Task 10.6** — Ops minimal + safety regression (inspect checklist, optional orchestrator phase, runbook).