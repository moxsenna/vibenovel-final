# 45 — Sprint 8 Verification Report

**Sprint:** Sprint 8 — AI/OpenRouter & Credit-Gated Generation  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/43-pre-ai-hardening-verification-report.md`](43-pre-ai-hardening-verification-report.md), [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)

Dokumen ini adalah **laporan penutupan resmi Sprint 8** (Task 8.0–8.7). Mencakup verifikasi AI/OpenRouter shell, credit-gated prose beat generation, WritePage AI button, smoke matrix, dan keputusan gate. Bukan implementasi baru — hanya dokumentasi penutupan.

**Work logs:** `.agent-logs/sprint-8/task-8.0-ai-openrouter-credit-generation-plan.md` … `task-8.7-sprint-8-verification-report.md`

---

## 1. Sprint 8 Summary

### Tujuan Sprint 8

Memperkenalkan **AI generation production secara aman** untuk Write Room: prose beat generation credit-gated via model router abstraction, dengan OpenRouter sebagai provider shell (mock untuk lokal), tanpa mutasi canon langsung.

### Status akhir

Sprint 8 **siap ditutup**. MVP prose beat generation end-to-end (API + WritePage button) terverifikasi dengan mock provider. AI **disabled by default** di lingkungan dev lokal.

### Scope yang selesai

| Task | Deliverable | Status |
|---|---|---|
| **8.0** | Rencana implementasi (`docs/44`) | ✅ |
| **8.1** | Migration `00008`, `generation_attempts`, `credit_ledger`, shared types | ✅ |
| **8.2** | `model-router`, `openrouter-client`, `mock-ai-provider` | ✅ |
| **8.3** | `ai-credit-policy`, `credit-ledger` (internal) | ✅ |
| **8.4** | `POST /api/projects/:id/ai/generate-prose` | ✅ |
| **8.5** | WritePage `Tulis Beat dengan AI` button | ✅ |
| **8.6** | Safety smoke + regression (API mock modes + web E2E) | ✅ |
| **8.7** | Laporan verifikasi ini (`docs/45`) | ✅ |

### Scope yang deferred

| Item | Policy |
|---|---|
| Prose rewrite / improve AI | Sprint 9+ (Task 8.4b) |
| Publish copy AI | Sprint 9+ |
| Summary / delta AI extraction | Sprint 9+ (butuh validator kuat) |
| Topup / payment / credit purchase UI | Out of scope |
| Live OpenRouter production test | Task 8.9b **GO** [`docs/47`](47-live-openrouter-staging-smoke-report.md); production deploy still separate |
| True Postgres RPC untuk credit+attempt | Before production deploy |
| CI API-mode E2E | Deferred (7.8.5) |
| Remote deploy / remote migration push | Not done |

---

## 2. Architecture Added

### Database (migration `00008`)

- **`generation_attempts`** — lifecycle setiap panggilan AI; `prompt_hash` only; link ke `context_packet_logs`, `writing_sessions`, `chapter_beats`
- **`credit_ledger`** — append-only debit/refund rows per attempt; idempotency via `(user_id, attempt_id, reason, direction)`
- **`credit_balances`** — existing table; read via `GET /api/credits/balance`; no public mutation endpoint
- Audit enum extensions: `generation_attempt_created`, `generation_attempt_succeeded`, `generation_attempt_failed`, `ai_output_persisted`, `credit_debited`, `credit_refunded`

### Shared package

- Enums: `GENERATION_TYPES`, `GENERATION_STATUSES`, `CREDIT_LEDGER_DIRECTIONS`
- Types: `GenerationAttempt`, `CreditLedgerEntry`, `CreditBalance`, safe `GenerationAttemptSafeSummary`

### API services

| Service | Role |
|---|---|
| `model-router.ts` | Allowlist, quality tier → model, `generateWithModelRouter` gate |
| `openrouter-client.ts` | OpenRouter `/chat/completions` shell — timeout, safe errors, no key/body logging |
| `mock-ai-provider.ts` | Deterministic local output; modes `success`, `fail_provider`, `unsafe_output` |
| `ai-credit-policy.ts` | Fixed `getCreditCostForGeneration` — client cannot override |
| `credit-ledger.ts` | `debitCreditsForAttempt`, `refundCreditsForAttempt`, idempotent ledger |
| `generation-attempt.ts` | Attempt CRUD lifecycle + audit writers |
| `prose-generation-prompt.ts` | Safe prompt from context packet log → `promptHash` |
| `prose-beat-generation.ts` | Route orchestration: packet → prompt → attempt → debit → provider → persist |
| `prose-draft.ts` | `saveAiGeneratedProseVersionForOwner` (internal only) |

### API route

- `POST /api/projects/:id/ai/generate-prose` — registered in `apps/api/src/routes/ai.ts`

### Web integration

- `apps/web/src/services/ai.ts` — `generateBeatProse`, cost labels, idempotency, error mapping
- `useWriteRoomData.ts` — `generateAiForActiveBeat`, AI state, quality mode from settings
- `WriterAssistantPanel.tsx` / `WriterMobileLayout.tsx` — button, cost, loading/error/success
- E2E: `apps/web/e2e/sprint8-write-ai-flow.spec.ts`
- Smoke: `scripts/sprint8-smoke-api.ps1`, `scripts/sprint8-smoke-web.ps1`

---

## 3. AI / Provider Boundary

| Rule | Status |
|---|---|
| OpenRouter key server-only (`OPENROUTER_API_KEY` in Worker env) | ✅ Enforced by design |
| No provider key in frontend | ✅ Verified — web never receives key |
| `AI_GENERATION_ENABLED=false` default | ✅ Restored after Task 8.6 verification |
| `AI_PROVIDER_MOCK=true` for local smoke | ✅ Used for all Sprint 8 verification |
| Live OpenRouter not tested | ✅ By design — mock provider only |
| No raw provider response exposed | ✅ Mapped to safe `AI_*` error codes |
| Model allowlist enforced | ✅ `MODEL_ALLOWLIST` in `model-router.ts` |
| Client cannot choose arbitrary model/provider/cost | ✅ Body rejects `model`, `provider`, `creditCost` |

`/api/health` exposes safe booleans only: `aiGenerationEnabled`, `aiProviderMock`, `hasOpenRouterApiKey`.

---

## 4. Credit Verification

### Fixed cost policy (`prose_beat`)

| Quality mode | Credit cost |
|---|---|
| hemat | 5 |
| seimbang | 10 |
| terbaik | 20 |

### Verified behaviors (Task 8.6 smoke)

| Behavior | Verified |
|---|---|
| Debit before provider call | ✅ |
| `402 INSUFFICIENT_CREDIT` when no balance row or low balance | ✅ |
| Refund on `AI_PROVIDER_ERROR` (mock `fail_provider`) | ✅ |
| Refund on `AI_OUTPUT_UNSAFE` (mock `unsafe_output`) | ✅ |
| Idempotent replay — no double debit | ✅ |
| No public credit mutation endpoint | ✅ — read-only `GET /api/credits/balance` |
| `credit_ledger` append-only concept | ✅ — debit + refund rows; no UPDATE delete |

### Known limitations

- **`monthly_used` not incremented** on debit — MVP fixed-cost policy only
- **Refund amount not validated against original debit** — trusts attempt `credit_cost`
- **True Postgres RPC / atomic BEGIN-COMMIT** deferred — uses transaction-like compensation pattern
- **New users without `credit_balances` row** receive `402` until seeded or granted

---

## 5. Generation Attempt Verification

### Lifecycle

```txt
pending → running (after debit) → succeeded | failed
```

| Field | Policy |
|---|---|
| `prompt_hash` | Stored — **no raw prompt** in DB/API/audit |
| `context_packet_log_id` | Linked to safe context packet build |
| `output_entity_type` | `chapter_prose_version` on success |
| `output_entity_id` | UUID of persisted prose version |
| `credit_cost` | Snapshot at attempt creation |

### Audit events (smoke-verified)

- `generation_attempt_created`
- `generation_attempt_succeeded`
- `generation_attempt_failed`
- `ai_output_persisted`

Metadata sanitized via `audit-snapshot.ts` — no prompt/packet_json/planningTruth.

---

## 6. Prose Persistence Boundary

| Rule | Status |
|---|---|
| `ai_generated` prose only via internal AI path | ✅ `saveAiGeneratedProseVersionForOwner` |
| Public `POST .../write/beats/:id/prose` rejects `ai_generated` from client | ✅ Sprint 5 smoke retained |
| No canon mutation on generation | ✅ Smoke: facts/characters/speech/open-loops/reveals/proposals unchanged |
| No `ai_proposals` created | ✅ Verified in smoke |
| No summary/publish automatic changes | ✅ By design |
| User can edit generated prose after insertion | ✅ Editor loads prose; user save uses `user_edited` |

---

## 7. WritePage Web Integration

| Feature | Behavior |
|---|---|
| Button label | **Tulis Beat dengan AI** (desktop assistant panel) |
| API mode only | `onGenerateAi` exposed when `source === "api"` |
| Mock/fallback | Button disabled + explanation (no fake AI) |
| Mobile | FAB AI control when API mode active |
| Loading | `Menghasilkan narasi…`; button disabled during request |
| Error | Safe Indonesian messages (`AI_DISABLED`, `INSUFFICIENT_CREDIT`, etc.) |
| Success | Prose in editor + notice with credit deducted / remaining |
| Credit cost label | `Biaya: N kredit` from `ai-credit-policy` mirror |
| Quality mode | From project settings; fallback `seimbang` |
| Idempotency | New key per click: `${beatId}-${timestamp}-${random}` |

Verified E2E (Task 8.6): mock prose in editor on success; `AI_DISABLED` message when env off.

---

## 8. Safety / Leak Guard Verification

| Guard | API smoke | Web E2E |
|---|---|---|
| No raw prompt in response/metadata/DOM | ✅ | ✅ |
| No `packet_json` | ✅ | ✅ |
| No `planningTruth` / `planning_truth` | ✅ | ✅ |
| No raw context packet in API response | ✅ | ✅ |
| No provider raw body | ✅ | N/A (mock) |
| No OpenRouter key | ✅ | ✅ |
| No token printed by smoke scripts | ✅ | ✅ |
| `contextPacketLogId` safe (not false-positive leak) | ✅ | ✅ |
| Output safety rejects `unsafe_output` mode | ✅ | N/A |

---

## 9. Smoke Test Summary

Results from Task 8.6 verification (8 Juni 2026). **No new smoke runs for Task 8.7** (docs-only).

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck` | **PASS** | shared + web + api |
| `npm run build:shared` | **PASS** | |
| `npm run build:web` | **PASS** | |
| `npm run build:api` | **PASS** | |
| `npm run smoke:api` | **PASS** 17/17 | Sprint 2 regression |
| `npm run smoke:api:sprint5` | **PASS** 49/49 | Write Room |
| `npm run smoke:api:sprint6` | **PASS** 68/68 | Summary/delta |
| `npm run smoke:api:sprint7` | **PASS** 53/53 | Publish |
| `npm run smoke:api:sprint8` (success) | **PASS** 18 PASS | AI enabled + mock success |
| `npm run smoke:api:sprint8 -- -MockMode fail_provider` | **PASS** 14 PASS | Refund verified |
| `npm run smoke:api:sprint8 -- -MockMode unsafe_output` | **PASS** 14 PASS | Refund + no prose |
| `npm run smoke:web:write` | **PASS** | Mock |
| `npm run smoke:web:write-ai` | **PASS** | Mock — AI inactive |
| `npm run smoke:web:write-ai -- -IncludeApiMode` (AI on) | **PASS** | Success E2E |
| `npm run smoke:web:write-ai -- -IncludeApiMode` (AI off) | **PASS** | Disabled E2E |

