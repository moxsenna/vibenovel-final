# 48 — Sprint 9: AI Rewrite, Publish Copy & Credit UI Implementation Plan

**Status:** In progress — Tasks 9.1–9.4 complete; Tasks 9.5–9.8 pending  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md), [`docs/47-live-openrouter-staging-smoke-report.md`](47-live-openrouter-staging-smoke-report.md) (live OpenRouter staging **GO**)

Dokumen ini adalah **rencana Sprint 9** setelah Sprint 8 live OpenRouter staging GO. Memperluas AI secara hati-hati ke prose rewrite, publish copy improvement, credit UI minimal, dan cost observability. **Task 9.0 tidak mengimplementasikan kode** — hanya perencanaan dan work log.

**Work log:** `.agent-logs/sprint-9/task-9.0-ai-rewrite-publish-credit-ui-plan.md`

---

## 1. Sprint 9 Goal

### Tujuan

Memperluas AI **setelah** live OpenRouter staging GO (`docs/47`), dengan batas canon yang sama seperti Sprint 8:

- **AI prose rewrite / improve** — perbaiki naskah beat aktif (emosi, pacing, dialog, panjang) tanpa mutasi canon.
- **AI publish copy improvement** — poles teaser/caption/reader question dengan overclaim guard; tidak auto-post KBM.
- **Credit UI minimal** — user melihat saldo, biaya estimasi per aksi, dan sisa setelah sukses; tanpa topup/payment.
- **Cost observability** — `estimated_cost_usd` di `generation_attempts` terisi saat token tersedia; internal accounting only, bukan billing user.
- **Canon boundary tetap** — output AI masuk `chapter_prose_versions` / saran publish / draft saja; tidak langsung mutate `facts`, `characters`, `speech_rules`, outline locked, summary canon, atau proposal accept.

### Prasyarat terpenuhi

| Gate | Status |
|---|---|
| Sprint 8 prose beat generation (mock) | ✅ `docs/45` |
| Credit debit/refund/idempotency | ✅ Task 8.6 |
| Live OpenRouter staging | ✅ **GO** Task 8.9b — `google/gemini-2.5-flash` |
| Regression Sprint 2/5/6/7 API | ✅ 187/187 (17+49+68+53) per `docs/45` |
| `AI_GENERATION_ENABLED=false` default | ✅ Repo + rollback verified |

---

## 2. Current State

### Hasil Sprint 8 (ringkas)

| Area | Status |
|---|---|
| `POST /api/projects/:id/ai/generate-prose` | ✅ Implemented — `prose_beat` orchestration |
| WritePage **Tulis Beat dengan AI** | ✅ API mode; mock/fallback disabled dengan penjelasan |
| Credit debit/refund/idempotency | ✅ Verified mock + live idempotency (`docs/47`) |
| Model router + OpenRouter shell | ✅ Allowlist; tier hemat/seimbang/terbaik |
| Live provider | ✅ GO — `google/gemini-2.5-flash` (hemat tier staging) |
| Regression Sprint 2/5/6/7 | ✅ PASS 187/187 |
| `AI_GENERATION_ENABLED` default | ✅ `false` |

### Known gaps (input Sprint 9)

| Gap | Evidence |
|---|---|
| ~~`estimated_cost_usd` selalu `null`~~ | **Addressed Task 9.1** — populated when tokens + allowlisted model cost map |
| ~~No prose rewrite API/UI~~ | **Addressed Tasks 9.3–9.4** — API + WritePage rewrite UI (API mode) |
| No publish copy AI | `PublishPage` / `usePublishData` — tidak ada AI improve |
| No credit balance widget di WritePage | Saldo hanya di notice sukses + Settings mock/API |
| Rewrite/publish credit costs defined but unused | `ai-credit-policy.ts` — `prose_rewrite`, `publish_copy` enabled in policy only |
| `CHAPTER_PROSE_SOURCES` — no `ai_rewrite` | Enum: `user_edited`, `stub_deterministic`, `ai_generated` only |
| Temperature fixed `0.7` | `model-router.ts` `resolveModelForGeneration` — belum per `generationType` |

### Infrastruktur siap pakai (tanpa migration wajib)

