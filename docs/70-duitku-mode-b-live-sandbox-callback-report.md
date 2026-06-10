# 70 — Duitku Mode B Live Sandbox Callback Report (Task 10.13b)

**Date:** 2026-06-09 (updated 2026-06-10 — Task 10.13c **GO**)  
**Status:** Closed — **GO** (BCA VA sandbox callback path)  
**Verdict:** Live sandbox `createInvoice` → BCA VA UI payment → real Duitku HTTPS callback → HMAC-validated grant **PASS**; ShopeePay pre-fix failure resolved by HMAC formula in [`docs/71`](71-duitku-real-callback-signature-debug-report.md) (SP not re-tested; MVP can prioritize VA)  
**Related:** [`docs/58`](58-duitku-callback-idempotent-grant-report.md), [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md), [`docs/71`](71-duitku-real-callback-signature-debug-report.md), [`.agent-logs/sprint-10/task-10.13b-duitku-mode-b-live-sandbox.md`](../.agent-logs/sprint-10/task-10.13b-duitku-mode-b-live-sandbox.md), [`.agent-logs/sprint-10/task-10.13c-duitku-real-callback-signature-debug.md`](../.agent-logs/sprint-10/task-10.13c-duitku-real-callback-signature-debug.md)

Sandbox-only verification for **Narraza** staging on `https://api-staging.narraza.web.id`. Production untouched.

---

## 1. Goal and scope

End-to-end Duitku POP sandbox: `createInvoice` → `paymentUrl` → callback → grant once → duplicate safe → negatives → rollback Mode A.

---

## 2. Brand / domain context

| Item | Value |
|---|---|
| Brand | **Narraza** — *Build long fiction without losing the plot.* |
| API | `https://api-staging.narraza.web.id` |
| Web | `https://vibenovel-web-staging.pages.dev` |
| Callback | `https://api-staging.narraza.web.id/api/payments/duitku/callback` |

---

## 3. Endpoint tested

