# 71 — Duitku Real Callback Signature Debug Report (Task 10.13c)

**Date:** 2026-06-10  
**Status:** Closed — **GO**  
**Related:** [`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md), [`docs/59`](59-duitku-sandbox-live-smoke-report.md), [`docs/58`](58-duitku-callback-idempotent-grant-report.md), [`.agent-logs/sprint-10/task-10.13c-duitku-real-callback-signature-debug.md`](../.agent-logs/sprint-10/task-10.13c-duitku-real-callback-signature-debug.md)

Sandbox-only signature investigation on Narraza AWS staging (`https://api-staging.narraza.web.id`). Production untouched. No merchant keys or full signatures logged.

---

## 1. Goal

Explain why **real Duitku sandbox callbacks** (`resultCode=00`) were rejected as `invalid_signature`, while **operator-signed POSTs** granted. Fix validator without weakening security. Prove real UI callback path for MVP channel (BCA VA).

---

## 2. Root cause (proven)

| Issue | Detail |
|---|---|
| **Wrong formula (initial impl)** | `md5(merchantCode + amount + merchantOrderId + merchantKey)` → 32 hex (legacy PHP doc / smoke fixtures) |
| **Real Duitku server callback** | `HMAC_SHA256(merchantCode + amount + merchantOrderId, merchantKey)` → **64 hex** lowercase |
| **Proof** | BCA VA real callback `signatureReceivedPrefix=4f0ae309` matches computed HMAC prefix; length 64 |

ShopeePay (`SP`) order `2fbe48f5-…` failed with same MD5 validator before fix; signature not stored pre-diagnostic. **Likely same HMAC scheme** — not separately re-tested after fix; MVP can prioritize BCA VA.

---

## 3. Real BCA VA callback (sanitized) — GO evidence

| Field | Value |
|---|---|
| Order / `merchantOrderId` | `b98dfc22-1f0b-41fb-a68b-3874b2a356fe` |
| Webhook (initial failure) | `bbc25752-ed6f-4782-852a-d87eb2b43119` → `invalid_signature` (pre-HMAC fix) |
| `reference` | `DS3157626KVUR723DNXVWUTB` |
| `merchantCode` | `DS31576` |
| `amount` | `39000` |
| `resultCode` | `00` |
| `paymentCode` | `BC` (BCA VA) |
| `signatureReceivedLength` | **64** |
| `signatureReceivedPrefix` | `4f0ae309` |
| HMAC candidate prefix | `4f0ae309` **MATCH** |
| Duitku `transactionStatus` | `statusCode=00`, `amount=39000` |
| Post-fix grant | Order **paid**, balance 1200→1300 (+100 credits) |

**Extra BCA VA field names (non-secret):** `additionalParam`, `merchantUserId`, `publisherOrderId`, `settlementDate`, `sourceAccount`, `vaNumber` (parsed via `fieldNames` diagnostic; not part of HMAC string-to-sign).

---

## 4. Chosen validator change

`apps/api/src/services/duitku-callback.ts`:

| Signature length | Algorithm |
|---|---|
| **64 hex** | `HMAC_SHA256(merchantCode + amount + merchantOrderId, merchantKey)` — **real Duitku** |
| **32 hex** | `md5(merchantCode + amount + merchantOrderId + merchantKey)` — legacy smoke fixtures |

Invalid length or mismatch → `invalid_signature`, no grant. Diagnostics persist safe prefixes on failure.

---

## 5. Code / tooling changes

| Path | Change |
|---|---|
| `apps/api/src/services/duitku-callback.ts` | HMAC validator + `DUITKU_POP_CALLBACK_HMAC_FORMULA`; async diagnostics |
| `apps/api/src/services/process-duitku-payment-callback.ts` | Await HMAC validation; persist `signatureDiagnostic` on failure |
| `apps/api/scripts/duitku-callback-signature.test.mts` | BCA VA HMAC + legacy MD5 fixtures |
| `scripts/sprint10-duitku-smoke-api.ps1` | Fixture signatures use HMAC (64 hex) |
| `scripts/lib/duitku-send-paid-callback.ps1` | HMAC signing for operator replay |
| `scripts/lib/duitku-inspect-webhook.ps1`, `duitku-delete-webhook.ps1` | Operator inspect / cleanup |

---

## 6. Verification

| Step | Result |
|---|---|
| `npm run test:duitku-signature -w @vibenovel/api` | **PASS** |
| `npm run typecheck` | **PASS** |
| Real BCA VA callback received on AWS HTTPS | **PASS** |
| HMAC prefix match (`4f0ae309`) | **PASS** |
| Order grant after fix (`b98dfc22-…`) | **PASS** |
| Fixture matrix (HMAC smoke) | **PASS** |
| Rollback Mode A (`2026-06-10`) | **PASS** |

Post-rollback health (`GET /api/health`):

- `creditTopupEnabled=false`
- `paymentProviderMock=true`
- `paymentProvider=mock`
- `aiGenerationEnabled=false`

---

## 7. Security notes

- Merchant key, full signatures, and service role never logged.
- `.env.staging.duitku` not committed.
- Invalid signatures still fail closed.
- Diagnostics: 8-char prefixes only.

---

## 8. Verdict

| Level | Result |
|---|---|
| **GO** | **YES** — root cause proven; HMAC fix deployed; real BCA VA callback validated; grant once |
| **PARTIAL GO** | N/A (superseded) |
| **BLOCKED** | **NO** |
| **NO-GO** | **NO** |

---

## 9. Remaining note (non-blocking for MVP)

- **ShopeePay (`SP`)** likely uses same 64-hex HMAC (same Duitku POP stack); not re-run after fix.
- MVP recommendation: prioritize **BCA VA** in checkout UX / `paymentMethod` if channel selection is added.

---

## 10. Next task

**Task 10.14 — Payment Provider Decision Report** (founder approved). Duitku has strongest MVP evidence vs Mayar.