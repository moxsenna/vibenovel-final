# Task 10.28 — AI Founder Test Mode on Production API

## Task goal

Enable limited AI generation for founder-only test on production API (Narraza) without payment, Duitku, or public beta AI access.

## Approval

```txt
APPROVE TASK 10.26 AI FOUNDER TEST MODE ONLY
```

## Files read

- docs/89, 88, 87, 86, 83, 79, 73, 77
- apps/api AI routes and prose-beat-generation
- scripts/operator-production-sync-env.ps1, operator-production-aws-deploy.ps1
- .env.production.example, docker-compose.production.yml

## Commands run

```powershell
# Health check
Invoke-RestMethod https://api.narraza.web.id/api/health

# OpenRouter model probe (local key, no print)
scripts/task-10.28-openrouter-probe.ps1

# EC2 env sync + API restart
scripts/operator-production-sync-env.ps1

# Founder credit seed + AI generation
scripts/task-10.28-founder-ai-test.ps1

# Credit/ledger verification
scripts/task-10.28-check-credits.ps1

# Workflow phase repair (one-off)
scripts/task-10.28-fix-workflow.ps1
```

## Results

| Step | Result |
|---|---|
| Approval gate | PASS |
| EC2 env AI enabled | PASS (sync-env) |
| Health after | `aiGenerationEnabled=true`, `hasOpenRouterApiKey=true`, payment mock |
| Founder credit seed | PASS — 50 credits `moxsenna@gmail.com` |
| First generation | FAIL — OpenRouter 404 on `google/gemma-2-9b-it`; credit refund OK |
| Fix `AI_MODEL_HEMAT` | PASS — `google/gemini-2.5-flash` |
| Second generation | PASS — real prose 1831 chars, 5 credits debited |
| Regression | PASS — homepage/app/login 200, staging health PASS |

## Decisions

1. Use `operator-production-sync-env.ps1` instead of full 10.23 deploy tarball (faster, env-only).
2. Override hemat model via `AI_MODEL_HEMAT` — do not change code default in this task.
3. Patch `workflow_phase=outline_locked` for founder project after partial bootstrap inconsistency.
4. Keep AI ON after test for founder window; document rollback.

## Limitations

- No browser UI smoke — API-only generation test.
- No founder-only middleware — any authed user with credits could generate.
- `.env.production` not committed.

## Status

**GO**