`https://api-staging.narraza.web.id` (AWS EC2 HTTPS, Caddy + Let's Encrypt)

---

## 4. Preflight Mode A status

Before Mode B: `creditTopupEnabled=false`, `paymentProviderMock=true`, `paymentProvider=mock` — **PASS**

---

## 5. Sandbox credential status

| Item | Result |
|---|---|
| Operator `.env.staging.duitku` | **PASS** (bootstrapped from commented `DUITKU_*` in gitignored `.env.staging`) |
| EC2 deploy includes merchant code/key | **PASS** (after deploy merge fix) |
| Health `hasDuitkuMerchantCode/Key` | **true** in Mode B |

---

## 6. Duitku callback registration status

Callback URL documented for sandbox dashboard registration. Operator confirmed sandbox setup; **Duitku-initiated POST after UI payment not captured** in agent session.

---

## 7. Mode B env status

| Flag | Mode B |
|---|---|
| `creditTopupEnabled` | `true` |
| `paymentProvider` | `duitku` |
| `paymentProviderMock` | `false` |
| `hasDuitkuCallbackUrl` | `true` |
| `duitkuCallbackUrlIsPublic` | `true` |

Deploy: `npm run operator:aws:duitku:gate -- -Mode apply`

---

## 8. Invoice / create checkout result

| Item | Result |
|---|---|
| LiveCreate sandbox checkout | **PASS** |
| Provider | `duitku` |
| Domain | `app-sandbox.duitku.com` |
| Order (sanitized) | `0c0818e1-…` pending → paid |
| Amount | 39000 IDR / 100 credits (starter) |
| `paymentUrl` | **present** |
| Pre-grant balance | **0** (no grant before callback) |
| Idempotency replay | **PASS** |

---

## 9. Sandbox payment result

| Item | Result |
|---|---|
| Duitku UI / simulator auto-complete | **NOT RUN** — requires manual sandbox UI step |
| Polling after page fetch | Order remained `pending` |

---

## 10. Callback delivery result

| Item | Result |
|---|---|
| Duitku server POST after UI payment | **NOT VERIFIED** |
| Signed sandbox-shaped POST to AWS HTTPS | **PASS** — grant `balance 0→100`, order `paid` |

---

## 11. Credit grant result

| Item | Result |
|---|---|
| Grant exactly once | **PASS** |
| Balance after | **100** credits |
| Ledger | **1** topup entry |
| Order status | `paid` |

---

## 12. Duplicate callback replay

| Item | Result |
|---|---|
| Replay same paid payload | `duplicate=true`, `granted=false` |
| Balance unchanged | **100→100** |

---

## 13–16. Negative tests (AWS Mode B)

| Test | Result |
|---|---|
| Invalid signature | **PASS** — `failed=true`, no grant |
| Amount mismatch | **PASS** — `reason=amount_mismatch` |
| Unknown order | **PASS** — `reason=order_not_found` |
| Non-paid `resultCode` | **PASS** — `ignored=true`, no grant |

---

## 17. Rollback to Mode A

| Item | Result |
|---|---|
| `npm run operator:aws:duitku:gate -- -Mode rollback` | **PASS** |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |

---

## 18. Cloudflare fallback regression

`https://vibenovel-api-staging.moxsenna.workers.dev/api/health` — **PASS**

---

## 19. Security / secrets notes

- No merchant keys committed or logged in docs.
- Credentials in gitignored `.env.staging.duitku` only.
- Production payment/dashboards not touched.

---

## 20. Files changed

| Path | Note |
|---|---|
| `scripts/operator-aws-duitku-mode-b.ps1` | Deploy merge fix, `hasDuitkuCode/Key` gate, `-SkipRollback` |
| `scripts/lib/bootstrap-duitku-operator-env.ps1` | Bootstrap `.env.staging.duitku` |
| `scripts/sprint10-duitku-smoke-api.ps1` | Staging merchant for fixture matrix |
| `scripts/lib/duitku-*.ps1` | Callback matrix / poll helpers (operator) |
| `.env.staging.duitku.example`, `.gitignore` | Operator template |

---

## 21. Go / Partial / Blocked / No-Go (updated Task 10.13c)

| Level | Verdict |
|---|---|
| **GO** | **YES** — BCA VA real callback + HMAC grant verified (order `b98dfc22-…`) |
| **PARTIAL GO** | N/A |
| **BLOCKED** | **NO** |
| **NO-GO** | **NO** |

---

## 22. Remaining note (non-blocking)

ShopeePay (`SP`) failed pre-HMAC fix; likely same 64-hex HMAC as BCA VA. Not re-tested post-fix. MVP can prioritize BCA VA channel — see [`docs/71`](71-duitku-real-callback-signature-debug-report.md).

---

## 23. Next recommended task

**Task 10.14 — Payment Provider Decision Report** (founder approved). Duitku has strongest MVP sandbox evidence vs Mayar.

Operator commands:

```powershell
# Bootstrap creds once (if only in commented .env.staging)
powershell -File scripts/lib/bootstrap-duitku-operator-env.ps1

npm run operator:aws:duitku:gate -- -Mode apply -SkipRollback
npm run operator:aws:duitku:gate -- -Mode smoke -LiveCreate -SkipRollback -TestEmail staging-smoke@vibenovel.test
# Complete payment in Duitku sandbox UI, then:
npm run operator:aws:duitku:gate -- -Mode smoke -ExpectCallback -SkipRollback -TestEmail staging-smoke@vibenovel.test
npm run operator:aws:duitku:gate -- -Mode rollback
```

---

## Final summary

```txt
Task 10.13b — Duitku Mode B Live Sandbox Callback
Status: GO (BCA VA path; Task 10.13c HMAC fix)

Endpoint: https://api-staging.narraza.web.id

Mode before: Mode A safe
Mode during: Mode B duitku sandbox
Mode after rollback: Mode A safe (2026-06-10)

Invoice/paymentUrl: PASS (LiveCreate, app-sandbox.duitku.com)
Callback: PASS real BCA VA Duitku POST + HMAC validation (docs/71)
Credit grant: PASS once (real UI path + fixture matrix)
Duplicate replay: PASS
Negative tests: PASS (invalid sig, amount mismatch, unknown order, non-paid)
Rollback: PASS
Cloudflare fallback: PASS
```