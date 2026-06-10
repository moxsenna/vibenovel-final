# Task 11.0 — Staging Deploy & Public Callback Preparation

## Task goal

Prepare staging deploy architecture, public callback URL strategy, env/secret checklist, deploy steps, smoke plan, and rollback so Duitku and/or Mayar sandbox payment can be tested. Do not enable production payment. Do not deploy unless already configured (plan first).

## Files read

- `README.md`
- `docs/53-sprint-10-verification-report.md`
- `docs/59-duitku-sandbox-live-smoke-report.md`
- `docs/58-duitku-callback-idempotent-grant-report.md`
- `docs/57-duitku-checkout-integration-report.md`
- `docs/56-duitku-pop-provider-adapter-shell.md`
- `docs/54-mayar-staging-live-execution-report.md`
- `docs/52-sprint-10-payment-ops-and-safety-regression.md`
- `docs/36-non-blocking-technical-debt-and-deferred-items.md`
- `docs/46-live-openrouter-staging-verification-plan.md` (pattern reference)
- `apps/api/wrangler.toml`
- `apps/api/src/env.ts`
- `apps/api/src/routes/payment-webhooks.ts`
- `apps/web/.env.example`
- `apps/web/package.json`
- `apps/api/package.json`
- `package.json`
- `scripts/smoke-all-local.ps1`
- `scripts/sprint10-duitku-smoke-api.ps1`
- `scripts/sprint10-mayar-live-smoke.ps1`
- `scripts/sprint10-smoke-web.ps1`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| Path | Note |
|---|---|
| `docs/60-sprint-11-staging-deploy-and-public-callback-plan.md` | **Created** — full staging plan |
| `.agent-logs/sprint-11/task-11.0-staging-deploy-public-callback-preparation.md` | **Created** — this log |
| `README.md` | Sprint 11 / Task 11.0 row |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Blocked/deferred register update |
| `scripts/README.md` | Staging smoke notes |
| `apps/api/README.md` | Staging deploy section |
| `apps/web/.env.example` | Staging env comments |

## Commands run

None — docs/planning task only; no code or script logic changed.

## Results

| Deliverable | Status |
|---|---|
| Deploy readiness audit | ✅ API=Cloudflare Workers, Web=Vite SPA→Pages recommended |
| Staging env names + URLs | ✅ Documented in docs/60 |
| API/web secret checklist | ✅ Names only, no values |
| Safe Mode A / payment Mode B | ✅ Documented |
| Public callback checklist | ✅ Documented |
| Deploy steps | ✅ PowerShell-friendly, not executed |
| Smoke plan (5 layers) | ✅ Documented; existing `-ApiBaseUrl` noted |
| Rollback plan | ✅ Documented |
| Blocked/deferred register | ✅ Updated docs/36 |
| Remote deploy | **NOT RUN** |
| Production payment | **NOT ENABLED** |

## Decisions

1. **Cloudflare Workers + Pages** as staging targets — matches existing `wrangler.toml` and Vite build; no new runtime introduced.
2. **Hosted Supabase** required for staging — local Docker not reachable from Cloudflare Workers.
3. **Mode A first deploy** — `CREDIT_TOPUP_ENABLED=false`, `PAYMENT_PROVIDER_MOCK=true`; payment secrets only for Mode B smoke.
4. **No wrangler.toml changes in 11.0** — `[env.staging]` deferred to Task 11.1 to avoid premature deploy config.
5. **Smoke scripts already support `-ApiBaseUrl`** — staging smoke documented with manual params; Supabase URL gap deferred to 11.2.
6. **Duitku direct callback preferred for VibeNovel-only test**; Mayar via Siklusio router optional for production-like path.

## Limitations

- No actual Cloudflare or Supabase staging resources created
- No `deploy:staging` npm scripts added
- No staging smoke orchestrator script
- Staging GO not claimed — plan only

## Next recommended task

**Task 11.1** — Execute staging deploy: add `[env.staging]` to wrangler, create Pages project, deploy Mode A, verify `/api/health` and web load.