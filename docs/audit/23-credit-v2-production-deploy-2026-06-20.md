# Credit System v2 Production Deploy

**Deployed at:** 2026-06-20 15:08 +07:00

**Founder approval:** direct production deploy requested in the Codex thread

**Deploy commit:** `380a2abaec10efb250b3e7427f367215e50dabf0`

The deploy commit combines the Credit System v2 closure with the latest
production edit/delete-project UI (`d4c5818`) so the release does not regress
the existing dashboard.

## Pre-deploy verification

- Credit System v2 launch gate: PASS.
- Database-backed billing smoke: 26 PASS.
- Typecheck/build/contracts: PASS.
- Lint: 0 errors, 44 pre-existing warnings.
- Production migration preflight: migrations `00017` through `00021` already
  applied.
- Product and historical-order foreign-key integrity: PASS.
- Production Supabase ref: `qjmbobvarspwvaalnjct`.
- Payment flag: OFF.

## Deployment

| Target | Command | Result |
|---|---|---|
| API | `npm run deploy:api:production:raw` | Worker version `0225cab5-69ce-4d2d-87af-82690ead56d2` |
| App | `npm run deploy:web:production` | `https://d3195bd4.narraza-web-production.pages.dev` |
| App custom domain | HTTP verification | `https://app.narraza.web.id` returned 200 |

The preview and custom domain both served:

`assets/index-QBI3mufT.js`

Cloudflare Pages listed the new production deployment with source commit
`380a2ab`.

## Post-deploy API health

`GET https://api.narraza.web.id/api/health` returned:

- `appEnv=production`
- `aiGenerationEnabled=true`
- `hasOpenRouterApiKey=true`
- `creditTopupEnabled=false`
- `paymentProvider=duitku`
- `paymentProviderMock=false`

Checkout remains unavailable because `creditTopupEnabled=false`. Existing
production Worker secrets were retained; this deployment did not rotate them.

## Residual verification

- No paid live OpenRouter generation was run.
- No authenticated production credit debit/refund smoke was run.
- Staging remains blocked on missing hosted migration credentials.
- Browser rendering automation could not start under the managed Windows
  process sandbox; HTTP, asset identity, Cloudflare deployment state, and API
  health were verified instead.
