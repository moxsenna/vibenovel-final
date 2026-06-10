# 72 — Payment Provider Decision Report (Task 10.14)

**Date:** 2026-06-10  
**Status:** Closed — **GO**  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/53`](53-sprint-10-verification-report.md), [`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md), [`docs/71`](71-duitku-real-callback-signature-debug-report.md), [`docs/51`](51-mayar-sandbox-live-smoke-report.md), [`docs/54`](54-mayar-staging-live-execution-report.md), [`.agent-logs/sprint-10/task-10.14-payment-provider-decision-report.md`](../.agent-logs/sprint-10/task-10.14-payment-provider-decision-report.md)

Docs-only decision report for **Narraza MVP** payment provider selection. No production payment enabled. No code or deploy changes in this task.

**Staging (verified 2026-06-10):** `https://api-staging.narraza.web.id` — Mode A safe (`creditTopupEnabled=false`, `paymentProviderMock=true`, `paymentProvider=mock`, `aiGenerationEnabled=false`).

---

## 1. Executive decision

| Item | Decision |
|---|---|
| **Recommended MVP provider** | **Duitku POP** — **BCA VA-first** channel strategy |
| **Mayar** | **Secondary / backlog** — keep code path; do not prioritize until live sandbox callback proof on Narraza staging |
| **Production payment** | **NOT ENABLED** — conditional readiness only |
| **Staging payment sandbox** | Mode B used for proof only; **rolled back to Mode A** |

**Narraza is not production-payment GO.** Duitku has **staging GO for BCA VA callback path** only. Do not claim all Duitku channels verified.

---

## 2. Evidence — Mayar

Sources: [`docs/51`](51-mayar-sandbox-live-smoke-report.md), [`docs/54`](54-mayar-staging-live-execution-report.md), [`docs/53`](53-sprint-10-verification-report.md), Tasks 10.2–10.3d.

