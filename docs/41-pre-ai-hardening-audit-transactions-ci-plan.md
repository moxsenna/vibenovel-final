# 41 — Pre-AI Hardening: Audit Logs, Transactions & CI Smoke Plan

**Status:** Planning only — no migration, no API changes, no CI workflow changes yet  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md), [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)

Dokumen ini adalah **rencana hardening** sebelum Sprint 8 AI/OpenRouter. Bukan implementasi. Agent dan developer wajib membaca ini sebelum menulis migration audit enum, transaction wrappers, atau mengubah CI.

**Keputusan arsitektur (user-approved direction):**

```txt
Sprint 1–7 MVP artifact flow selesai (idea → publish package).
Hardening WAJIB sebelum AI/OpenRouter/credit production.
Prioritas: audit logs → transaction atomicity → smoke consolidation → CI strategy.
Tidak OpenRouter, tidak AI generation, tidak credit deduction di fase plan ini.
```

---

## 1. Purpose

### Kenapa hardening perlu sebelum AI/OpenRouter

Sprint 1–7 menutup alur **non-AI persistence** dari ide hingga paket publish copy-ready. Semua workflow kritikal (canon promotion, summary approval, publish export marker) sudah diverifikasi via smoke lokal, tetapi:

- **Audit trail tidak lengkap** — banyak aksi multi-tabel tidak punya event `audit_logs` khusus; beberapa memakai `project_updated` generik atau tidak menulis audit sama sekali.
- **Atomicity tidak dijamin** — workflow multi-step (foundation lock, outline lock, prose versioning, proposal promotion, publish regenerate) dapat meninggalkan state parsial jika gagal di tengah.
- **CI tidak menangkap regresi runtime** — GitHub Actions hanya `typecheck` + `build`; smoke Supabase/Playwright 100% lokal.
- **AI production memperbesar risiko** — setiap generasi AI menambah: prompt logging policy, provider/model metadata, credit deduction, leakage surface, dan kebutuhan forensik saat canon berubah.

### Risiko jika langsung masuk AI production

| Risk | Impact |
|---|---|
| Canon berubah tanpa audit yang dapat dilacak | Tidak bisa debug “siapa/kapan/mengapa” fakta masuk canon |
| Partial failure di promotion/prose/summary | Data inkonsisten; sulit recovery |
| Context packet / prompt leak tanpa policy | Secret atau planningTruth bisa masuk log eksternal |
| Credit deduction tanpa ledger + audit | Dispute billing; tidak accountable |
| CI tidak menjalankan smoke Sprint 5–7 | Regresi leak/canon boundary lolos ke main |
| Marker false-positive pada prose AI | Konten valid ditolak atau sebaliknya leak lolos |

---

## 2. Current System State

### Sprint 1–7 completed

| Sprint | Deliverable |
|---|---|
| 1 | UI parity Stitch, typed mocks, routing |
| 2 | Core schema, auth, foundation CRUD, proposals, audit_logs baseline |
| 3 | Intake, concepts, foundation flow |
| 4 | Outline generate/edit/approve/lock |
| 5 | Write Room, context packet preview, prose versioning |
| 6 | Chapter summary, delta, proposal review, canon promotion |
| 7 | Publish package generate/edit/checklist/mark-exported |

### End-to-end flow (verified locally)

```txt
idea/intake → concepts → foundation lock
  → outline generate/approve/lock
  → write session / beats / prose draft
  → ready_for_summary
  → summary generate → delta extract → approve summary
  → proposal accept/reject (explicit canon)
  → publish package generate → edit → mark-exported (manual copy marker)
```

### Smoke status terakhir (8 Juni 2026, Task 7.5–7.6)

| Suite | Result |
|---|---|
| Sprint 2 API (`smoke:api`) | **17/17 PASS** |
| Sprint 5 API (`smoke:api:sprint5`) | **49/49 PASS** |
| Sprint 6 API (`smoke:api:sprint6`) | **59/59 PASS** |
| Sprint 7 API (`smoke:api:sprint7`) | **50/50 PASS** |
| Web summary mock | **PASS** |
| Web publish mock | **PASS** |
| Web summary API-mode (`-IncludeApiMode`) | **PASS** (Task 6.5) |
| Web publish API-mode (`-IncludeApiMode`) | **PASS** (Task 7.5) |

### Audit infrastructure today

- Tabel `audit_logs` + enum `audit_action` (Sprint 2, migration `00001`)
- Writer: `apps/api/src/services/audit.ts` — `writeAuditLog()` via service role
- **Sudah menulis audit:** project create/update, settings, foundation upsert/lock (partial), character/fact/speech CRUD, ai_proposal lifecycle, chapter-summary approve (`project_updated` + metadata)
- **Belum menulis audit khusus:** intake, concepts, outline lock, write room, context packet, delta extract, publish export, proposal promotion detail