- `generation_type` enum: `prose_beat`, `prose_rewrite`, `publish_copy`, `summary_delta` (`00008`)
- `generation_attempts.output_entity_type` / `output_entity_id`
- `credit_ledger` + `getCreditCostForGeneration` untuk rewrite/publish
- `mock-ai-provider` branches untuk `prose_rewrite` / `publish_copy`
- `GET /api/credits/balance` read-only
- Publish overclaim guard existing di Sprint 7 (`PATCH .../fields`)

---

## 3. Scope Sprint 9

### A. Cost observability hardening (Task 9.1)

- Populate `estimated_cost_usd` on `generation_attempts` when provider returns token counts.
- Internal `model-cost-map` untuk allowlisted models (hardcoded module, bukan DB table).
- `calculateEstimatedCostUsd({ model, inputTokens, outputTokens })` — approximate, documented as internal.
- Jika token missing: keep `null`, set `metadata.estimatedCostUnavailableReason`.
- **Tidak** mengubah fixed credit billing — `credit_cost` tetap dari `ai-credit-policy`.

### B. Credit UI minimal (Task 9.2)

- WritePage assistant panel: saldo kredit, biaya generate/rewrite, sisa setelah sukses.
- Disable generate/rewrite jika saldo API diketahui tidak cukup (client guard; server tetap authoritative `402`).
- Dashboard shell / Settings: optional read-only credit card (Settings sudah punya pola mock).
- **No topup button**, no payment flow.

### C. AI prose rewrite (Task 9.3 + 9.4)

- Rewrite prose beat aktif dari versi current atau `proseVersionId`.
- Modes: `improve_emotion`, `tighten_pacing`, `natural_dialogue`, `shorter`, `longer`, `custom` (+ optional instruction ≤500).
- Preserve chapter/beat constraints via context packet (same chapter/beat boundary).
- Persist hasil sebagai **new** `chapter_prose_version` — bukan overwrite canon.
- Source: `ai_generated` MVP **atau** `ai_rewrite` jika migration `00009` dipilih (lihat §6).

### D. Publish copy improvement (Task 9.5 + 9.6)

- Improve: `teaser`, `caption`, `readerQuestion`, `shortSynopsis`, `nextChapterTeaser` (subset per request).
- Overclaim scan reuse Sprint 7 patterns + AI output safety.
- MVP decision: **suggestion-first** — API returns suggestions; user clicks **Terapkan** → `PATCH .../publish/:packageId/fields`.
- Explicit button **Perbaiki Copy dengan AI** — no auto-post, no auto-patch tanpa konfirmasi UI.

### Urutan implementasi disarankan

```txt
9.1  Cost estimation (low risk, closes 8.9b gap)
9.2  Credit UI minimal (unblocks user trust before more AI calls)
9.3  Rewrite API
9.4  WritePage rewrite UI
9.5  Publish copy AI API
9.6  PublishPage AI UI
9.7  Safety regression (API + web smokes)
9.8  Verification report (docs/49)
```

---

## 4. Explicit Out of Scope

| Item | Policy |
|---|---|
| Summary / delta AI extraction | Tetap deterministic/stub — butuh validator matang |
| Foundation / concept / outline AI production | Deferred — high canon risk |
| Auto canon mutation | AI tidak menulis ke facts/characters/speech_rules/locked outline |
| Auto proposal accept | User explicit accept/reject (Sprint 6) |
| Auto publish KBM | Manual copy + `mark-exported` only |
| Topup / payment / subscription billing | Out of scope |
| Admin credit dashboard | Out of scope |
| Production deploy / remote migration push | Local dev until Sprint 9 verification |
| Mengubah model router allowlist/tier logic (Task 9.0) | Plan only; implementation tasks follow plan |
| Mengubah credit service billing semantics (Task 9.0) | Fixed credit costs remain |
| `estimated_cost_usd` untuk charge user | Internal observability only |
| Background worker queue | Synchronous Worker call MVP |
| True Postgres RPC credit+attempt atomicity | P1 before production — compensation pattern OK for Sprint 9 |
| CI API-mode E2E in GitHub Actions | Deferred (7.8.5) |

