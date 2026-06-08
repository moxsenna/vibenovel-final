# 44 — Sprint 8: AI/OpenRouter & Credit-Gated Generation Implementation Plan

**Status:** Planning only — no migration, no API, no OpenRouter calls  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/43-pre-ai-hardening-verification-report.md`](43-pre-ai-hardening-verification-report.md)

Dokumen ini adalah **rencana Sprint 8** sebelum coding. Agent dan developer wajib membaca ini sebelum menulis migration `00008`, model router, credit ledger, atau mengaktifkan AI generation.

**Work log:** `.agent-logs/sprint-8/task-8.0-ai-openrouter-credit-generation-plan.md`

---

## 1. Sprint 8 Goal

### Tujuan

- Memperkenalkan **AI generation production secara aman** — pertama kali di Write Room (prose), kemudian opsional publish copy.
- Mengganti sebagian **deterministic/stub generation** dengan endpoint **credit-gated** yang memanggil provider via **model router abstraction**.
- Tetap menjaga **canon boundary**: output AI masuk draft/proposal/`chapter_prose_versions` saja — **tidak** langsung mutate `facts`, `characters`, `speech_rules`, outline locked rows, atau summary canon.
- **Credit deduction wajib** sebelum (atau atomically dengan) pemanggilan provider — tidak ada generasi gratis tanpa ledger trail.
- **OpenRouter** sebagai provider awal, tetapi semua kode aplikasi berbicara ke **model router** — bukan OpenRouter SDK langsung di route handler.

### Prasyarat terpenuhi (Sprint 7.8)

- Audit P0 + transaction-like P0 ✅ (`docs/43`)
- Context Packet builder + safety ✅ (`context-packet-builder.ts`, `context-packet-safety.ts`)
- `CHAPTER_PROSE_SOURCES.ai_generated` reserved; POST prose menolak source ini sampai Sprint 8 ✅
- `credit_balances` read-only hari ini — ledger belum ada ✅
- Smoke regression Sprint 2–7 ✅

---

## 2. Scope Sprint 8

### Area yang boleh AI (phased rollout)

| Phase | Capability | Sprint 8 scope | Notes |
|---|---|---|---|
| **A** | Beat prose generation | **In scope (P0)** | `POST` generate prose for active beat via context packet + model router |
| **B** | Prose rewrite / improve | **In scope (P1)** | Same session; user-selected version + instruction (bounded) |
| **C** | Publish copy improvement | **Optional (P2)** | `improve-publish-copy` on existing package fields — no auto-publish |
| **D** | Summary / delta AI extraction | **Deferred** | Stub `chapter-summary-generator` / `chapter-delta` tetap; butuh Instruction Compliance Validator kuat |
| **E** | Foundation / concept / outline AI | **Deferred / controlled** | Intake/concept/outline tetap stub atau manual; high canon risk |

### Rekomendasi urutan aman

```txt
A. prose beat generation     → Task 8.4 (core MVP)
B. rewrite prose             → Task 8.4b or 8.5 extension
C. publish copy improvement  → Task 8.5 optional / 8.6 if time
D. summary/delta AI          → Sprint 9+ after validator
E. upstream outline/foundation AI → Sprint 9+ with stricter gates
```

### Generation types (shared enum — planned)

| `generation_type` | Phase | Credit tier |
|---|---|---|
| `prose_beat` | A | Base cost × quality mode multiplier |
| `prose_rewrite` | B | Slightly higher (longer context) |
| `publish_copy` | C | Fixed lower cost |
| `summary_delta` | D deferred | TBD |

---

## 3. Out of Scope

| Item | Policy |
|---|---|
| Direct canon mutation by AI | AI tidak menulis ke `facts` / `characters` / `speech_rules` / locked outline |
| Autonomous proposal accept | User must explicitly accept/reject via existing Sprint 6 flow |
| Auto-publish KBM | Manual copy + `mark-exported` only (Sprint 7 design) |
| Unlimited generation | Credit gate + per-project rate limits (plan) |
| Secret logging | No API keys, JWT, raw prompt, `packet_json` in logs/audit |
| Provider key in client | `OPENROUTER_API_KEY` Worker-only (`apps/api/.dev.vars`) |
| Background worker queue | Out of scope unless separate task; synchronous Worker call for MVP |
| Remote deploy / remote migration push | Local dev only until Sprint 8 verification |
| True Postgres RPC for credit+attempt | Transaction-like hardening acceptable for MVP; RPC before production |

---

## 4. Database Design Proposal

**Migration file (future):** `supabase/migrations/00008_sprint8_ai_generation_credit.sql`  
**Task:** 8.1 — not created in 8.0.

### New enums (proposed)

```txt
generation_type:     prose_beat, prose_rewrite, publish_copy, summary_delta (reserved)
generation_status:   pending, running, succeeded, failed, cancelled
credit_ledger_direction: debit, credit, refund
```

### Table: `generation_attempts`

Append-only lifecycle record per AI call (one row per idempotent attempt).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → projects | RLS owner |
| `user_id` | uuid FK → profiles | Who initiated |
| `chapter_outline_id` | uuid FK nullable | Write/publish context |
| `beat_id` | uuid FK nullable | `chapter_beats.id` for prose |
| `writing_session_id` | uuid FK nullable | Session gate |
| `generation_type` | enum | `prose_beat`, etc. |
| `status` | enum | `pending` → `running` → terminal |
| `idempotency_key` | text UNIQUE per user | Client header or derived UUID; prevents double debit |
| `provider` | text | e.g. `openrouter` — not secret |
| `model` | text | Resolved model id from router — safe to store |
| `prompt_hash` | text | SHA-256 of canonical prompt payload — **not raw prompt** |
| `context_packet_log_id` | uuid FK nullable | Link to `context_packet_logs` |
| `input_tokens` | int nullable | From provider response when available |
| `output_tokens` | int nullable | |
| `estimated_cost_usd` | numeric nullable | Internal accounting optional |
| `credit_cost` | int NOT NULL | Fixed debit amount for this attempt |
| `error_code` | text nullable | AppError code or provider mapped code |
| `error_message_safe` | text nullable | Truncated, no stack/secrets |
| `output_entity_type` | text nullable | e.g. `chapter_prose_version` |
| `output_entity_id` | uuid nullable | Persisted output id on success |
| `metadata` | jsonb | Redacted: qualityMode, beatNumber, retryCount — no prompt |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Status transitions |

**Indexes:** `(project_id, created_at DESC)`, `(user_id, idempotency_key)`, `(status)` where running (stale cleanup later).

### Table: `credit_ledger`

Append-only ledger — source of truth for credit mutations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `project_id` | uuid FK nullable | Context |
| `attempt_id` | uuid FK nullable → generation_attempts | Links debit/refund to attempt |
| `amount` | int NOT NULL | Always positive magnitude |
| `direction` | enum | `debit`, `credit`, `refund` |
| `reason` | text | e.g. `prose_beat_generation`, `provider_failure_refund` |
| `balance_after` | int NOT NULL | Snapshot after this row applied |
| `metadata` | jsonb | generationType, idempotencyKey — redacted |
| `created_at` | timestamptz | Immutable |

**Indexes:** `(user_id, created_at DESC)`, `(attempt_id)`.

### Optional tables (deferred unless needed)

| Table | Verdict |
|---|---|
| `model_router_configs` | **Defer** — use env + code allowlist for MVP |
| `ai_generation_outputs` | **Defer** — reuse `chapter_prose_versions` + `generation_attempts.output_entity_id` |
| `provider_request_logs` | **Defer** — attempt row + redacted metadata sufficient; no raw request body |

### Relation to `credit_balances`

Existing table (`00001`):

```txt
credit_balances: user_id UNIQUE, balance, monthly_quota, monthly_used, reset_at, source
```

**MVP strategy:**

- `credit_balances.balance` remains **cached current balance** for fast reads (`GET /api/credits/balance`).
- Every mutation writes **both**:
  1. `credit_ledger` row (append-only audit trail)
  2. `UPDATE credit_balances SET balance = balance - :amount` (or + for refund)
- `balance_after` on ledger must match post-update `credit_balances.balance`.
- **Atomicity:** Postgres RPC `debit_credits_for_attempt(user_id, amount, attempt_id, reason)` preferred in 8.1; fallback: transaction-like service hardening (debit → on failure refund) matching Sprint 7.8 pattern.
- `monthly_quota` / `monthly_used` — increment `monthly_used` on debit for MVP; full quota reset job deferred.

### Audit enum extension (planned 8.1)

Add to migration `00008` or `00009`:

```txt
generation_attempt_created, generation_attempt_succeeded, generation_attempt_failed,
credit_debited, credit_refunded, ai_output_persisted
```

Entity types: `generation_attempt`, `credit_ledger_entry` (or reuse `credit_balance` for debit events).

---

## 5. Credit Deduction Strategy

### Principles

| Rule | Detail |
|---|---|
| Preflight check | `balance >= credit_cost` before creating `running` attempt |
| Debit timing | **Debit before provider call** (MVP fixed cost per `generation_type` × quality multiplier) |
| Refund | **Refund if provider/network fails** before usable output persisted |
| No refund on dislike | User edits/rejects output after success — credit consumed (document in UI) |
| Idempotency | `Idempotency-Key` header → unique per user; replay returns same attempt result, **no double debit** |
| Double-click | DB unique on `(user_id, idempotency_key)` + short-lived `running` lock per beat optional |
| Insufficient credit | HTTP **402 Payment Required** or **409 Conflict** with `INSUFFICIENT_CREDIT` — prefer **402** for clarity |
| Token unknown | Fixed credit cost regardless of actual tokens for MVP; log `input_tokens`/`output_tokens` for analytics only |
| Ledger | Append-only; never UPDATE ledger rows |

### MVP credit cost table (proposed — tunable via env)

| `generation_type` | Base credits | × `hemat` | × `seimbang` | × `terbaik` |
|---|---|---|---|---|
| `prose_beat` | 10 | 0.8 | 1.0 | 1.5 |
| `prose_rewrite` | 8 | 0.8 | 1.0 | 1.5 |
| `publish_copy` | 5 | 0.8 | 1.0 | 1.2 |

Rounded up to integer. Config in `apps/api` constants or env `AI_CREDIT_COST_PROSE_BEAT` etc.

### Failure refund flow

```txt
1. Debit succeeded, attempt = running
2. Provider timeout / 5xx / network error
3. No prose version created
4. INSERT credit_ledger direction=refund, amount=same as debit
5. UPDATE credit_balances balance += amount
6. attempt status = failed, error_code = PROVIDER_ERROR
7. Audit: generation_attempt_failed, credit_refunded
```

### Safety rejection (post-provider)

If output fails `assertProseOutputSafe` / leak scan:

- Treat as **failed generation** — **refund** (provider delivered unusable output per product policy).
- Alternative (stricter, no refund): document clearly — **recommend refund** for MVP user trust.

### Race conditions

| Risk | Mitigation |
|---|---|
| Concurrent debits | `SELECT balance FOR UPDATE` via RPC or serial debit function |
| Duplicate idempotency | UNIQUE constraint + return existing attempt on conflict |
| Stale `running` attempts | Cron/manual cleanup later; smoke uses short timeout |

---

## 6. Model Router Design

### Architecture

```txt
Route handler → ai-generation-service → model-router → openrouter-client
                     ↓
              credit-service, generation-attempt-repo, context-packet-builder