### CI today

- `.github/workflows/ci.yml` — Ubuntu, Node 20, `npm ci` → typecheck → build shared/web/api
- **No** Docker, Supabase, Wrangler dev, Playwright, secrets

---

## 3. Audit Log Gaps

### Existing `audit_action` values (migration `00001`)

```txt
project_created, project_updated, settings_updated,
foundation_created, foundation_updated, foundation_locked,
character_created, character_updated,
fact_created, fact_updated, fact_deprecated,
speech_rule_created, speech_rule_updated,
ai_proposal_created, ai_proposal_accepted, ai_proposal_rejected, ai_proposal_merged,
credit_balance_seeded
```

### Gap matrix by workflow

| Workflow | Current audit | Gap |
|---|---|---|
| **Intake / concept** | None | No events for message, signal extract, concept generate/select |
| **Foundation lock / promotion** | `foundation_locked` + per-entity creates on promote | No `foundation_proposals_generated`; promote batch not one correlated event |
| **Outline generate/edit/lock** | `project_updated` on some phase changes | No `outline_generated`, `outline_approved`, `outline_locked`, `chapter_outline_updated` |
| **Write session / beat / prose** | None | No session start, beats generate, prose save, ready_for_summary |
| **Context packet build** | None | No `context_packet_built` (critical before AI) |
| **Summary generate** | None | No `chapter_summary_generated` / version supersede |
| **Delta extract + proposal link** | `ai_proposal_created` for proposals | No `chapter_delta_extracted`, `summary_proposal_linked` |
| **Summary approval** | `project_updated` + metadata | Should be `chapter_summary_approved` |
| **Proposal canon promotion** | `ai_proposal_accepted` | Missing entity context for summary link; no `canon_entity_promoted` |
| **Publish generate/update/export** | None | No publish lifecycle events |

### Proposed `audit_action` enum additions (plan only — migration deferred)

**Group A — Intake & foundation flow**

| Proposed action | Trigger |
|---|---|
| `intake_message_added` | POST intake message |
| `intake_signals_extracted` | POST extract-signals |
| `concept_generated` | POST concepts/generate |
| `concept_selected` | POST concepts/:id/select |
| `foundation_proposals_generated` | POST foundation/proposals/generate |

**Group B — Outline**

| Proposed action | Trigger |
|---|---|
| `outline_generated` | POST outline/generate |
| `outline_approved` | POST outline/approve |
| `outline_locked` | POST outline/lock |
| `chapter_outline_updated` | PATCH chapter outline |

**Group C — Write room & context**

| Proposed action | Trigger |
|---|---|
| `writing_session_started` | POST write/sessions |
| `beats_generated` | POST beats/generate |
| `beat_updated` | PATCH beat |
| `prose_version_saved` | POST prose |
| `writing_session_ready_for_summary` | POST ready-for-summary |
| `context_packet_built` | POST context-packet (log id only in metadata) |

**Group D — Summary & canon**

| Proposed action | Trigger |
|---|---|
| `chapter_summary_generated` | POST summary/generate |
| `chapter_delta_extracted` | POST delta/extract |
| `chapter_summary_approved` | POST summary/approve |
| `summary_proposal_accepted` | POST proposals/:id/accept (or enrich `ai_proposal_accepted` metadata) |
| `summary_proposal_rejected` | POST proposals/:id/reject |
| `canon_entity_promoted` | After fact/character/etc. promotion from proposal |

**Group E — Publish**

| Proposed action | Trigger |
|---|---|
| `publish_package_generated` | POST publish/generate |
| `publish_package_fields_updated` | PATCH fields |
| `publish_package_checklist_updated` | PATCH checklist |
| `publish_package_exported` | POST mark-exported |

### Proposed `audit_entity_type` additions (plan only)

```txt
outline_plan, chapter_outline, open_loop, reveal,
writing_session, chapter_beat, chapter_prose_version,
context_packet_log, chapter_summary, chapter_delta,
chapter_summary_proposal_link, publish_package
```

### Audit writer policy (plan)

- **Never log:** tokens, JWT, service role, full `packet_json`, `planningTruth`, raw OpenRouter request/response (future)
- **Do log:** `entityId`, `projectId`, `userId`, action, compact `metadata` (ids, versions, status transitions), optional redacted `before_data`/`after_data` hashes
- **Failure policy:** audit write failure → 500 (fail closed for canon/export actions); best-effort for read-only builds (TBD in 7.8.2)

---

## 4. Transaction / Atomicity Gaps