---

## 5. Architecture Decisions

### Model tier vs backend core

| Layer | Model policy |
|---|---|
| **Prose writer** (`prose_beat`, `prose_rewrite`) | Tiered: hemat / seimbang / terbaik via env + allowlist |
| **Publish copy** (`publish_copy`) | Tiered quality mode **atau** fixed safe tier for MVP (recommend: tiered, same router) |
| **Backend core engines** (summary/delta, foundation, outline) | **Not tiered** — fixed model later; temperature/config per `generationType` when enabled |
| **Summary/delta** | Deterministic/stub until validator mature — **not Sprint 9** |

### Output artifact boundary

- Rewrite → new `chapter_prose_version` (user can edit → `user_edited` on manual save).
- Publish copy → suggestion JSON **or** patched `publish_packages` fields only after user confirm.
- Never write AI output directly to canon tables.

### Reuse Sprint 8 orchestration pattern

Mirror `prose-beat-generation.ts` for rewrite and publish:

```txt
auth/ownership → session/package gate → build safe prompt (hash only)
→ create generation_attempt → debit → model router → safety
→ persist output → mark succeeded → return safe summary + balance
→ refund on provider/safety failure
```

### Idempotency

- Client supplies `idempotencyKey` per click (same pattern as generate-prose).
- Server: `getGenerationAttemptByIdempotencyKey` before debit.

### Provider boundary (unchanged)

- `OPENROUTER_API_KEY` Worker-only; no key in frontend/logs/docs.
- `AI_GENERATION_ENABLED=false` default after verification runs.
- Mock provider for local smoke matrix.

### Publish copy MVP: suggestion-first

**Decision:** Return `{ suggestions: { field: string } }` from API; web applies via existing `PATCH .../fields`. Rationale: clearer undo (user sees diff), no silent package mutation, aligns with canon safety. If UI complexity blocks, fallback documented: single-click apply with toast + no version history (acceptable MVP limitation).

---

## 6. Data Model / Schema Needs

### Existing schema (migration `00008`)

| Artifact | Sprint 9 usage |
|---|---|
| `generation_attempts.generation_type` | `prose_rewrite`, `publish_copy` |
| `generation_attempts.estimated_cost_usd` | Populate — **no migration** |
| `generation_attempts.metadata` | `rewriteMode`, `estimatedCostUnavailableReason`, `publishFields` |
| `credit_ledger` | Unchanged |
| `publish_packages` | Target for applied copy (existing columns) |
| `chapter_prose_versions` | New version per rewrite |

### `chapter_prose_versions.source` enum

Current DB/shared enum (`CHAPTER_PROSE_SOURCES`):

```txt
user_edited | stub_deterministic | ai_generated
```

| Option | Migration? | Pros | Cons |
|---|---|---|---|
| **A — Reuse `ai_generated`** | None | Fastest; reuse `saveAiGeneratedProseVersionForOwner` | Cannot distinguish beat-gen vs rewrite in analytics |
| **B — Add `ai_rewrite`** | `00009` enum extend | Clear provenance | Requires migration + shared + mapper updates |

**Recommendation:** **Option A for MVP** if `metadata.rewriteMode` on version row suffices; **Option B (`00009`)** if product/UI needs distinct badge "AI Rewrite" vs "AI Generated". Task 9.3 decides at implementation — plan both paths.

### No new tables planned

- Model cost map → code module `model-cost-map.ts` (or section in `ai-credit-policy` sibling).
- No `model_router_configs` table.
- No publish copy suggestion table — ephemeral API response unless user applies.

### Migration summary

| Change | Migration needed? |
|---|---|
| `estimated_cost_usd` population | **No** — column exists |
| Hardcoded model pricing | **No** |
| `ai_rewrite` source enum | **Optional `00009`** |
| New audit enum `ai_publish_copy_suggested` | **Optional** — can reuse `generation_attempt_succeeded` metadata |

---

## 7. Cost Estimation Plan

### Internal model cost map

New module (Task 9.1): `apps/api/src/services/model-cost-map.ts`

