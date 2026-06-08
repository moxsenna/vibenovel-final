# 38 — Sprint 6 Verification Report

**Sprint:** Sprint 6 — Chapter Summary, Chapter Delta & Canon Proposal Flow  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`](37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md)

Dokumen ini adalah laporan penutupan resmi Sprint 6. Dibaca oleh developer manusia dan AI agent sebelum memulai Sprint 7.

**Work logs:** `.agent-logs/sprint-6/task-6.0` … `task-6.7`

---

## 1. Sprint 6 Summary

### Tujuan Sprint 6

Mengubah **halaman Ringkasan Bab** (`/projects/:id/summary`) dari mock Sprint 1 menjadi **workflow persistence nyata** yang menutup satu bab setelah Write Room — tanpa mempromosikan prose draft langsung ke canon:

```txt
ready_for_summary (Sprint 5)
  → Generate chapter summary (stub)
  → Extract chapter delta + linked ai_proposals
  → User approve summary (lifecycle only)
  → User accept/reject proposals individually (explicit canon promotion)
  → chapter_writing_states.summarized + writing_sessions.completed
```

### Status akhir

| Aspek | Status |
|---|---|
| Migration `00005` + shared Sprint 6 types | **Selesai (Task 6.1)** |
| Chapter summary generation stub API | **Selesai (Task 6.2)** |
| Chapter delta + proposal extraction API | **Selesai (Task 6.3)** |
| Summary approval + proposal promotion API | **Selesai (Task 6.4)** |
| SummaryPage web integration | **Selesai (Task 6.5)** |
| Safety & regression tests | **Selesai (Task 6.6)** |
| Sprint 6 verification report | **Selesai (Task 6.7)** |
| OpenRouter / AI generation production | **Tidak ada (by design)** |
| Publish package | **Deferred Sprint 7** |
| Remote deploy / remote migration | **Tidak dilakukan** |

### Fitur yang selesai

- Tabel baru: `chapter_summaries`, `chapter_deltas`, `chapter_summary_items`, `chapter_summary_proposals`
- Extend `ai_proposal_type` / `ai_proposal_source` untuk delta-driven proposals
- Deterministic summary stub dari prose + beats + outline (`summary_stub_v1`)
- Deterministic delta extractor + proposal linker (`chapter_delta_v1_stub`)
- Summary approval workflow (approve ≠ canon promotion)
- Explicit proposal accept/reject dengan type-specific canon promotion (`fact` confirmed, dll.)
- Web: `SummaryPage` + `useSummaryData` + workflow/proposal panels + mock fallback
- Safety smoke: API 59/59 + Sprint 5 regression 49/49 + summary E2E mock + API-mode 11/11
- Sprint 2 regression smoke tetap PASS (`npm run smoke:api` 17/17)

### Fitur yang masih deferred

- Publish package / KBM export (Sprint 7)
- OpenRouter / model routing / AI generation production
- Full LLM chapter delta extractor
- UI `confirmHighRisk` untuk reveal berisiko tinggi
- Instruction Compliance Validator production
- Credit deduction / ledger (Sprint 8)
- Mass proposal auto-accept / merge endpoint
- DB transaction wrapper untuk promotion multi-step
- `audit_action` enum extension untuk summary-specific events
- Character/relationship promotion beyond minimal paths
- API-mode web E2E di GitHub Actions CI
- `smoke:all:local` belum include `sprint6-smoke-api` / `sprint6-smoke-web`
- Remote Cloudflare deploy

---

## 2. Architecture Added

### Migration `00005` (Task 6.1)

- File: `supabase/migrations/00005_sprint6_chapter_summary_delta.sql`
- 4 tabel + 5 enum PostgreSQL baru + extend `ai_proposal_type` / `ai_proposal_source`
- RLS owner-only via `is_project_owner(project_id)`
- No triggers writing to `facts` / `characters` / `open_loops` / `reveals`

### Shared Sprint 6 types (Task 6.1)

- `packages/shared/src/enums.ts` — `CHAPTER_SUMMARY_STATUSES`, `CHAPTER_DELTA_STATUSES`, `CHAPTER_SUMMARY_ITEM_TYPES`, `CHAPTER_SUMMARY_PROPOSAL_STATUSES`, extended `AI_PROPOSAL_TYPES` / `AI_PROPOSAL_SOURCES`
- `packages/shared/src/domain.ts` — `ChapterSummary`, `ChapterDelta`, `ChapterSummaryItem`, payload types

### Chapter summary generation stub API (Task 6.2)

| Layer | Files |
|---|---|
| Generator | `apps/api/src/services/chapter-summary-generator.ts` |
| Snapshot | `apps/api/src/services/summary-snapshot.ts` |
| Service | `apps/api/src/services/chapter-summary.ts` |
| Routes | `apps/api/src/routes/summary.ts` |

### Chapter delta extraction API (Task 6.3)

| Layer | Files |
|---|---|
| Extractor | `apps/api/src/services/chapter-delta-extractor.ts` |
| Service | `apps/api/src/services/chapter-delta.ts` |
| Linker | `apps/api/src/services/summary-proposal-linker.ts` |
| Routes | `apps/api/src/routes/summary.ts` |

### Summary approval + proposal promotion API (Task 6.4)

| Layer | Files |
|---|---|
| Approval | `apps/api/src/services/chapter-summary-approval.ts` |
| Review | `apps/api/src/services/summary-proposal-review.ts` |
| Promotion | `apps/api/src/services/proposal-canon-promotion.ts` |
| Routes | `apps/api/src/routes/summary.ts` |

### SummaryPage web integration (Task 6.5)

| Layer | Files |
|---|---|
| Page | `apps/web/src/pages/SummaryPage.tsx` |
| Hook | `apps/web/src/hooks/useSummaryData.ts` |
| Service | `apps/web/src/services/summary.ts` |
| Mapper | `apps/web/src/lib/summary-mappers.ts` |
| Components | `SummaryWorkflowActions`, `SummaryProposalReviewPanel` |

### Sprint 6 safety smoke tests (Task 6.6)

- `scripts/sprint6-smoke-api.ps1` — 59 steps
- `scripts/sprint6-smoke-web.ps1` + `apps/web/e2e/sprint6-summary-flow.spec.ts`
- `npm run smoke:api:sprint6`, `npm run smoke:web:summary`

---

## 3. Database Verification

### Migration `00005`

| Check | Status |
|---|---|
| `supabase db reset` applies 00001–00005 | **PASS** (8 Juni 2026, Task 6.7) |
| Seed applies without Sprint 6 summary rows | **Confirmed** — comment in `seed.sql` |
| RLS owner-only on all Sprint 6 tables | **Confirmed** |

### Tabel baru

| Table | Purpose |
|---|---|
| `chapter_summaries` | Review artifact per bab; status workflow; `is_current` versioning |
| `chapter_deltas` | Structured delta JSON 1:1 per summary |
| `chapter_summary_items` | Normalized summary sections (facts, changes, loops, notes) |
| `chapter_summary_proposals` | Junction summary ↔ `ai_proposals` |

### Enum extensions

- `ai_proposal_type`: `open_loop_update`, `reveal_status_update`, `character_update`, `relationship_update`
- `ai_proposal_source`: `summary_stub`, `chapter_delta_stub`

### No Sprint 6 seed summary

Demo seed (`seed.sql`) tidak memasukkan `chapter_summaries` — summary hanya via API generate setelah `ready_for_summary`.

---

## 4. API Endpoint Map

Semua endpoint Sprint 6 memerlukan **Bearer JWT**. Ownership via `getOwnedProjectRow` + row `project_id` match — cross-user → **404**.

### Summary generation & read

| Endpoint | Purpose | Tested | Limitation |
|---|---|---|---|
| `GET /api/projects/:id/summary` | List current summaries + `itemCount` | **PASS** (smoke) | Filter by `chapterOutlineId` / `status` optional |
| `POST /api/projects/:id/summary/generate` | Stub generate dari prose+beats+outline | **PASS** | Gate `ready_for_summary`; deterministic stub only |
| `GET /api/projects/:id/summary/:summaryId` | Detail + items | **PASS** | No prose text in response |
| `GET /api/projects/:id/summary/by-chapter/:chapterOutlineId` | Current summary or null | **PASS** | Used by SummaryPage load |

### Delta / proposals

| Endpoint | Purpose | Tested | Limitation |
|---|---|---|---|
| `POST .../summary/:summaryId/delta/extract` | Extract delta + create linked proposals | **PASS** | Max 5 proposals; `regenerate=true` blocked if proposals exist |
| `GET .../summary/:summaryId/delta` | Safe delta JSON | **PASS** | No prose/planningTruth |
| `GET .../summary/:summaryId/proposals` | Linked proposal safe excerpts | **PASS** | No raw payload; allowed keys only |

### Approval / review

| Endpoint | Purpose | Tested | Limitation |
|---|---|---|---|
| `POST .../summary/:summaryId/approve` | Approve summary lifecycle | **PASS** | Does not accept proposals; idempotent if already approved |
| `POST .../proposals/:proposalId/accept` | Explicit canon promotion | **PASS** | Requires summary approved; reveal needs `confirmHighRisk` |
| `POST .../proposals/:proposalId/reject` | Reject without canon change | **PASS** | Cannot reject accepted proposal |

---

## 5. Web Integration Status

| Area | Status |
|---|---|
| **SummaryPage** | Sprint 1 layout preserved; API workflow panels added |
| **useSummaryData** | `mock` / `api` / `api-fallback`; project resolve via `resolveProjectIdForRoute` |
| **SummaryWorkflowActions** | Buat Ringkasan / Ekstrak Perubahan CTAs |
| **SummaryProposalReviewPanel** | Terima/Tolak per proposal; high-risk badge |
| **VITE_USE_MOCKS=true** | Full `mockChapterSummary` (unchanged Sprint 1 path) |
| **API error / no login** | Mock fallback + `IntegrationNotice` |
| **Generate summary** | POST generate when ready + no summary |
| **Extract delta/proposals** | POST extract; panel shows linked proposals |
| **Approve summary** | Footer CTA; copy: approve ≠ auto canon |
| **Accept/reject proposal** | Per-item; accept gated until summary approved |
| **High-risk reveal** | Badge "Butuh konfirmasi manual"; Terima disabled; no auto `confirmHighRisk` |
| **Leak guard DOM** | Playwright regex: no planningTruth/packet_json/prose_text/provider/model/token |

---

## 6. Canon Boundary Confirmed

| Rule | Status |
|---|---|
| Prose draft bukan canon | **Confirmed** — Sprint 5 regression PASS |
| Chapter summary bukan canon otomatis | **Confirmed** — generate tidak mutate facts/characters/etc. |
| Chapter delta bukan canon otomatis | **Confirmed** — extract hanya creates proposed proposals |
| Summary approval bukan canon promotion | **Confirmed** — smoke: facts unchanged after approve |
| Delta extraction hanya membuat proposed proposals | **Confirmed** — all `status=proposed`, `linkStatus=linked` |
| Proposal reject tidak mutate canon | **Confirmed** — smoke reject path |
| Proposal accept eksplisit baru mutate canon | **Confirmed** — fact accept +1 confirmed fact |
| Fact proposal accept creates confirmed fact | **Confirmed** — `source=accepted_proposal` |
| High-risk reveal tidak auto-promote tanpa `confirmHighRisk` | **Confirmed** — API 409; UI Terima disabled |
| No auto-accept all proposals | **Confirmed** — approve + extract smoke |

---

## 7. Safety / Leak Guard Confirmed

| Guard | Status |
|---|---|
| No `planningTruth` / `planning_truth` in API response | **Confirmed** — regex smoke 59/59 |
| No `packet_json` in API response | **Confirmed** |
| No `prose_text` in summary/proposal response | **Confirmed** |
| No raw unsafe payload in UI | **Confirmed** — mapper + safe excerpt only |
| No leak markers in DOM | **Confirmed** — mock + API-mode Playwright |
| Sprint 5 context/prose leak regression PASS | **Confirmed** — 49/49 |
| SummaryPage copy avoids canon overclaim | **Confirmed** — E2E asserts "tidak otomatis memasukkan" |

---

## 8. Smoke Test Checklist

### Build & typecheck (8 Juni 2026, Task 6.7)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `supabase db reset` | **PASS** — migrations 00001–00005 + seed |
| `npm run smoke:api` | **PASS** — 17/17 (Sprint 2 regression) |
| `npm run smoke:api:sprint5` | **PASS** — 49/49 |
| `npm run smoke:api:sprint6` | **PASS** — 59/59 |
| `npm run smoke:web` | **PASS** — 3 mock; API NOT RUN |
| `npm run smoke:web:write` | **PASS** — mock; API NOT RUN |
| `npm run smoke:web:summary` | **PASS** — mock |
| `npm run smoke:web:summary -- -IncludeApiMode` | **PASS** — 11/11 (mock + API full flow) |

### Sprint 6 API runtime smoke (8 Juni 2026)

Script: `scripts/sprint6-smoke-api.ps1` — **59/59 PASS**

| Area | Key tests |
|---|---|
| Summary generate | 401/409 gates; leak guard; no canon mutation; regenerate idempotent + supersedes |
| Delta extract | Proposals linked+proposed; no canon mutation; regenerate blocked |
| Approval | No auto-accept; session completed; writing state summarized; idempotent |
| Promotion | Accept fact +1 canon; reject unchanged; reveal 409 without confirm |
| Cross-user | list/detail/delta/proposals/approve/accept/reject → 404 |

### Web runtime smoke Sprint 6 (8 Juni 2026)

| Test | Result |
|---|---|
| Mock `/summary` — render + no DOM leaks | **PASS** |
| API-mode summary full flow | **PASS** (11/11) |
| Generate → extract → approve → accept/reject | **PASS** |
| Proposal panel visible after approve | **PASS** |
| High-risk Terima disabled when badge present | **PASS** |
| No canon overclaim copy | **PASS** |

---

## 9. Runtime Verification Summary

| Item | Result |
|---|---|
| Sprint 6 API smoke | **59/59 PASS** |
| Sprint 5 API smoke regression | **49/49 PASS** |
| Sprint 2 API smoke regression | **17/17 PASS** |
| Summary web mock | **PASS** |
| Summary web API-mode | **PASS 11/11** |
| Production deploy | **NOT RUN** (by design) |
| Remote migration push | **NOT RUN** (by design) |

---

## 10. Known Limitations

- **No publish package yet** — deferred Sprint 7
- **No OpenRouter / AI generation** — stub summary + delta only
- **No model router** — deferred
- **No credit deduction** — deferred Sprint 8
- **Deterministic/stub** summary and delta extraction — not production NLP quality
- **No UI `confirmHighRisk`** — high-risk reveal accept disabled in web; API requires body flag
- **API-mode web E2E not in GitHub Actions** — local-only
- **No DB transaction wrapper** for summary approve / proposal promotion
- **`audit_action` enum** not extended — approve uses `project_updated` + metadata
- **Character/relationship promotion** minimal — partial payload → 409 unsupported
- **`smoke:all:local`** does not yet include sprint6 scripts
- **Integration bugfix Task 6.5:** `write-session` resumes `ready_for_summary` session (not only `active`)

---

## 11. Closure Decision

| Question | Answer |
|---|---|
| **Sprint 6 ready to close?** | **Yes** |
| **Blockers** | None |
| **Non-blocking limitations** | Publish package (S7), OpenRouter/AI, `confirmHighRisk` UI, CI E2E, DB transactions, audit enum — documented in §10 and `docs/36` |

Sprint 6 acceptance criteria dari `docs/37` §12 terpenuhi via smoke + web integration + canon boundary tests.

---

## 12. Recommended Next Sprint

**Primary recommendation: Sprint 7 — Publish Package / KBM Export Flow**

Alasan:

- Sprint 6 menyelesaikan alur `ready_for_summary` → summary approved → proposals reviewed → bab `summarized`.
- Input natural untuk publish package: approved summary + current prose versions + canon state.
- Publish package sudah direncanakan sebagai Sprint 7 di roadmap; **bukan** scope Sprint 6.

**Optional pre-Sprint-7 hardening (Task 6.8 atau awal S7):**

- Audit log enum extension + transaction wrappers untuk proposal promotion
- `smoke:all:local` include sprint6
- `confirmHighRisk` UI untuk reveal proposals

Alasan hardening opsional: debt P1 di `docs/36` — sebelum production deploy atau AI generation, audit + transactions lebih aman; tidak memblokir mulai Sprint 7 publish stub.

---

## Related documents

- [`docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`](37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md)
- [`docs/35-sprint-5-verification-report.md`](35-sprint-5-verification-report.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`apps/api/README.md`](../apps/api/README.md) — Tasks 6.2–6.4 API reference
- [`scripts/README.md`](../scripts/README.md) — smoke command index