```

- **API-only** provider calls — never frontend.
- Frontend sends: `beatId`, `sessionId`, optional `instruction` (rewrite), `idempotencyKey` — **not** prompt/context.

### Environment variables (Worker bindings)

| Variable | Required | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | When AI enabled | Never log, never client |
| `OPENROUTER_BASE_URL` | Optional | Default `https://openrouter.ai/api/v1` |
| `DEFAULT_AI_MODEL` | Optional | Fallback if quality mapping missing |
| `AI_GENERATION_ENABLED` | Yes | `false` default — 503 when disabled |
| `AI_CREDIT_COST_*` | Optional | Override fixed costs |

Extend `AppBindings` in `apps/api/src/env.ts`; document in `apps/api/.dev.vars.example` (names only).

### Quality mode mapping (`project_settings.quality_tier`)

| `quality_tier` | Model tier (example allowlist) | Timeout | Max output tokens |
|---|---|---|---|
| `hemat` | `google/gemma-2-9b-it` or budget model | 30s | 800 |
| `seimbang` | `anthropic/claude-3-haiku` or mid | 45s | 1200 |
| `terbaik` | `anthropic/claude-3.5-sonnet` or premium | 60s | 2000 |

**Model allowlist** hardcoded in `model-router.ts` — no arbitrary model id from client.