```ts
// Pseudocode — prices MUST be verified from OpenRouter docs at implementation time
calculateEstimatedCostUsd({
  model: string,
  inputTokens: number,
  outputTokens: number,
}): number | null
```

| Rule | Detail |
|---|---|
| Allowlist only | Unknown model → `null` + reason `model_not_in_cost_map` |
| Pricing source | OpenRouter model page / API pricing — **verify at implementation**, not from memory |
| `google/gemini-2.5-flash` | Include mapping **only after** verified pricing during Task 9.1 |
| Precision | `numeric` USD, 6 decimal places max; round half-up |
| Approximate flag | Store `metadata.costEstimateApproximate: true` |

### Write path

After `generateWithModelRouter` returns with tokens:

1. Compute `estimatedCost = calculateEstimatedCostUsd(...)`.
2. Pass to `markGenerationAttemptSucceeded` (extend input with `estimatedCostUsd`).
3. If tokens null (mock edge): leave `estimated_cost_usd` null.

### Billing separation

| Field | Purpose |
|---|---|
| `credit_cost` | User-facing fixed debit (authoritative for MVP) |
| `estimated_cost_usd` | Internal provider cost observation |

Do **not** tie refund amount to `estimated_cost_usd`.

### Observability (non-DB)

- Safe log field: `estimated_cost_usd` numeric only — no pricing table dump.
- Optional future: aggregate query on `generation_attempts` for ops — out of Sprint 9 scope.

---

## 8. Credit UI Plan

### WritePage assistant panel (primary)

| Element | Behavior |
|---|---|
| **Saldo kredit** | Fetch `GET /api/credits/balance` on room load (reuse `useWriteRoomData` pattern); show `N kredit` |
| **Biaya aksi** | `formatProseBeatCreditCostLabel` extended for rewrite modes |
| **Setelah sukses** | Notice: `Terpotong X kredit. Sisa: Y.` (existing pattern, extend to rewrite) |
| **Insufficient** | Disable button if `balance < cost`; message: **Kredit tidak cukup.** |
| **AI disabled** | **AI belum aktif.** (`AI_DISABLED` / no `onGenerateAi`) |
| **Provider error** | **Provider sedang bermasalah, kredit dikembalikan jika sudah terpotong.** |

### Settings / Dashboard (optional Task 9.2)

- Settings: wire existing credit card to live `fetchCreditBalance` when API mode (partially exists via `useSettingsData`).
- Dashboard shell badge: read-only balance — nice-to-have, not blocking.

### Explicitly not shown

- Raw `credit_ledger` rows
- `attempt_id`, internal refund reasons
- Provider USD cost to end user (internal only; optional dev tooltip out of scope)

### Client services

- Extend `apps/web/src/services/ai.ts` — cost label helpers for `prose_rewrite`, `publish_copy`.
- Reuse `fetchCreditBalance` from `credits.ts`.

---

## 9. AI Rewrite API Plan

### Endpoint (Task 9.3 — not in 9.0)

```http
POST /api/projects/:id/ai/rewrite-prose
```

### Request body

| Field | Required | Notes |
|---|---|---|
| `chapterOutlineId` | yes | Same as generate-prose |
| `beatId` | yes* | *Required if no `proseVersionId` |
| `proseVersionId` | optional | Source text; default current version for beat |
| `writingSessionId` | recommended | Session gate |
| `rewriteMode` | yes | `improve_emotion` \| `tighten_pacing` \| `natural_dialogue` \| `shorter` \| `longer` \| `custom` |
| `qualityMode` | yes | `hemat` \| `seimbang` \| `terbaik` |
| `instruction` | optional | Max 500 chars; required semantics for `custom` |
| `idempotencyKey` | yes | Max 120 |

Forbidden body keys: same set as `generate-prose` (`model`, `provider`, `creditCost`, `prompt`, `packet_json`, etc.).

### Flow