| Area | Status | Evidence |
|---|---|---|
| Checkout / client | **Implemented** | `POST /api/credits/topup/checkout`, Mayar client, topup UI redirect ([`docs/53`](53-sprint-10-verification-report.md) §10.2, 10.4) |
| Webhook / parser | **Fixture + local PASS** | `POST /api/payments/mayar/webhook`; parser fix `data.id` ≠ invoice id ([`docs/51`](51-mayar-sandbox-live-smoke-report.md)) |
| Sandbox create invoice | **NOT RUN live** | `hasMayarApiKey=false` in all live smoke sessions ([`docs/51`](51-mayar-sandbox-live-smoke-report.md), [`docs/54`](54-mayar-staging-live-execution-report.md)) |
| Real callback on Narraza staging | **NOT VERIFIED** | No public Mayar webhook on `api-staging.narraza.web.id`; Siklusio router replay local only (10.3d) |
| Grant / idempotency | **Local mock + dual-app PASS** | Fixture `payment.received`; Siklusio → VibeNovel forward once ([`docs/53`](53-sprint-10-verification-report.md) §10.3d) |
| Signature / auth confidence | **Low for production** | Mayar webhook HMAC verification **deferred** ([`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md)); no live payload capture |
| Rollback safety | **N/A live** | `MAYAR_MULTI_APP_ROUTER_ENABLED=false` default; dashboard stays Siklusio |
| **MVP readiness** | **NOT READY** | Live sandbox invoice + real server webhook unproven on staging |
| **Production-ready** | **NO** | Do not state Mayar production-ready |

**Mayar blockers (remaining):**

- No `MAYAR_API_KEY` in operator env for live smoke ([`docs/54`](54-mayar-staging-live-execution-report.md))
- No public webhook URL registered for Narraza staging Mayar path
- Siklusio staging router replay not executed on hosted stack
- Webhook signature verification not implemented/verified
- Task **10.8b** remains optional backlog if Mayar account becomes active

---

## 3. Evidence — Duitku

Sources: [`docs/56`](56-duitku-pop-provider-adapter-shell.md)–[`docs/71`](71-duitku-real-callback-signature-debug-report.md), [`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md).

| Area | Status | Evidence |
|---|---|---|
| POP adapter | **Implemented** | `duitku-pop-client.ts`, `PAYMENT_PROVIDER=duitku` ([`docs/56`](56-duitku-pop-provider-adapter-shell.md)) |
| createInvoice / paymentUrl | **Staging PASS** | LiveCreate `app-sandbox.duitku.com` ([`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md)) |
| Public callback | **PASS** | `https://api-staging.narraza.web.id/api/payments/duitku/callback` ([`docs/69`](69-aws-https-domain-and-web-to-aws-api-report.md)) |
| Fixture callback matrix | **PASS** | Task 10.12 + HMAC-updated smoke ([`docs/58`](58-duitku-callback-idempotent-grant-report.md), [`docs/71`](71-duitku-real-callback-signature-debug-report.md)) |
| Mode B AWS staging | **PASS** | Operator gate `operator:aws:duitku:gate` ([`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md)) |
| **BCA VA real callback** | **PASS** | `paymentCode=BC`, `resultCode=00`, order `b98dfc22-…` ([`docs/71`](71-duitku-real-callback-signature-debug-report.md)) |
| HMAC-SHA256 fix | **PASS** | `HMAC_SHA256(merchantCode+amount+merchantOrderId, merchantKey)` — 64 hex; prefix match `4f0ae309` |
| Grant exactly once | **PASS** | Real UI path + operator replay post-fix |
| Duplicate safety | **PASS** | Fixture + idempotent webhook rows |
| Negative tests | **PASS** | invalid sig, amount mismatch, unknown order, non-paid ([`docs/70`](70-duitku-mode-b-live-sandbox-callback-report.md)) |
| Rollback Mode A | **PASS** | 2026-06-10 |
| **ShopeePay (`SP`)** | **NOT RETESTED** post-HMAC fix | Pre-fix failure only; likely same HMAC — **not required for MVP** if VA-first |
| **All Duitku channels** | **NOT CLAIMED** | Only BCA VA real path verified |
| **MVP readiness (staging)** | **GO — BCA VA path** | Strongest live proof in repo |
| **Production-ready** | **NO** | Production merchant, domain, ops gates pending |

**Duitku gaps (non-blocking for MVP decision):**

- ShopeePay/QRIS/e-wallet channels not individually verified post-HMAC
- Production callback on `narraza.id` not configured
- Production Duitku merchant account not activated for Narraza
- [`docs/58`](58-duitku-callback-idempotent-grant-report.md) MD5 formula note superseded for **real** callbacks by [`docs/71`](71-duitku-real-callback-signature-debug-report.md) — implementation already dual-validates

---

## 4. Comparison matrix

| Criteria | Mayar | Duitku |
|---|---|---|
| Checkout URL | ✅ Code + UI; live invoice **NOT RUN** | ✅ LiveCreate staging **PASS** |
| Public callback | ❌ Not on Narraza staging; Siklusio local only | ✅ `api-staging.narraza.web.id` **PASS** |
| Sandbox create invoice | ❌ **NOT RUN** (no API key) | ✅ **PASS** |
| Real callback verified | ❌ **NOT RUN** | ✅ **PASS** (BCA VA) |
| Signature / auth confidence | ⚠️ Deferred HMAC; no live capture | ✅ HMAC-SHA256 proven (64 hex) |
| Grant exactly once | ✅ Local fixture / dual-app | ✅ Real + fixture **PASS** |
| Duplicate safety | ✅ Local dual-app | ✅ **PASS** |
| Negative tests | ✅ Fixture matrix | ✅ Fixture + staging **PASS** |
| Rollback safety | ✅ Router default off | ✅ Mode A rollback **PASS** |
| Operational complexity | ⚠️ Siklusio router dependency for shared Mayar dashboard | ✅ Direct callback URL per project |
| MVP readiness | ❌ **Not ready** | ✅ **Staging GO** (BCA VA) |
| Remaining blockers | API key, public webhook, live proof, signature verify | Prod merchant, prod domain, SP optional, ops gates |

---

## 5. MVP recommendation (detailed)

### Primary: Duitku POP, BCA VA-first

**Rationale:**

1. Only provider with **end-to-end live proof** on Narraza AWS staging: invoice → sandbox UI (BCA VA) → server callback → grant.
2. **Direct** callback to Narraza API — no Siklusio forwarder required for MVP.
3. **Documented, verified** callback authentication (HMAC-SHA256) after Task 10.13c.
4. Existing code path: provider abstraction, callback grant, topup UI, operator gates already built.

**MVP channel strategy:**

- Default user journey: Duitku hosted checkout → user selects **BCA Virtual Account** (or pre-select `paymentMethod=BC` in a future operator option — not required for this decision).
- Do **not** market ShopeePay/QRIS as supported until separately verified post-HMAC fix (optional backlog).

### Secondary: Mayar

- Retain Mayar client, webhook route, Siklusio forwarder for legacy/multi-app compatibility.
- Do **not** block MVP on Mayar live proof.
- Revisit only if business requires Mayar specifically or Duitku production onboarding fails.

### Explicit non-actions

- Do **not** enable `CREDIT_TOPUP_ENABLED=true` on production.
- Do **not** set `PAYMENT_PROVIDER=duitku` + `PAYMENT_PROVIDER_MOCK=false` on production without production checklist Go.
- Do **not** touch production payment dashboards.

---

## 6. Production readiness checklist (gated)

**Status: NOT READY** — all items required before production payment Go.

| # | Gate | Status |
|---|---|---|
| 1 | Production Duitku merchant account approved for Narraza | ⬜ Pending |
| 2 | Production callback URL on final domain (`narraza.id` or approved prod API host) | ⬜ Pending |
| 3 | Production secrets in server/secret store only (never repo) | ⬜ Pending |
| 4 | Founder Go + legal/terms/payment copy updated | ⬜ Pending |
| 5 | `CREDIT_TOPUP_ENABLED=true` only after explicit Go | ⬜ Blocked |
| 6 | `PAYMENT_PROVIDER=duitku`, `PAYMENT_PROVIDER_MOCK=false` on prod | ⬜ Blocked |
| 7 | BCA VA production low-value transaction test | ⬜ Pending |
| 8 | Duplicate callback replay — no double grant | ✅ Proven staging; repeat on prod |
| 9 | Invalid signature rejected | ✅ Proven |
| 10 | Amount mismatch rejected | ✅ Proven |
| 11 | Unknown order rejected | ✅ Proven |
| 12 | Refund/chargeback SOP | ⬜ Deferred ([`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md)) |
| 13 | Admin/order reconciliation view or manual SOP | ⬜ Deferred |
| 14 | Database backup / audit procedure | ⬜ Ops |
| 15 | Rollback procedure tested (`operator:aws:duitku:gate -Mode rollback`) | ✅ Staging PASS |
| 16 | Monitoring / safe logging (no secrets in logs) | ✅ Pattern established |
| 17 | True DB RPC atomic grant (optional hardening) | ⬜ P1 deferred |

**Production readiness verdict:** **NOT READY** — staging BCA VA proof is necessary but not sufficient.

---

## 7. Architecture notes (unchanged)

- **Grant path:** webhook/callback only — never redirect/return URL ([`docs/52`](52-sprint-10-payment-ops-and-safety-regression.md)).
- **Kill switch:** `CREDIT_TOPUP_ENABLED=false` default.
- **Staging safe default:** Mode A mock after every Mode B proof session.
- **Repo names:** VibeNovel/Novory historical; product-facing **Narraza**.

---

## 8. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | **YES** — decision documented; evidence accurate; production gated |
| **PARTIAL GO** | N/A |
| **BLOCKED** | **NO** |
| **NO-GO** | **NO** — no overclaim; no secrets; no production touch |

---

## 9. Next recommended task

**Task 10.15 — Duitku Production Payment Enable Plan (docs-only, gated)** — translate §6 checklist into operator runbook for `narraza.id`, including production callback registration, env matrix, and Go/No-Go ceremony. **Do not enable production payment** without founder approval.

Alternative engineering P1 (can parallelize after 10.15 plan): **atomic grant DB RPC** before production ([`docs/36`](36-non-blocking-technical-debt-and-deferred-items.md)).

Optional backlog (non-MVP): Task 10.8b Mayar live retry; ShopeePay post-HMAC retest; `paymentMethod=BC` LiveCreate operator flag.

---

## Final summary

```txt
Task 10.14 — Payment Provider Decision Report
Status: GO

Decision:
Recommended MVP provider: Duitku POP (BCA VA-first)
Mayar: secondary / backlog

Summary:
Duitku is the only provider with live Narraza staging proof for
createInvoice → real BCA VA callback → HMAC-validated grant.
Mayar has solid local/fixture implementation but no live sandbox
invoice or real webhook on staging. Production payment remains gated.

Evidence:
Mayar: checkout/webhook code ✅; live invoice/callback ❌; MVP ❌
Duitku: staging BCA VA GO ✅; HMAC fix ✅; production ❌

Remaining blockers:
- Production Duitku merchant + narraza.id callback
- Ops/legal/refund SOP/admin reconciliation
- ShopeePay optional verification
- Mayar live proof optional backlog

Production readiness: NOT READY
Reason: Staging proof complete for BCA VA only; production gates §6 open

Next recommended task:
Task 10.15 — Duitku Production Payment Enable Plan (docs-only, gated)
```