### Generation type → prompt template

| Type | System prompt focus | User payload |
|---|---|---|
| `prose_beat` | Mobile fiction, beat constraints, must_include/must_not_include | Context packet JSON (server-side only) |
| `prose_rewrite` | Improve clarity/emotion; preserve plot facts | Prior prose excerpt + instruction (max 500 chars) |
| `publish_copy` | Caption/teaser polish; no overclaim | Publish field snapshot (no planning truth) |

### Retry policy

- **Max 1 retry** on transient 5xx/timeout with same idempotency (internal retry, not new attempt).
- No retry on 4xx safety rejection or insufficient credit.
- Map provider errors to `AppError` codes — never forward raw provider body to client.

### Logging

- Log: `attemptId`, `model`, `prompt_hash`, token counts, latency, `error_code`.
- Never log: API key, raw prompt, `packet_json`, full provider response body.

---

## 7. Prompt / Context Safety Policy

### Input assembly

| Rule | Enforcement |
|---|---|
| Context from backend only | `buildContextPacketForOwner()` — existing Sprint 5 builder |
| No frontend-assembled context | Reject body fields like `contextPacket`, `packetJson` |
| No `planningTruth` | Already stripped in builder; safety assert before call |
| No `packet_json` to UI | Preview endpoint unchanged; generation uses full packet server-side only |
| Prompt storage | `prompt_hash` on `generation_attempts` only |
| Provider metadata | Store `model`, `provider`, token counts — not request headers with auth |