```txt
1. assertNoForbiddenBodyKeys
2. verify project ownership
3. verify writing session active|paused
4. load beat + current prose version (or proseVersionId)
5. buildContextPacketForOwner (same chapter — no cross-chapter leak)
6. buildRewritePrompt(currentProseExcerpt, rewriteMode, instruction) → promptHash
7. idempotency replay check → return cached safe summary
8. createGenerationAttempt(generation_type=prose_rewrite)
9. debitCreditsForAttempt (policy: 3/6/12)
10. markGenerationAttemptRunning
11. generateWithModelRouter(prose_rewrite, temperature 0.55–0.75)
12. assertProviderOutputSafe
13. saveAiGeneratedProseVersionForOwner (or saveAiRewriteProseVersion if 00009)
14. markGenerationAttemptSucceeded (+ tokens + estimated_cost_usd)
15. writeAiOutputPersistedAudit
16. return { version, generationAttempt, creditBalance, creditCost, idempotentReplay }
```

### Failure / refund

Same as `prose-beat-generation.ts`:

- `AI_PROVIDER_*` → refund
- `AI_OUTPUT_UNSAFE` → refund, no prose version
- `INSUFFICIENT_CREDIT` → no provider call

### Guardrails

- No canon mutation smoke (facts/characters/speech/open-loops/reveals/proposals unchanged)
- No raw prompt/prose in audit — `prompt_hash` only
- User edits result manually after insert
- Rewrite cannot change beat number or chapter assignment

### New files (implementation tasks)

- `prose-rewrite-prompt.ts` — safe prompt builder
- `prose-rewrite-generation.ts` — orchestration (mirror beat generation)
- Route registration in `ai.ts`

---

## 10. Publish Copy AI Plan

### Endpoint (Task 9.5)

```http
POST /api/projects/:id/ai/improve-publish-copy
```

### Request body

| Field | Required | Notes |
|---|---|---|
| `packageId` | yes | Owned publish package |
| `fields` | yes | Subset of: `teaser`, `caption`, `readerQuestion`, `shortSynopsis`, `nextChapterTeaser` |
| `qualityMode` | yes | Or fixed `hemat` for MVP cost control |
| `instruction` | optional | Bounded |
| `idempotencyKey` | yes | |

### Flow

```txt
1. auth/ownership
2. load publish package — reject if status exported
3. load approved summary safe fields (no planning truth)
4. buildPublishCopyPrompt(existing fields, fields[], instruction) → promptHash
5. idempotency check
6. createGenerationAttempt(generation_type=publish_copy)
7. debit (3/6/12)
8. generateWithModelRouter(publish_copy, temperature 0.5–0.7)
9. parse structured suggestions per field
10. run overclaim + leak scan on each suggestion
11. if unsafe → refund, failed attempt
12. return { suggestions, generationAttempt, creditBalance, creditCost }
```

### Apply path (web Task 9.6)

User clicks **Terapkan** → existing `PATCH /api/projects/:id/publish/:packageId/fields` with edited values.

Alternative faster MVP (documented fallback): API `apply=true` flag performs PATCH server-side after scan — only if suggestion-first UI slips schedule.

### Guardrails

- No auto-post KBM
- No canon mutation
- No overclaim patterns (`dijamin viral`, `pasti viral`, `dijamin unlock`, `pasti banyak pembaca`)
- `nextChapterTeaser` — no spoiler beyond safe approved summary scope
- No `planningTruth` / `packet_json` in prompt surface

### Reuse

- `publish-package` service for load/export guard
- Sprint 7 overclaim validation functions
- `ai-prompt-safety.ts` output asserts

---

## 11. Temperature / Model Config Plan

### Agreed architecture (document for future tasks)

| `generationType` | Model tier | Temperature (implementation target) |
|---|---|---|
| `prose_beat` | hemat / seimbang / terbaik | 0.70 – 0.90 |
| `prose_rewrite` | hemat / seimbang / terbaik | 0.55 – 0.75 |
| `publish_copy` | hemat / seimbang / terbaik (or fixed hemat) | 0.50 – 0.70 |
| `summary_delta` | fixed (future) | 0.00 – 0.20 |
| validator / safety | code-first | 0.0 |

### Sprint 9 implementation scope

- Extend `resolveModelForGeneration` or orchestration callers to pass `temperature` override per type.
- **Do not** change default tier model mapping in Task 9.1.
- Task 9.3/9.5 wire temperatures for rewrite/publish only.

### Current code baseline

