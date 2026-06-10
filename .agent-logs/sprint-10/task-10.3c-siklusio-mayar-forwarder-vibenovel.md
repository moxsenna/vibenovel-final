# Task 10.3c — Siklusio Mayar Webhook Forwarder (VibeNovel dependency)

**Date:** 2026-06-08  
**Sprint:** sprint-10  
**Status:** completed (Siklusio implementation); cross-repo E2E pending staging

## Summary

Siklusio production webhook (`POST /api/payment/webhook`) now acts as Mayar multi-app router when `MAYAR_MULTI_APP_ROUTER_ENABLED=true`. Payloads with `extraData.app=vibenovel` and `flow=credit_topup` are forwarded to `VIBENOVEL_MAYAR_WEBHOOK_URL` before any Siklusio matching. Mayar dashboard URL **unchanged**.

VibeNovel code unchanged in this task (10.3b router gate already in place).

## VibeNovel files read (compatibility)

- `.agent-logs/sprint-10/task-10.3b-mayar-internal-webhook-router-compatibility.md`
- `apps/api/src/routes/payment-webhooks.ts`
- `apps/api/src/services/mayar-webhook.ts`
- `apps/api/src/services/process-mayar-payment-webhook.ts`
- `scripts/sprint10-smoke-api.ps1`

## VibeNovel docs updated

| Path | Change |
|---|---|
| `docs/50-sprint-10-production-readiness-mayar-monetization-plan.md` | §20 next task → 10.4; §25 Task 10.3c status |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Router + Siklusio extraData tags marked done; dual-app E2E staging checklist |

## Siklusio implementation (external repo)

Work log: `D:\Coding\remix_-siklusio\.agent-logs\task-10.3c-siklusio-mayar-forwarder-vibenovel.md`

## Cross-repo E2E (NOT RUN)

Staging checklist before prod `MAYAR_MULTI_APP_ROUTER_ENABLED=true`:

1. VibeNovel: `CREDIT_TOPUP_ENABLED=true`, mock or sandbox checkout
2. POST VibeNovel-shaped `payment.received` to Siklusio webhook with valid `X-Callback-Token`
3. Assert Siklusio forwards once; VibeNovel grants credit once
4. Replay same webhook → VibeNovel idempotent (no double grant)

## VibeNovel regression commands

| Command | Result |
|---|---|
| `npm run smoke:api:sprint10 -- -MockMode success` | **PASS** — 24/24 |
| `npm run smoke:all:local` | **PASS** — 13/13, ~1.3m |

## Next recommended task

**Task 10.4 — Credit Topup UI** after staging dual-app smoke PASS. Do not enable Siklusio router in production until then.