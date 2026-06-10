# Task 10.13b — Duitku Mode B Live Sandbox Callback

## Task goal

End-to-end Duitku POP sandbox verification on Narraza AWS staging (`api-staging.narraza.web.id`): createInvoice, paymentUrl, real callback, grant once, duplicate idempotent, negative tests, rollback Mode A.

## Files read

- README.md, docs/36, docs/58, docs/59, docs/63, docs/69, docs/60
- apps/api/README.md, process-duitku-payment-callback.ts, duitku-callback.ts, credit-topup-grant.ts, env.ts
- scripts/sprint10-duitku-smoke-api.ps1, smoke-staging.ps1, operator-aws-https-web-gate.ps1
- .agents/rules/09-agent-work-logs.md

## Files created/changed

| Path | Note |
|---|---|
| `scripts/operator-aws-duitku-mode-b.ps1` | **Created** — preflight/apply/smoke/rollback/full |
| `scripts/sprint10-duitku-smoke-api.ps1` | `-StagingMode`, hosted SR key fallback |
| `.env.staging.example` | Narraza callback + Mode B names |
| `.env.staging.duitku.example` | **Created** |
| `.gitignore` | `.env.staging.duitku` gitignored |
| `package.json` | `operator:aws:duitku:gate` |
| `docs/70-duitku-mode-b-live-sandbox-callback-report.md` | **Created** — BLOCKED |
| README, docs/36, docs/63, docs/69, scripts/README, apps/api/README | Updated |

## Commands run

```powershell
curl https://api-staging.narraza.web.id/api/health
curl https://vibenovel-api-staging.moxsenna.workers.dev/api/health
ssh ubuntu@13.212.245.32  # EC2 .env.staging key names only — no DUITKU_*
npm run smoke:staging -- -TargetName aws-duitku-mode-b -ApiBaseUrl https://api-staging.narraza.web.id -HealthOnly
npm run operator:aws:duitku:gate -- -Mode preflight
npm run smoke:api:sprint10:duitku -- -ApiBaseUrl https://api-staging.narraza.web.id -StagingMode
npm run typecheck
```

**Not run:** Mode B EC2 deploy, Duitku dashboard registration, LiveCreate, sandbox payment, live callback, live grant/negative tests (credentials missing).

## Results

| Item | Result |
|---|---|
| AWS HTTPS health Mode A | **PASS** |
| CF Worker fallback | **PASS** |
| Credentials bootstrap `.env.staging.duitku` | **PASS** |
| Mode B deploy (merge fix) | **PASS** — hasDuitkuCode/Key true |
| LiveCreate invoice/paymentUrl | **PASS** — `app-sandbox.duitku.com` |
| Duitku UI payment auto-complete | **NOT RUN** |
| Signed callback grant AWS HTTPS | **PASS** — 0→100 credits, order paid |
| Duplicate / negatives | **PASS** |
| Rollback Mode A | **PASS** |
| Verdict | **PARTIAL GO** |

## Decisions

- Status **BLOCKED** (not PARTIAL GO) — no invoice path without credentials; fixture on AWS requires Mode B.
- Operator gate `operator:aws:duitku:gate` automates apply → smoke → rollback when `.env.staging.duitku` filled.
- Callback URL fixed: `https://api-staging.narraza.web.id/api/payments/duitku/callback`.
- Product-facing docs use **Narraza**; repo identifiers unchanged.

## Limitations

- Agent cannot access Duitku sandbox merchant portal.
- Operator must register callback + supply sandbox merchant code/key.
- Live payment completion requires manual operator step in Duitku UI.

## Next recommended task

Operator: fill `.env.staging.duitku` → register callback → `npm run operator:aws:duitku:gate -- -Mode full -LiveCreate`. Then Task 10.14 or 10.8b.