### Output safety

| Check | When |
|---|---|
| `assertWriterPacketSafe` | Before building prompt (input) |
| Prose leak markers (existing `PROSE_LEAKAGE_MARKERS`) | On model output before persist |
| Max length `PROSE_MAX_CHARS` | Truncate or reject |
| Forbidden metadata keys | Same as `prose-draft.ts` `METADATA_FORBIDDEN_KEYS` |

### Persistence rule

- Successful prose → `chapter_prose_versions` with `source = ai_generated`, `context_packet_log_id` set.
- Enable `ai_generated` in `ALLOWED_SOURCES` **only** via dedicated AI service path — not user POST body.
- AI output **does not** create `ai_proposals`, `facts`, or canon rows.
- Summary/delta/publish AI (when added) → proposals or draft fields only.

---

## 8. Generation Flow Proposal

### Beat prose generation (happy path)

```txt
1. User clicks "Generate Beat Prose" (WritePage)
2. POST /api/projects/:id/ai/generate-prose
   Body: { sessionId, beatId, idempotencyKey? }
3. API: auth + ownership
4. Verify workflow_phase + outline_locked + write gates (assertWriteRoomGates)
5. Verify active writing session + beat belongs to session
6. buildContextPacketForOwner(beatId) → packetLogId + prompt assembly
7. Compute prompt_hash
8. Resolve credit_cost from generation_type + quality_tier
9. preflightCredit(userId, credit_cost) → 402 if insufficient
10. INSERT generation_attempt status=pending
11. debitCredits(userId, amount, attemptId) → ledger + balance
12. UPDATE attempt status=running
13. modelRouter.generate({ type: prose_beat, prompt, model, timeout })
14. assertProseOutputSafe(output)
15. saveProseDraftForOwner(source=ai_generated, contextPacketLogId) — internal only
16. UPDATE attempt status=succeeded, output_entity_id=versionId, tokens
17. audit: generation_attempt_succeeded, ai_output_persisted, credit_debited
18. Return ChapterProseVersion safe DTO (no leak patterns)
```

### Failure paths

| Failure | HTTP | Credit | Attempt status |
|---|---|---|---|
| AI disabled (`AI_GENERATION_ENABLED=false`) | 503 | No debit | — |
| Insufficient credit | 402 | No debit | — |
| Missing OpenRouter key when enabled | 503 `AI_NOT_CONFIGURED` | No debit | — |
| Provider timeout/5xx | 502/504 | **Refund** | `failed` |
| Safety rejection on output | 422 | **Refund** (MVP policy) | `failed` |
| Partial DB write after provider success | 500 | Manual reconciliation / compensation | `failed` + alert |
| Idempotent replay | 200 | No second debit | Return cached result |

---

## 9. API Endpoint Proposal