| Workflow | Current risk | Suggested mitigation | Priority |
|---|---|---|---|
| **Foundation lock promotion** | Multi-row promote (characters, facts, speech rules) + lock flag — partial promote possible | Single DB transaction: validate all proposals → promote → lock foundation → audit batch | **P0** |
| **Outline lock** | Plan status + chapters + `workflow_phase` may diverge | Transaction: lock plan + verify all chapters + update project phase | **P1** |
| **Prose save versioning** | Flip `is_current`, insert version, update word count/session — race on concurrent save | Transaction per beat; optimistic lock on `version_number` | **P1** |
| **Summary generation versioning** | Supersede previous `is_current` + insert items — partial if insert fails | Transaction: supersede old + insert summary + items | **P1** |
| **Delta extraction + proposal enqueue** | Delta row + N proposals + links — orphan delta if link fails | Transaction: delta upsert + proposals + `chapter_summary_proposals` links | **P0** |
| **Summary approval + state updates** | Summary status + writing_state + session completed — partial completion | Transaction: approve summary + set writing_state summarized + session completed | **P1** |
| **Proposal accept + canon promotion** | Proposal status + fact/character insert — canon without accepted status or vice versa | Transaction: accept proposal + promote entity + audit | **P0** |
| **Publish regenerate** | Supersede current + insert new version — two current rows possible on failure | Transaction: supersede rows + insert new package | **P1** |
| **Publish mark-exported** | Status + exported_at + metadata — low risk but should pair with audit | Transaction: update package + write `publish_package_exported` audit | **P1** |

### Implementation strategy (plan — not code yet)

1. **Phase 1:** Introduce `withTransaction(bindings, fn)` helper using Supabase/Postgres RPC or sequential admin client with explicit `BEGIN`/`COMMIT` via `supabase.rpc` wrapper.
2. **Phase 2:** Apply to P0 workflows first (foundation lock, delta extract, proposal accept).
3. **Phase 3:** Add validate-all-before-write pattern — collect validation errors, no writes until all pass.
4. **Alternative MVP:** Postgres stored procedures for highest-risk paths if JS transaction wrapper proves awkward on Cloudflare Worker.

---

## 5. CI / Smoke Gaps

### Current gaps

| Gap | Detail |
|---|---|
| CI scope | typecheck + build only — no runtime regression |
| Supabase smoke | Requires Docker + local `dev:api` — not in GHA |
| API-mode web E2E | Playwright + dual env + `VITE_USE_MOCKS=false` — local only |
| `smoke:all:local` | Includes sprint2 + sprint5 API + sprint3/4/5 web mock only — **missing sprint6/7 API + summary/publish web** |
| `smoke:all:local:full` | Same gap for API-mode web (no summary/publish in orchestrator) |
| Script portability | PowerShell primary — no bash port for Linux CI |
| Secrets in CI | Would need `SUPABASE_*`, anon key, optional test user — not configured |

### Proposed `smoke:all:local` update (Task 7.8.4)

```txt
Order (fail-fast):
  1. sprint2-smoke-api.ps1      (17)
  2. sprint5-smoke-api.ps1      (49)
  3. sprint6-smoke-api.ps1      (59)
  4. sprint7-smoke-api.ps1      (50)
  5. sprint3-smoke-web.ps1      (mock)
  6. sprint4-smoke-web.ps1      (mock)
  7. sprint5-smoke-web.ps1      (mock)
  8. sprint6-smoke-web.ps1      (mock)
  9. sprint7-smoke-web.ps1      (mock)
```

### Proposed `smoke:all:local:full` update

Same as above, pass `-IncludeApiMode` to web scripts 3–9 (or subset: write, summary, publish minimum).

### Optional CI matrix strategy (Task 7.8.5)

| Job | When | Contents |
|---|---|---|
| `ci-build` (existing) | Every push/PR | typecheck + build — **keep** |
| `ci-smoke-api` (optional, Phase 2) | nightly or manual `workflow_dispatch` | Self-hosted Windows OR Linux with Docker + `supabase start` + API smokes sprint2/5/6/7 |
| `ci-smoke-web-mock` (optional, Phase 2) | nightly | Playwright mock only — no Supabase if web mock sufficient |
| `ci-smoke-web-api` (optional, Phase 3) | pre-release manual | Full API-mode — heavy |

### Why not force full Supabase E2E in GitHub Actions immediately

1. **Runtime:** sprint5+6+7 API smokes ~3–5 min each with bootstrap; full suite >15 min.
2. **Infrastructure:** GHA ubuntu needs Docker-in-Docker; Supabase CLI + port binding flaky on shared runners.
3. **Secrets:** Requires anon key / test credentials — policy not established.
4. **Script OS:** PowerShell scripts are primary; bash port is prerequisite for Linux CI parity.
5. **Dual servers:** API-mode web needs `dev:api` + `dev:web` concurrently — orchestration complex in CI.
6. **Cost/flake:** Playwright + Supabase on every PR likely causes false failures; better as **nightly** or **pre-release** gate first.