- `model-router.ts` line 129: `temperature: 0.7` fixed for all types.
- Token caps already per type: `prose_rewrite` 2000, `publish_copy` 800.

---

## 12. Safety Tests Plan

### API smoke — new script `scripts/sprint9-smoke-api.ps1` (Task 9.7)

Extend Sprint 8 patterns; mock modes `success`, `fail_provider`, `unsafe_output`.

| Case | Expect |
|---|---|
| Rewrite AI disabled | `503 AI_DISABLED` — safe error, no provider |
| Rewrite insufficient credit | `402` — no provider call |
| Rewrite success | New prose version, debit once, `generation_type=prose_rewrite` |
| Rewrite idempotency | Replay — no double debit, no duplicate version |
| Rewrite `fail_provider` | Refund, no prose |
| Rewrite `unsafe_output` | Refund, no prose |
| Rewrite no canon mutation | Facts/characters/speech unchanged |
| Publish copy success | Suggestions safe, no overclaim |
| Publish copy unsafe/overclaim | Rejected/refunded |
| Leak guard | No prompt/packet/planningTruth/provider raw body |
| Live optional | One rewrite call if operator enables staging — document in report only |

### Web E2E — `sprint9-smoke-web.ps1` + Playwright specs

| Case | Expect |
|---|---|
| WritePage rewrite buttons disabled | Mock/fallback + AI off |
| Rewrite API success | Editor shows rewritten text |
| Publish improve button disabled | Mock/fallback |
| Publish API success | Suggestions shown or fields updated per MVP |
| DOM leak guard | No forbidden substrings |

### Regression (mandatory Task 9.7)

| Command | Expect |
|---|---|
| `npm run smoke:api` | PASS 17/17 |
| `npm run smoke:api:sprint5` | PASS 49/49 |
| `npm run smoke:api:sprint6` | PASS 68/68 |
| `npm run smoke:api:sprint7` | PASS 53/53 |
| `npm run smoke:api:sprint8` | PASS (baseline) |
| `npm run smoke:web:write-ai` | PASS |
| `npm run smoke:all:local` | PASS all phases |

Wire Sprint 9 API baseline into `smoke-all-local.ps1` phase 12 optional — or document manual matrix like Sprint 8 fail/unsafe modes.

### Live provider smoke (optional)

- Max 1 rewrite call post-9.3 with same rollback discipline as `docs/46`.
- Daily spend cap ≤ USD 2.00 operator discipline.

---

## 13. Audit Plan

### Reuse existing audit actions

| Event | When |
|---|---|
| `generation_attempt_created` | Attempt row inserted |
| `generation_attempt_succeeded` | Provider + persist OK |
| `generation_attempt_failed` | Provider/safety/validation fail |
| `credit_debited` | Pre-provider debit |
| `credit_refunded` | Failure refund |
| `ai_output_persisted` | Prose version saved |
| `publish_package_updated` | User applies publish copy (existing Sprint 7) |

### Optional future enum

- `ai_publish_copy_suggested` — only if suggestion path needs distinct audit; else metadata on `generation_attempt_succeeded`.

### Never log

- Raw prompt / `promptMessages`
- Full prose text
- `packet_json`
- Provider raw response body
- API keys / JWT / session tokens

---

## 14. Task Breakdown Sprint 9

| Task | Title | Deliverable |
|---|---|---|
| **9.0** | Sprint 9 plan | `docs/48` + work log (this doc) |
| **9.1** | AI cost estimation + attempt cost metadata | `model-cost-map.ts`, extend `markGenerationAttemptSucceeded`, populate `estimated_cost_usd` |
| **9.2** | Credit UI minimal | WritePage balance/cost; optional Settings; no topup |
| **9.3** | Prose Rewrite API | `POST /ai/rewrite-prose`, `prose-rewrite-generation.ts`, smoke cases |
| **9.4** | WritePage Rewrite UI | Enable Perbaiki Teks buttons, mode picker, E2E |
| **9.5** | Publish Copy AI API | `POST /ai/improve-publish-copy`, overclaim guard, suggestions |
| **9.6** | PublishPage AI UI | Improve copy buttons, apply flow, E2E |
| **9.7** | Sprint 9 safety regression | `sprint9-smoke-api.ps1`, web smokes, regression 187/187 + 8 |
| **9.8** | Sprint 9 verification report | `docs/49-sprint-9-verification-report.md` |