### Recommended: dedicated `/ai/` namespace

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/projects/:id/ai/generate-prose` | Beat prose generation (Phase A) |
| POST | `/api/projects/:id/ai/rewrite-prose` | Rewrite existing version (Phase B) |
| POST | `/api/projects/:id/ai/improve-publish-copy` | Optional publish field polish (Phase C) |
| GET | `/api/projects/:id/ai/attempts` | List attempts (paginated, redacted) |
| GET | `/api/projects/:id/ai/attempts/:attemptId` | Single attempt status |
| GET | `/api/credits/ledger` | User ledger entries (optional 8.3) |

### Tradeoff: `/ai/` vs nested under `/write/`

| Approach | Pros | Cons |
|---|---|---|
| **`/ai/*` (recommended)** | Clear boundary; shared by write/publish; credit/audit centralized | New route module |
| `/write/beats/:id/generate-prose` | Discoverable in write flow | Blurs credit/AI concerns; harder for publish AI later |

**Decision:** `apps/api/src/routes/ai.ts` + `services/ai-generation.ts` orchestrator.

Existing routes unchanged:

- `POST .../write/beats/:beatId/prose` — user manual save only (`user_edited`)
- `POST .../write/context-packet` — preview unchanged

### Request/response shape (sketch)

```ts
// POST generate-prose
{ sessionId: string; beatId: string; idempotencyKey?: string }
→ { attemptId, version: ChapterProseVersion, creditCost, balanceAfter }

// Error codes
INSUFFICIENT_CREDIT (402), AI_DISABLED (503), AI_NOT_CONFIGURED (503),
PROVIDER_ERROR (502), OUTPUT_SAFETY_REJECTED (422)
```

---

## 10. Web Integration Proposal

### WritePage (Task 8.5)

| UI element | Behavior |
|---|---|
| "Generate Beat Prose" button | Enabled when session active, beat selected, AI enabled server-side |
| Credit cost badge | Fetch from `GET /api/credits/balance` + static cost table or `OPTIONS` endpoint |
| Loading state | Disable button; show attempt `running` |
| Error toast | Map 402/503/422 — no raw provider message |
| Success | Load new prose version into editor |
| No prompt display | Never show context packet or hash in UI |
| Post-generation | User may edit → save as `user_edited` new version (existing flow) |

### PublishPage (optional Phase C)

- "Perbaiki Caption" — later sprint slice; calls `improve-publish-copy`
- Manual save/versioning unchanged

### Settings

- `quality_tier` already on `project_settings` — reused for model router mapping
- No new "model id" picker in Sprint 8 MVP

---

## 11. Safety Tests Plan

**New script (planned):** `scripts/sprint8-smoke-api.ps1`  
**npm alias:** `smoke:api:sprint8`

| # | Scenario | Expected |
|---|---|---|
| 1 | `AI_GENERATION_ENABLED=false` | 503, no attempt row |
| 2 | Insufficient credit balance | 402, no debit |
| 3 | No `OPENROUTER_API_KEY` when enabled | 503 safe error, no key in response |
| 4 | Successful generation (mock provider mode) | attempt `succeeded`, prose `ai_generated` |
| 5 | `prompt_hash` present; no raw prompt in DB/API | PASS |
| 6 | Attempt metadata has no `planningTruth` / `packet_json` | PASS |
| 7 | Output with leak marker rejected | 422, refund ledger row |
| 8 | Provider failure (mock 500) | `failed`, refund, balance restored |
| 9 | Success debits exactly once | ledger single debit |
| 10 | Idempotency replay | same result, no double debit |
| 11 | AI prose does not mutate facts/characters/outline | canon counts unchanged |
| 12 | Sprint 5/6/7 regression | `smoke:api:sprint5/6/7` PASS |

**Mock provider mode:** `AI_PROVIDER_MOCK=true` env returns deterministic prose without network — for local smoke without OpenRouter spend.

Update `smoke-all-local.ps1` phase 10 optional after 8.6.

---

## 12. Audit Plan

| Event | Trigger | Payload |
|---|---|---|
| `generation_attempt_created` | After attempt insert | attemptId, generationType, creditCost, prompt_hash |
| `generation_attempt_succeeded` | Provider + persist OK | attemptId, outputEntityId, model, token counts |
| `generation_attempt_failed` | Any terminal failure | attemptId, errorCode — no stack |
| `credit_debited` | Ledger debit | attemptId, amount, balanceAfter |
| `credit_refunded` | Ledger refund | attemptId, amount, balanceAfter |
| `ai_output_persisted` | Prose version saved | versionId, beatId, source=ai_generated |

**Redaction:** Use `audit-snapshot.ts` patterns — no raw prose, no prompt, no packet.

---

## 13. Risk Analysis

| Risk | Impact | Guardrail |
|---|---|---|
| Cost runaway | High bills | Fixed credit debit; allowlist models; `AI_GENERATION_ENABLED` default false |
| Prompt leak | Security/reputation | Hash only; sanitizer; smoke asserts |
| Future spoiler leak | Reader trust | Context packet future-chapter guards (existing) |
| Canon corruption | Data integrity | AI → draft only; no direct canon writes |
| Hallucinated facts | Story quality | User edit + Sprint 6 delta review path unchanged |
| Poor output quality | User distrust | Credit policy documented; rewrite endpoint |
| Provider downtime | UX | Refund + clear error; mock mode for dev |
| Duplicate click / double debit | Billing dispute | Idempotency key + UNIQUE constraint |
| Token estimate mismatch | Margin | Fixed credit MVP; analytics later |
| Credit consumed on bad output | Support burden | Refund on safety rejection (MVP) |

---

## 14. Task Breakdown Sprint 8

| Task | Scope | Deliverable |
|---|---|---|
| **8.0** | Implementation plan | `docs/44` (this doc) ✅ |
| **8.1** | Data model | `00008` migration: `generation_attempts`, `credit_ledger`, enums, shared types, audit enum extend |
| **8.2** | Model router + OpenRouter client | `model-router.ts`, `openrouter-client.ts`, disabled by default, mock provider |
| **8.3** | Credit service | `debitCredits`, `refundCredits`, idempotency, RPC or transaction-like |
| **8.4** | Prose beat generation API | `POST /ai/generate-prose`, orchestration, safety, persist `ai_generated` |
| **8.5** | WritePage integration | Generate button, credit display, loading/error states |
| **8.6** | Safety + regression tests | `sprint8-smoke-api.ps1`, update smoke index |
| **8.7** | Verification report | `docs/45-sprint-8-verification-report.md` |

**Optional stretch:** `rewrite-prose` (8.4b), `improve-publish-copy` (8.5b) — after 8.4 core PASS.

**Dependency order:**

```txt
8.1 → 8.2 + 8.3 (parallel after schema)
8.2 + 8.3 → 8.4
8.4 → 8.5 → 8.6 → 8.7
```

---

## 15. Acceptance Criteria Sprint 8

| Criterion | Measure |
|---|---|
| AI disabled by default | `AI_GENERATION_ENABLED=false` → 503 on AI routes |
| No client provider key | Key only in Worker env |
| Credit checked and deducted | 402 when insufficient; ledger row on debit |
| Refund on provider failure | Balance restored; refund ledger row |
| `generation_attempts` persisted | All calls tracked with `prompt_hash` |
| Raw prompt not stored | DB/API/audit inspection |
| No `planningTruth` leak | Smoke + safety scan |
| AI output draft only | `chapter_prose_versions.source=ai_generated`; canon unchanged |
| No direct canon mutation | Facts/characters/outline counts unchanged in smoke |
| Sprint 5/6/7 regression PASS | Existing smokes green |
| User-facing errors | Clear 402/503/422 messages — no provider dump |

---

## 16. Recommended First Coding Task

### Task 8.1 — AI Generation Data Model + Credit Ledger

Deliverables:

1. `supabase/migrations/00008_sprint8_ai_generation_credit.sql`
2. Shared enums: `GENERATION_TYPES`, `GENERATION_STATUSES`, `CREDIT_LEDGER_DIRECTIONS`
3. Shared domain types: `GenerationAttempt`, `CreditLedgerEntry`
4. Audit enum additions for §12 events
5. RLS policies: owner read attempts/ledger; service role write
6. Optional RPC `debit_user_credits` / `refund_user_credits` stubs
7. Update `apps/api/.dev.vars.example` with AI env **names only**
8. No OpenRouter calls yet

---

## Related documents

- [`docs/43-pre-ai-hardening-verification-report.md`](43-pre-ai-hardening-verification-report.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`](34-sprint-5-safe-write-room-context-packet-implementation-plan.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`scripts/README.md`](../scripts/README.md)