**Prerequisites:** Docker + `supabase start`, `dev:api`, `dev:web`, Playwright chromium. Full Sprint 8 AI matrix requires manual `dev:api` restart per mock mode.

---

## 10. Smoke Orchestration Status

| Item | Status |
|---|---|
| `smoke:all:local` includes Sprint 8 API baseline (phase 5) + write-AI web mock (phase 11) | ✅ 11 phases total |
| `smoke:all:local` does **not** run all Sprint 8 success/fail/unsafe modes by default | By design — stable with `AI_GENERATION_ENABLED=false` |
| Full Sprint 8 AI verification | Manual env switch + restart `dev:api` per mode (documented in `scripts/README.md`) |
| API-mode E2E | Local/manual only — **not** in GitHub Actions |

---

## 11. Env Final State

After Task 8.6 verification, local `apps/api/.dev.vars` (gitignored) restored to:

```txt
AI_GENERATION_ENABLED=false
AI_PROVIDER_MOCK=true
AI_PROVIDER_MOCK_MODE=success
```

Confirmed: `GET /api/health` → `aiGenerationEnabled=false`.

No secret values committed to repository.

---

## 12. Known Limitations

| Limitation | Impact |
|---|---|
| Live OpenRouter not tested | Production provider behavior unknown until Task 8.8 |
| No rewrite AI endpoint | User must edit prose manually post-generation |
| No publish copy AI | Publish flow unchanged from Sprint 7 |
| No summary/delta AI | Stub generators unchanged |
| No topup/payment | Credit must be seeded/granted for local smoke |
| No credit balance widget on WritePage | Notice on success only; Settings page has balance |
| Users without `credit_balances` row → 402 | Expected until grant flow exists |
| True DB transaction/RPC for credit | Compensation pattern only — P1 before production |
| API-mode AI E2E not in GitHub Actions | Manual discipline for web verification |
| Remote deploy / remote migration push | Not performed |

