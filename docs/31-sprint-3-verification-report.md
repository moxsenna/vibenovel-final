# 31 — Sprint 3 Verification Report

**Sprint:** Sprint 3 — Story Foundation Flow (Intake → Concepts → Foundation)  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/30-sprint-3-story-foundation-flow-implementation-plan.md`](30-sprint-3-story-foundation-flow-implementation-plan.md)

Dokumen ini adalah laporan penutupan resmi Sprint 3. Dibaca oleh developer manusia dan AI agent sebelum memulai Sprint 4.

**Work logs:** `.agent-logs/sprint-3/task-3.0` … `task-3.8`

---

## 1. Sprint 3 Summary

### Tujuan Sprint 3

Mengubah **alur awal cerita** dari mock Sprint 1 menjadi **persistence nyata** yang aman untuk serial fiction panjang:

```txt
Start project
  → Chat intake (tersimpan)
  → Detected signals (tersimpan)
  → 3 concept options (tersimpan, bukan canon)
  → User memilih concept
  → Foundation proposal bundle (ai_proposals, bukan facts langsung)
  → Readiness score (server-computed)
  → User review + accept proposal per item
  → Lock foundation (batasi edit core)
```

Tanpa OpenRouter, tanpa AI generation production, tanpa outline/chapter/prose persistence.

### Status akhir

| Aspek | Status |
|---|---|
| Migration `00002` + shared Sprint 3 types | **Selesai (Task 3.1)** |
| Intake API (sessions, messages, signals) | **Selesai (Task 3.2)** |
| Concept options API | **Selesai (Task 3.3)** |
| Foundation proposal + readiness | **Selesai (Task 3.4)** |
| Lock foundation workflow | **Selesai (Task 3.5)** |
| Web integration intake/concepts/foundation | **Selesai (Task 3.6)** |
| Sprint 3 verification | **Selesai (Task 3.7)** |
| Web E2E smoke automation | **Selesai (Task 3.8)** |
| OpenRouter / AI generation | **Tidak ada (by design)** |
| Remote deploy / remote migration | **Tidak dilakukan** |

### Fitur yang selesai

- Tabel baru: `intake_sessions`, `intake_messages`, `detected_signals`, `story_concepts`
- Kolom baru `projects`: `workflow_phase`, `selected_concept_id`
- Intake chat persistence + deterministic agent stub reply
- Rule-based signal extraction (bukan AI)
- Stub generate 3 concepts + select concept
- Stub foundation proposal batch → `ai_proposals`
- Server-side readiness score + `canLock`
- Lock foundation + promotion terbatas dari accepted safe proposals
- Web: `IntakePage`, `ConceptsPage`, `FoundationPage` + hooks/services + mock fallback
- Sprint 2 regression smoke tetap PASS (`npm run smoke:api` 17/17)

### Fitur yang masih deferred

- OpenRouter / model routing / AI generation production
- Outline / chapter / prose persistence (Sprint 4+)
- Reveal Gate penuh, validator penuh
- Credit ledger / deduction nyata
- Publish package production API
- Full proposal reject/merge UI di web
- Web E2E in GitHub Actions CI (local `npm run smoke:web` available — Task 3.8)
- `audit_action` enum untuk intake/concepts events
- DB transaction wrapper untuk lock promotion
- Halaman web lain (outline, write, summary, publish) masih mock
- Unlock foundation workflow

---

## 2. Architecture Added

### Migration `00002` (Task 3.1)

- File: `supabase/migrations/00002_sprint3_intake_concepts.sql`
- Enum baru: `workflow_phase`, `intake_session_status`, `intake_session_phase`, `intake_message_role`, `detected_signal_status`, `story_concept_status`, dll.
- RLS: semua tabel baru via `is_project_owner(project_id)`
- Partial unique: satu `selected` concept per project

### Shared Sprint 3 types (Task 3.1)

- `packages/shared/src/enums.ts` — Sprint 3 enums
- `packages/shared/src/domain.ts` — `IntakeSession`, `IntakeMessage`, `DetectedSignal`, `StoryConcept`; `Project.workflowPhase`, `Project.selectedConceptId`

### Intake API (Task 3.2)

- `apps/api/src/services/intake.ts` — session CRUD, message append + agent stub, signal list/extract/PATCH
- `apps/api/src/routes/intake.ts` — 7 endpoints

### Concepts API (Task 3.3)

- `apps/api/src/services/concept.ts` — list, generate stub, select, update
- `apps/api/src/routes/concepts.ts` — 5 endpoints

### Foundation proposal service (Task 3.4)

- `apps/api/src/services/foundation-proposal.ts` — deterministic batch dari selected concept + signals → `ai_proposals`
- `apps/api/src/routes/foundation.ts` — `POST/GET .../foundation/proposals/*`

### Readiness service (Task 3.4)

- `apps/api/src/services/foundation-readiness.ts` — server-side score, checks, `canLock`; persist `readiness_percent` / `readiness_status`

### Lock foundation workflow (Task 3.5)

- `apps/api/src/services/foundation-lock.ts` — preconditions, safe promotion, `workflow_phase=foundation_locked`
- `POST /api/projects/:id/foundation/lock`

### Web integration (Task 3.6)

| Layer | Files |
|---|---|
| Services | `apps/web/src/services/intake.ts`, `concepts.ts`, `foundation-flow.ts` |
| Hooks | `useIntakeData.ts`, `useConceptsData.ts`, `useFoundationFlow.ts` |
| Pages | `IntakePage.tsx`, `ConceptsPage.tsx`, `FoundationPage.tsx` |
| Components | `FoundationProposalsPanel.tsx`, updates `ChatPanel`, `ConceptCard`, `FoundationLockCta` |
| Context | `project-context.ts` — `demo-project-001` → active API project UUID |

---

## 3. Database Verification

### Migration `00002`

| Item | Status |
|---|---|
| File | `supabase/migrations/00002_sprint3_intake_concepts.sql` |
| `supabase db reset` | **PASS** (8 Juni 2026, Task 3.7) |
| Migrations applied | `00001_sprint2_core.sql` + `00002_sprint3_intake_concepts.sql` |
| Tabel Sprint 4+ (chapters, prose_versions, …) | **Tidak ada** ✓ |

### Tabel baru Sprint 3

```txt
intake_sessions, intake_messages, detected_signals, story_concepts
```

### Kolom baru `projects`

| Column | Type | Notes |
|---|---|---|
| `workflow_phase` | `workflow_phase` enum | Default `intake`; values hingga `foundation_locked` |
| `selected_concept_id` | uuid FK → `story_concepts` | Pointer UX; bukan canon lock |

### Seed update (Task 3.1)

- `supabase/seed.sql` extended — demo intake session, 3 messages, 4 signals, 3 concepts (concept #3 selected)
- Maps Sprint 1 mocks → `demo-project-001` / `a0000000-0000-4000-8000-000000000101`

### Row count setelah `supabase db reset` + seed

| Tabel | Rows |
|---|---|
| profiles | 1 |
| projects | 1 |
| intake_sessions | 1 |
| intake_messages | 3 |
| detected_signals | 4 |
| story_concepts | 3 |
| story_foundations | 1 |
| characters | 4 |
| facts | 4 |
| ai_proposals | 1 |
| relationship_speech_rules | 1 |
| credit_balances | 1 |
| audit_logs | 3 |

**Seed IDs:** user `a0000000-0000-4000-8000-000000000001`, project `a0000000-0000-4000-8000-000000000101`.

### Smoke API result

| Check | Result |
|---|---|
| `npm run smoke:api` (Sprint 2 regression) | **PASS** — 17/17 (8 Juni 2026, Task 3.7) |
| Sprint 3 API runtime smoke (manual script) | **PASS** — 14/14 (8 Juni 2026, Task 3.7) |

---

## 4. API Endpoint Map

Semua endpoint Sprint 3 memerlukan **Bearer JWT**. Ownership via `getOwnedProjectRow` — cross-user → `404 NOT_FOUND`.

### Intake

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/intake` | Yes | Bundle session + messages + signals; auto-create session | **PASS** | Bisa buat session kosong tanpa explicit POST |
| `POST /api/projects/:id/intake` | Yes | Create/reset active intake session | **PASS** | Reset in-place; tidak hapus messages lama |
| `GET /api/projects/:id/intake/messages` | Yes | List messages (`?limit=50`) | **PASS** | Append-only |
| `POST /api/projects/:id/intake/messages` | Yes | Append user message + agent stub reply | **PASS** | Hanya role `user` dari client; agent server-side |
| `GET /api/projects/:id/intake/signals` | Yes | List detected signals | **PASS** | |
| `POST /api/projects/:id/intake/extract-signals` | Yes | Rule-based extraction dari user messages | **PASS** | Bukan NLP/AI |
| `PATCH /api/projects/:id/intake/signals/:signalId` | Yes | Update signal status | **PASS** (Task 3.2) | Tidak di smoke Sprint 3 |

**Canon:** intake messages dan detected signals **bukan canon** — tidak menulis `facts` / `characters`.

### Concepts

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/concepts` | Yes | List concept options | **PASS** (Task 3.3) | |
| `POST /api/projects/:id/concepts/generate` | Yes | Stub-generate 3 concepts | **PASS** | Deterministic; `regenerate=true` rejects old proposed |
| `GET /api/projects/:id/concepts/:conceptId` | Yes | Concept detail | **PASS** (Task 3.3) | |
| `PATCH /api/projects/:id/concepts/:conceptId` | Yes | Update proposed concept | **PASS** (Task 3.3) | `selected` → 409 |
| `POST /api/projects/:id/concepts/:conceptId/select` | Yes | Select concept | **PASS** | Sets `workflow_phase=foundation`; **tidak lock foundation** |

**Canon:** story concepts **bukan canon**.

### Foundation proposals & readiness

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `POST /api/projects/:id/foundation/proposals/generate` | Yes | Stub batch → `ai_proposals` | **PASS** | Butuh selected concept; tidak promote canon |
| `GET /api/projects/:id/foundation/proposals` | Yes | List foundation-flow proposals | **PASS** | Default: proposed only |
| `GET /api/projects/:id/foundation/readiness` | Yes | Score, checks, `canLock` | **PASS** | Display readiness = proposed only; lock readiness includes accepted |
| `POST /api/projects/:id/foundation/lock` | Yes | Lock + promote accepted safe proposals | **PASS** | No DB transaction; idempotent 409 if already locked |

**Canon:** proposals masuk `ai_proposals` dengan status `proposed` — **tidak auto-accept**, **tidak auto-promote** sampai user accept + lock.

---

## 5. Web Integration Status

| Page | API mode (`VITE_USE_MOCKS=false` + login) | Mock fallback |
|---|---|---|
| **IntakePage** | `useIntakeData` — bundle, send message, extract signals | `mockIntakeSession` |
| **ConceptsPage** | `useConceptsData` — list, generate, select | `mockConcepts` |
| **FoundationPage** | `useFoundationFlow` — foundation bundle, proposals, readiness, accept, lock | Mock foundation + secret schedule partly mock |

### `VITE_USE_MOCKS` behavior

| Value | Behavior |
|---|---|
| `true` (default) | Selalu mock Sprint 1 — UI stabil tanpa API |
| `false` | Coba API jika Supabase session ada; error → mock + `IntegrationNotice` |

### API error fallback

- Network/API error → `source: api-fallback` + `IntegrationNotice`
- Tidak login di API mode → mock + notice
- UI tidak blank; layout Sprint 1 tidak di-redesign

### DevAuthPanel

- Hanya `import.meta.env.DEV` + `VITE_USE_MOCKS=false` + Supabase configured
- Pojok kanan bawah; signup/login lokal
- Tidak muncul di production build

### IntegrationNotice

- Notice kecil saat fallback mock aktif di API mode
- Dipakai di intake, concepts, foundation (Task 3.6)

### API project id resolution

- Route `demo-project-001` → `resolveProjectIdForRoute` → active API project UUID (Task 2.13 pattern)
- `apps/web/src/lib/project-context.ts`

### Web runtime smoke (Task 3.7 / 3.8)

| Check | Status | Catatan |
|---|---|---|
| `npm run build:web` | **PASS** | 8 Juni 2026, Task 3.7 |
| `VITE_USE_MOCKS=true` render intake/concepts/foundation | **Not run** (3.7) | Task 3.8: Playwright mock smoke — lihat Task 3.8 log |
| `VITE_USE_MOCKS=false` no login → no crash | **Not run** (3.7) | Hook pattern Task 3.6; partial via API-mode Playwright (3.8) |
| `VITE_USE_MOCKS=false` + login full flow | **Not run** (3.7) | Task 3.8: optional `-IncludeApiMode` atau manual checklist |

**Task 3.8 deliverable:** `npm run smoke:web`, `apps/web/e2e/sprint3-flow.spec.ts`, `scripts/sprint3-smoke-web-manual-checklist.md`. CI web E2E **deferred**.

---

## 6. Canon Guardrails Confirmed

| Rule | Status | Evidence |
|---|---|---|
| Intake messages bukan canon | **Confirmed** | Hanya `intake_messages`; tidak menulis facts/characters |
| Detected signals bukan canon | **Confirmed** | Hanya `detected_signals`; extract tidak create foundation/concepts |
| Story concepts bukan canon | **Confirmed** | `story_concepts` terpisah dari facts; select tidak lock foundation |
| Concept selected tidak lock foundation | **Confirmed** | Select → `workflow_phase=foundation`; lock terpisah via POST lock |
| Foundation proposals masuk `ai_proposals` | **Confirmed** | `foundation-proposal.ts` batch insert `status=proposed` |
| Proposal tidak auto-accept | **Confirmed** | Generate hanya `proposed`; accept via `POST .../proposals/:id/accept` |
| Lock tidak auto-accept proposals | **Confirmed** | Lock hanya promote `accepted`; proposed-only lock → 409 |
| Lock hanya promote accepted safe proposals | **Confirmed** | Smoke: 9 accepted → lock; chars/facts promoted |
| `secret` / `reveal` / `chapter_delta` tidak dipromosikan ke facts | **Confirmed** | `foundation-lock.ts` forbidden types; smoke `secretFacts=0` |
| Facts/characters/speech rules tidak bertambah dari proposed proposal | **Confirmed** | Task 3.4 runtime: canon 0→0 setelah generate; hanya setelah accept+lock |
| No OpenRouter / no AI generation | **Confirmed** | Stub deterministic di intake/concept/foundation services |

---

## 7. Security Guardrails Confirmed

| Guardrail | Status |
|---|---|
| JWT required untuk protected endpoints | **Confirmed** (`GET intake` no token → 401) |
| Owner-only filtering (`owner_id` dari JWT) | **Confirmed** |
| Cross-user access → 404 (bukan 403) | **Confirmed** (smoke seed project) |
| `userId` dari JWT, tidak dari body/query | **Confirmed** |
| Service role backend only (`apps/api`) | **Confirmed** |
| No secrets in repo | **Confirmed** (`.dev.vars`, `.env.local` gitignored) |
| No token logging | **Confirmed** (smoke script redacts JWT) |

---

## 8. Smoke Test Checklist

### Build & typecheck (8 Juni 2026, Task 3.7)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `supabase db reset` | **PASS** |
| `npm run smoke:api` | **PASS** — 17/17 |

### Dev servers

| Command | Result | Catatan |
|---|---|---|
| `npm run dev:api` | **Running** | Port 8787 (sesi dev existing) |
| `npm run dev:web` | **Not run** | `build:web` PASS; live dev skipped |

### API runtime smoke Sprint 3 (8 Juni 2026)

Signup test user baru → full flow pada project baru:

| Test | Result |
|---|---|
| `GET intake` no token → 401 | **PASS** |
| `POST/GET intake` owner | **PASS** |
| `POST message` user + agent stub | **PASS** |
| `POST extract-signals` → signals created | **PASS** (3 signals) |
| `POST concepts/generate` → 3 concepts | **PASS** |
| `POST concepts/:id/select` → `workflowPhase=foundation` | **PASS** |
| `POST foundation/proposals/generate` → proposals created | **PASS** (9 proposals) |
| `GET foundation/readiness` → score/checks | **PASS** |
| Lock dengan proposals masih `proposed` → 409 | **PASS** |
| Accept safe proposals via API | **PASS** (9 accepted) |
| `POST foundation/lock` → success | **PASS** (`isLocked=true`) |
| Secret/high-risk facts tidak dipromosikan | **PASS** (`secretFacts=0`) |
| Cross-user seed project → 404 | **PASS** |
| `workflow_phase=foundation_locked` | **PASS** |

**Reproducible Sprint 2 smoke:**

```bash
npm run smoke:api    # scripts/sprint2-smoke-api.ps1
```

Sprint 3 flow: manual PowerShell inline (belum script terpisah `sprint3-smoke-api.ps1`).

### Web runtime smoke (Task 3.8)

| Test | Result |
|---|---|
| `npm run smoke:web` mock Playwright | Lihat `.agent-logs/sprint-3/task-3.8-web-e2e-smoke-automation.md` |
| `npm run smoke:web -- -IncludeApiMode` | Lihat Task 3.8 log — **NOT RUN** jika flag tidak dipakai |
| Manual API checklist | `scripts/sprint3-smoke-web-manual-checklist.md` |

---

## 9. Known Limitations

- **No OpenRouter** — semua generator deterministic stub di backend
- **No AI generation** — agent reply, concepts, foundation proposals rule/template based
- **No outline/chapter/prose persistence** — tabel Sprint 4+ belum ada
- **No full proposal reject/merge UI** — web hanya accept safe proposals + lock CTA
- **No web E2E in CI** — local `npm run smoke:web` (Task 3.8); GitHub Actions deferred
- **No DB transaction for lock promotion** — partial failure teoretis jika lock update gagal setelah promote
- **`audit_action` for intake/concepts deferred** — tidak ada audit log intake/concept events
- **Only intake/concepts/foundation web integrated** — outline, write, summary, publish masih mock
- **Secret schedule partly mock** — `FoundationPage` jadwal rahasia masih mock data jika `VITE_USE_MOCKS=true` atau fallback
- **Sprint 2 smoke script** belum mencakup endpoint Sprint 3 (regression only)
- **Seed user GoTrue login** — `penulis@contoh.id` limitation dari Sprint 2 masih berlaku
- **No remote deploy** — Worker + Supabase hosted belum di-push

---

## 10. Closure Decision

| Question | Answer |
|---|---|
| **Sprint 3 ready to close?** | **Yes** |
| **Blockers** | **None** — API/runtime/build/db reset verified; limitations are intentional deferrals |
| **Non-blocking limitations** | API-mode web E2E may be NOT RUN without `-IncludeApiMode`; no DB transaction on lock; CI web E2E deferred |

Sprint 3 deliverables (intake → concepts → foundation proposal → readiness → lock + web integration + web smoke script) are complete and verified for local development handoff.

**Rekomendasi sebelum Sprint 4:** `npm run smoke:web` (mock) dan opsional `-IncludeApiMode` atau manual checklist.

---

## 11. Recommended Next Sprint

### Primary: **Sprint 4 — Outline Planning Engine**

Per [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md) dan [`docs/30`](30-sprint-3-story-foundation-flow-implementation-plan.md):

- Foundation flow data nyata sudah jelas dan terverifikasi di API
- `workflow_phase=foundation_locked` adalah gate natural untuk outline/chapter persistence
- Product roadmap MVP membutuhkan outline engine setelah fondasi terkunci

**Alasan:** Sprint 3 menutup loop story foundation; nilai produk berikutnya adalah perencanaan outline yang persist — bukan menambah lapisan pada flow yang sudah verified.

### Completed pre-Sprint 4 hardening: **Task 3.8 — Web E2E Smoke Automation** ✅

- `npm run smoke:web` — Playwright mock mode + optional API mode
- Manual checklist for API-mode fallback
- CI integration **deferred** (local-only)

---

## Related documents

- [`docs/30-sprint-3-story-foundation-flow-implementation-plan.md`](30-sprint-3-story-foundation-flow-implementation-plan.md)
- [`docs/29-sprint-2-verification-report.md`](29-sprint-2-verification-report.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`supabase/README.md`](../supabase/README.md)
- `.agent-logs/sprint-3/`