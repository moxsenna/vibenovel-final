# Task 10.13c — Duitku Real Callback Signature Debug

## Task goal

Debug real Duitku `invalid_signature` on UI callbacks; fix validator; prove BCA VA auto-grant; end staging Mode A.

## Status

**GO** (closed 2026-06-10)

## Root cause

Real Duitku callbacks use **HMAC_SHA256**(`merchantCode + amount + merchantOrderId`, `merchantKey`) → 64 hex. Initial impl used legacy **MD5** (32 hex).

BCA VA proof: received prefix `4f0ae309` = HMAC computed prefix. Order `b98dfc22-…` granted after fix.

## Files changed (final)

| Path | Note |
|---|---|
| `apps/api/src/services/duitku-callback.ts` | HMAC + MD5 dual validation; async diagnostics |
| `apps/api/src/services/process-duitku-payment-callback.ts` | Await validation |
| `apps/api/scripts/duitku-callback-signature.test.mts` | BCA HMAC + MD5 legacy |
| `scripts/sprint10-duitku-smoke-api.ps1` | HMAC fixture signatures |
| `scripts/lib/duitku-send-paid-callback.ps1` | HMAC operator replay |
| `scripts/lib/duitku-delete-webhook.ps1` | Staging webhook cleanup |
| `docs/71-duitku-real-callback-signature-debug-report.md` | **GO** report |
| `docs/70-duitku-mode-b-live-sandbox-callback-report.md` | Upgraded to **GO** (BCA VA path) |

## Commands run (final session)

```powershell
npm run operator:aws:duitku:gate -- -Mode apply -SkipRollback
npm run operator:aws:duitku:gate -- -Mode smoke -LiveCreate -SkipRollback -TestEmail staging-smoke@vibenovel.test
# Operator: BCA VA sandbox payment
npm run operator:aws:duitku:gate -- -Mode smoke -ExpectCallback -SkipRollback -TestEmail staging-smoke@vibenovel.test
powershell -File scripts/lib/duitku-inspect-webhook.ps1 -OrderId b98dfc22-1f0b-41fb-a68b-3874b2a356fe
npm run test:duitku-signature -w @vibenovel/api
# EC2 deploy HMAC fix (scp + docker build --no-cache)
powershell -File scripts/lib/duitku-delete-webhook.ps1 -WebhookId bbc25752-ed6f-4782-852a-d87eb2b43119
powershell -File scripts/lib/duitku-send-paid-callback.ps1 -OrderId b98dfc22-1f0b-41fb-a68b-3874b2a356fe
npm run operator:aws:duitku:gate -- -Mode rollback
curl.exe -s https://api-staging.narraza.web.id/api/health
```

## Results

| Item | Result |
|---|---|
| Real BCA VA callback `resultCode=00` | **PASS** |
| Signature 64 hex + HMAC prefix match | **PASS** |
| Grant after fix | **PASS** (paid, +100 credits) |
| ShopeePay re-test post-fix | **NOT RUN** (likely same HMAC; non-blocking MVP) |
| Rollback Mode A | **PASS** |
| Health post-rollback | **PASS** (mock, topup off, AI off) |
| Verdict | **GO** |

## Decisions

- Dual validator: 64 hex HMAC (Duitku real) + 32 hex MD5 (legacy fixtures).
- Task 10.13b upgraded to **GO** for BCA VA sandbox callback path ([`docs/70`](../docs/70-duitku-mode-b-live-sandbox-callback-report.md)).
- Next: **Task 10.14** Payment Provider Decision Report — Duitku strongest MVP evidence vs Mayar.

## Limitations

- ShopeePay not re-verified after HMAC fix; defer unless MVP requires e-wallet channel.