---

## 13. Closure Decision

| Question | Answer |
|---|---|
| **Sprint 8 ready to close?** | **YES** |
| **Blockers** | None for Sprint 8 MVP closure |
| **Non-blocking limitations** | Live OpenRouter, rewrite/publish AI, credit UI, true RPC, CI E2E |

**Closure statement:** Sprint 8 AI/OpenRouter shell + credit-gated prose beat generation + WritePage AI button is **closed** for MVP scope. Production AI deploy requires Task 8.8 (live OpenRouter staging plan) before enabling `AI_GENERATION_ENABLED=true` in any shared environment.

---

## 14. Recommended Next Task

### Task 8.8 — Live OpenRouter Staging Verification Plan ✅

**Plan complete:** [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md) (8 Juni 2026). Docs-only — live OpenRouter **not** tested in 8.8.

### Task 8.9 / 8.9b — Live OpenRouter Staging Smoke ✅

**Report:** [`docs/47-live-openrouter-staging-smoke-report.md`](47-live-openrouter-staging-smoke-report.md)  
- Task 8.9: NO-GO (no local key)  
- Task 8.9b: **GO** — live success + idempotency + debit; model `google/gemini-2.5-flash`

### Recommended next — Sprint 9 AI expansion planning

Rewrite / publish copy / credit UI — **after** staging Go (achieved 8.9b).

---

## Related documents

- [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)
- [`docs/43-pre-ai-hardening-verification-report.md`](43-pre-ai-hardening-verification-report.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md)
- [`docs/47-live-openrouter-staging-smoke-report.md`](47-live-openrouter-staging-smoke-report.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`scripts/README.md`](../scripts/README.md)