# 83 — Production EC2/API Mode A Deploy (Task 10.23b)

**Date:** 2026-06-10  
**Status:** **GO** — DNS live; HTTPS API health Mode A PASS; staging regression PASS  
**Brand:** **Narraza** — *Build long fiction without losing the plot.*  
**Related:** [`docs/82`](82-production-infra-unblock-report.md), [`docs/81`](81-production-api-web-mode-a-deploy-report.md), [`.agent-logs/sprint-10/task-10.23b-production-ec2-api-mode-a-deploy.md`](../.agent-logs/sprint-10/task-10.23b-production-ec2-api-mode-a-deploy.md)

Task 10.23b complete. Production API live at `https://api.narraza.web.id`. **Payment NOT enabled.** **Migration `00010` NOT applied.**

---

## Final summary

```txt
Task 10.23b — Production EC2/API Mode A Deploy
Status: GO

DNS api.narraza.web.id -> 13.251.228.117 (8.8.8.8)
HTTPS /api/health: PASS Mode A
Staging regression: PASS
Payment: OFF | 00010: NOT APPLIED
```

---

## 1. AWS credentials

| Check | Result |
|---|---|
| Profile | `narraza-deploy` |
| Account | `691940691889` |
| Region | `ap-southeast-1` |

---

## 2. EC2 / EIP

| Item | Value |
|---|---|
| Instance ID | `i-0ddafd395696d2ab9` |
| Name | `narraza-production-api` |
| Elastic IP | **`13.251.228.117`** |
| Staging EC2 | **Not reused** (`13.212.245.32` unchanged) |

---

## 3. DNS

| Host | Result |
|---|---|
| `nslookup api.narraza.web.id 8.8.8.8` | **PASS** → `13.251.228.117` |
| `api-staging.narraza.web.id` | **Untouched** |

**Note:** Windows local resolver may lag; operator script falls back to `nslookup 8.8.8.8` and `curl --resolve` for verification.

---

## 4. HTTPS API health

**URL:** `https://api.narraza.web.id/api/health`

| Flag | Value |
|---|---|
| `ok` | `true` |
| `appEnv` | `production` |
| `creditTopupEnabled` | `false` |
| `paymentProviderMock` | `true` |
| `paymentProvider` | `mock` |
| `aiGenerationEnabled` | `false` |

Verified via `operator:production:aws:deploy` (SkipEc2Deploy, SkipWebDeploy) after DNS propagation.

---

## 5. Staging regression

| Check | Result |
|---|---|
| `api-staging.narraza.web.id/api/health` | **PASS** Mode A |
| Staging DB/EC2 | **Not touched** |

---

## 6. Security

| Item | Result |
|---|---|
| Payment enabled | **NO** |
| Migration `00010` | **NOT applied** |
| Secrets exposed | **NO** |

---

## 7. Go / Partial / Blocked / No-Go

| Level | Verdict |
|---|---|
| **GO** | All 10.23b criteria met |

---

## Next recommended task

**10.23c complete** — [`docs/84`](84-production-app-custom-domain-verify-report.md): `app.narraza.web.id` verified **GO**. Mode A API/app path closed.

**Next (founder approval):** homepage/landing on apex `narraza.web.id` per [`docs/82`](82-production-infra-unblock-report.md) Option A.

Do **not** enable payment, apply `00010`, or Duitku production without separate approval.