### Dependency graph

```txt
9.1 ─┬─► 9.2 (UI can show cost labels in parallel)
     ├─► 9.3 ─► 9.4
     └─► 9.5 ─► 9.6
9.3 + 9.5 + 9.2 ─► 9.7 ─► 9.8
```

---

## 15. Acceptance Criteria Sprint 9

| Criterion | Verification |
|---|---|
| Rewrite API credit-gated | API smoke + 402/503 paths |
| Rewrite UI works | Web E2E API mode |
| Publish copy AI works **or** explicitly deferred in 9.8 | API + web smoke or defer note |
| Credit balance visible on WritePage | Manual + E2E |
| `estimated_cost_usd` populated when tokens available | DB check post-live/mock success |
| No raw prompt/context leak | Leak guard scripts |
| No canon mutation | Rewrite + publish smokes |
| Refund on failure | mock `fail_provider` / `unsafe_output` |
| No double debit | Idempotency smoke |
| Sprint 5/6/7/8 regression PASS | `smoke:all:local` |
| `AI_GENERATION_ENABLED=false` default remains | Env restore in 9.7 |
| Live provider optional smoke documented | `docs/49` or appendix |

---

## 16. Risks & Guardrails

### Risks

| Risk | Mitigation |
|---|---|
| Cost runaway (provider USD >> credit) | Fixed credit costs; `estimated_cost_usd` observation; staging spend cap |
| Rewrite changes story facts | Context packet same beat; safety scan; user edit control |
| Publish copy overclaims | Reuse Sprint 7 overclaim patterns + AI output scan |
| Double debit | Idempotency key + ledger uniqueness |
| Unsafe output persisted | `assertProviderOutputSafe`; refund on fail |
| User confusion about credit | Saldo + biaya before click; clear Indonesian errors |
| OpenRouter model deprecation | Allowlist discipline; staging smoke before expand |
| Suggestion-first UX friction | Document apply fallback |

### Guardrails (carry forward Sprint 8)

- Fixed credit costs (`ai-credit-policy`)
- Idempotency per user+key
- Safety scan on output
- Overclaim scan on publish
- User edit control post-AI
- No canon mutation
- `AI_GENERATION_ENABLED=false` default
- Mock smoke matrix + limited live smoke

---

## 17. Recommended First Coding Task

### Task 9.1 — AI Cost Estimation + Generation Attempt Cost Metadata

**Reason:**

1. Small, low-risk change — extends existing success path only.
2. Closes known gap from Task 8.9b (`estimated_cost_usd` null despite tokens).
3. Improves observability **before** adding rewrite/publish (more provider calls).
4. No migration, no new endpoints, no UI dependency.
5. Validates pricing verification discipline for `google/gemini-2.5-flash`.

**First files to touch:**

- `apps/api/src/services/model-cost-map.ts` (new)
- `apps/api/src/services/generation-attempt.ts` — extend `markGenerationAttemptSucceeded`
- `apps/api/src/services/prose-beat-generation.ts` — pass computed cost
- `scripts/sprint8-smoke-api.ps1` — assert `estimated_cost_usd` non-null on mock success (optional extend)

---

## 18. Verification for Task 9.0

| Check | Result |
|---|---|
| Docs-only | ✅ No application code changed in 9.0 |
| Build | tidak dijalankan — not required |
| Smoke | tidak dijalankan — no new tests claimed |
| Secrets | No OpenRouter key in docs/logs |
| `.dev.vars` | Not committed |

---

## Related documents

- [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)
- [`docs/45-sprint-8-verification-report.md`](45-sprint-8-verification-report.md)
- [`docs/46-live-openrouter-staging-verification-plan.md`](46-live-openrouter-staging-verification-plan.md)
- [`docs/47-live-openrouter-staging-smoke-report.md`](47-live-openrouter-staging-smoke-report.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`.agents/rules/09-agent-work-logs.md`](../.agents/rules/09-agent-work-logs.md)