**Recommended path:** Consolidate local `smoke:all:local` first (7.8.4) → bash port subset (P2) → optional nightly workflow (7.8.5) → PR gate only after stability proven.

---

## 6. Security / Leak Guard Gaps

| Area | Current state | Hardening need |
|---|---|---|
| Context Packet safety | API assertion + smoke regex; **not** DB constraint on `packet_json` | Consider JSON schema check trigger or storage policy before AI |
| Marker false positives | `model`/`token`/`provider` substring rejection in prose/publish | Refine markers to structured-field-only before AI prose volume |
| Instruction Compliance Validator | Not production | Required before AI writer output trusted |
| AI prompt logging policy | None | Define: never log full prompt; log hash + model id + token count only |
| Provider/model/token audit | None | Future: `chapter_generation_attempts` + audit metadata without secret values |
| Publish export audit | metadata on row only | `publish_package_exported` audit action (7.8.2) |

---

## 7. Recommended Hardening Task Breakdown

| Task | Scope | Deliverable |
|---|---|---|
| **7.8.1** | Audit action enum + entity type plan + writer coverage map | Migration design doc + shared enum draft + service touch list |
| **7.8.2** | Implement audit logs for canon-changing and export actions | Migration `00007` enum extend + `writeAuditLog` calls in P0 paths |
| **7.8.3** | Transaction wrapper strategy + P0 workflow hardening | `withTransaction` helper + foundation lock / delta / proposal accept |
| **7.8.4** | `smoke:all:local` + `:full` include Sprint 6/7 | Update `smoke-all-local.ps1`, `scripts/README.md`, root `package.json` comment |
| **7.8.5** | CI E2E feasibility + optional workflow | `.github/workflows/smoke-nightly.yml` draft or documented defer |
| **7.8.6** | Hardening verification report | `docs/42` + regression smoke all PASS |

**Dependency order:**

```txt
7.8.1 → 7.8.2 (audit enum before writers)
7.8.3 (transactions) can parallel 7.8.2 after 7.8.1 design frozen
7.8.4 (smoke consolidate) independent — can start immediately after plan approve
7.8.5 after 7.8.4 stable
7.8.6 after 7.8.2–7.8.5
```

---

## 8. Out of Scope

- OpenRouter / AI generation / model router
- Credit deduction / ledger implementation
- KBM auto-post / publish automation
- UI redesign (`confirmHighRisk`, regenerate publish, chapter picker)
- Instruction Compliance Validator production
- Remote deploy / remote migration push
- Changing Sprint 1–7 product behavior except audit/transaction/smoke infrastructure

---

## 9. Acceptance Criteria for Hardening Sprint

| Criterion | Measure |
|---|---|
| No feature behavior change | Unless adding audit/transaction/smoke — existing API contracts unchanged |
| Audit coverage | P0 canon/export actions emit dedicated `audit_logs` rows |
| Smoke regression | Sprint 2/5/6/7 remain PASS after hardening |
| `smoke:all:local` | Includes sprint6 + sprint7 API + summary + publish web mock |
| `docs/36` updated | Debt items marked addressed or re-prioritized |
| No AI/OpenRouter | Zero provider integration in hardening sprint |

---

## 10. Recommendation

### Plan vs implement

**Task 7.8 (this document) = plan only.** Implementasi hardening dilakukan di task **7.8.1–7.8.6** setelah plan di-approve.

### First implementation task

**Task 7.8.1 — Audit Action Enum + Audit Coverage Plan**

Alasan:

1. Enum extension adalah prerequisite untuk semua audit writers (7.8.2).
2. Low behavioral risk — design-only + migration draft sebelum touch services.
3. Maps langsung ke gap P1 di `docs/36` dan `docs/40` §12.
4. Tidak memblokir smoke consolidation (7.8.4) yang bisa jalan paralel.

### Sprint 8 gate

Sprint 8 (AI/OpenRouter & credit) **tidak dimulai** sampai minimal:

- 7.8.2 audit P0 paths ✅
- 7.8.3 transaction P0 paths ✅
- 7.8.4 smoke:all:local updated ✅
- 7.8.6 verification report ✅

CI nightly (7.8.5) boleh deferred non-blocking jika local smoke suite lengkap.

---

## Related documents

- [`docs/40-sprint-7-verification-report.md`](40-sprint-7-verification-report.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`scripts/README.md`](../scripts/README.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- `.agent-logs/sprint-7/task-7.8-pre-ai-hardening-plan.md`