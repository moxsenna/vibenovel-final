# 35 — Sprint 5 Verification Report

**Sprint:** Sprint 5 — Safe Write Room & Context Packet  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`](34-sprint-5-safe-write-room-context-packet-implementation-plan.md)

Dokumen ini adalah laporan penutupan resmi Sprint 5. Dibaca oleh developer manusia dan AI agent sebelum memulai Sprint 6.

**Work logs:** `.agent-logs/sprint-5/task-5.0` … `task-5.7`

---

## 1. Sprint 5 Summary

### Tujuan Sprint 5

Mengubah **halaman Write Room** (`/projects/:id/write`) dari mock Sprint 1 menjadi **workflow persistence nyata** dengan **Context Packet aman** untuk bab aktif — tanpa prose AI production:

```txt
outline_locked
  → Start writing session (Bab 1 default)
  → Generate/load chapter beats (deterministic stub)
  → Build Context Packet (backend-only, preview to client)
  → Save prose draft per beat (manual / stub — not canon)
  → Mark ready_for_summary (handoff marker — Sprint 6)
```

Writer hanya menerima slice aman bab aktif. Planner (`planning_truth`, full outline) tidak boleh bocor ke writer path.

### Status akhir

| Aspek | Status |
|---|---|
| Migration `00004` + shared Sprint 5 types | **Selesai (Task 5.1)** |
| Context Packet Builder API | **Selesai (Task 5.2)** |
| Writing session API | **Selesai (Task 5.3)** |
| Chapter beat API | **Selesai (Task 5.3)** |
| Prose draft persistence API | **Selesai (Task 5.4)** |
| WritePage web integration | **Selesai (Task 5.5)** |
| Safety tests & leak guards | **Selesai (Task 5.6)** |
| Sprint 5 verification report | **Selesai (Task 5.7)** |
| OpenRouter / AI prose generation | **Tidak ada (by design)** |
| Chapter summary / canon update | **Tidak ada (Sprint 6)** |
| Remote deploy / remote migration | **Tidak dilakukan** |

### Fitur yang selesai

- Tabel baru: `writing_sessions`, `chapter_writing_states`, `chapter_beats`, `chapter_prose_versions`, `context_packet_logs`
- Extend `workflow_phase`: `writing`
- Context Packet Builder server-side dengan safety assertion sebelum persist
- Preview-only API response (no raw `packet_json` to client)
- Writing session start/resume idempotent per `(project_id, chapter_outline_id)`
- Deterministic beat generator (5 beats, parity Bab 1 mock)
- Prose versioning per beat (`is_current`, word count aggregation)
- `ready_for_summary` marker (session + chapter writing state)
- Web: `WritePage` + `useWriteRoomData` + writer components + mock fallback
- Safety smoke: API 49/49 + write E2E mock + API-mode PASS
- Sprint 2 regression smoke tetap PASS (`npm run smoke:api` 17/17)

### Fitur yang masih deferred

- Chapter Summary / Chapter Delta / canon promotion (Sprint 6)
- SummaryPage API integration (masih mock Sprint 1)
- OpenRouter / model routing / AI generation production
- Full prose AI writer (beat-level generation + repair loop)
- Instruction Compliance Validator production
- `POST .../prose/:versionId/make-current` belum di-smoke-test otomatis
- Publish package production (Sprint 7)
- Credit deduction / ledger (Sprint 8)
- Full Reveal Gate breadcrumb compiler
- Character Knowledge Gate penuh
- Audit logs untuk write operations
- DB transaction wrapper untuk prose save multi-step
- `sprint5-smoke-api.ps1` belum di-wire ke `npm run smoke:api`
- Write API-mode E2E belum di GitHub Actions CI
- Remote Cloudflare deploy

---

## 2. Architecture Added

### Migration `00004` (Task 5.1)

- File: `supabase/migrations/00004_sprint5_write_room.sql`
- 5 tabel write room + 4 enum PostgreSQL baru
- RLS owner-only via `is_project_owner(project_id)`
- Partial unique: satu session `active` per `(project_id, chapter_outline_id)`
- Seed parity: Bab 1 `chapter_writing_states` + 5 `chapter_beats`

### Shared Sprint 5 types (Task 5.1)

- `packages/shared/src/enums.ts` — `WRITING_SESSION_STATUSES`, `CHAPTER_WRITING_STATUSES`, `CHAPTER_BEAT_STATUSES`, `CHAPTER_PROSE_SOURCES`, `WORKFLOW_PHASES.writing`
- `packages/shared/src/domain.ts` — `WritingSession`, `ChapterBeat`, `ChapterProseVersion`, `WriterContextPacket`, `WriterContextPacketPreview`

### Context Packet Builder API (Task 5.2)

| Layer | Files |
|---|---|
| Builder | `apps/api/src/services/context-packet-builder.ts` |
| Safety | `apps/api/src/services/context-packet-safety.ts` |
| Snapshot | `apps/api/src/services/write-snapshot.ts` |
| Routes | `apps/api/src/routes/write.ts` |

### Writing session API (Task 5.3)

- `apps/api/src/services/write-session.ts`
- Start/resume, GET, PATCH, `ready-for-summary`

### Chapter beat API (Task 5.3)

- `apps/api/src/services/chapter-beat.ts`
- List, generate (deterministic stub), PATCH beat metadata

### Prose draft API (Task 5.4)

- `apps/api/src/services/prose-draft.ts`
- Versioned save, list, detail, make-current

### WritePage integration (Task 5.5)

| Layer | Files |
|---|---|
| Page | `apps/web/src/pages/WritePage.tsx` |
| Hook | `apps/web/src/hooks/useWriteRoomData.ts` |
| Service | `apps/web/src/services/write.ts` |
| Components | `WriterBeatList`, `WriterEditorPanel`, `WriterAssistantPanel`, `WriterMobileLayout` |

### Safety smoke tests (Task 5.6)

- `scripts/sprint5-smoke-api.ps1` — 49 leak/canon guard steps
- `scripts/sprint5-smoke-web.ps1` + `apps/web/e2e/sprint5-write-flow.spec.ts`
- `npm run smoke:web:write`, `test:e2e:sprint5`

---

## 3. Database Verification

### Migration `00004_sprint5_write_room.sql`

| Check | Status |
|---|---|
| Applies cleanly on `supabase db reset` | **PASS** (8 Juni 2026, Task 5.7) |
| Additive only (no change to `00001`–`00003`) | **Confirmed** |
| Enums align `@vibenovel/shared` | **Confirmed** |

### Tabel baru

| Table | Purpose | RLS |
|---|---|---|
| `writing_sessions` | Active/paused writing attempt per bab | Owner SELECT/INSERT/UPDATE/DELETE |
| `chapter_writing_states` | Bab-level prose metadata (word count, status) | Owner |
| `chapter_beats` | Scene/adegan list per bab | Owner |
| `chapter_prose_versions` | Versioned draft prose per beat | Owner |
| `context_packet_logs` | Audit trail safe packet JSON (backend) | Owner SELECT; API returns preview only |

### `workflow_phase` extension

- Nilai baru: `writing` (set saat session aktif dimulai dari `outline_locked`)

### Seed update (demo project)

- `chapter_writing_states` — Bab 1 `not_started`, word_count 0
- `chapter_beats` — 5 beats parity `mockChapterDraft` (beat 1 `draft`, sisanya `empty`)
- Tidak ada seed `chapter_prose_versions` atau `context_packet_logs` (runtime only)

### `supabase db reset` status

**PASS** — migrasi `00001`–`00004` + seed applied tanpa error (8 Juni 2026, Task 5.7).

### RLS summary

Semua tabel Sprint 5 memakai `is_project_owner(project_id)` — cross-user access ditolak di DB layer; API memetakan ke 404.

---

## 4. API Endpoint Map

Semua endpoint Sprint 5 memerlukan **Bearer JWT**. Ownership via `getOwnedProjectRow` + row `project_id` match. Gate write room: `outline_locked` atau `writing`, foundation locked, outline plan locked — else **409**.

### Context Packet

| Method | Path | Purpose | Tested | Limitation |
|---|---|---|---|---|
| POST | `/api/projects/:id/write/context-packet` | Build safe packet, persist log, return preview + safety metadata | **PASS** (smoke) | Requires `outline_locked`; body `chapterOutlineId`, optional `beatId` |
| GET | `/api/projects/:id/write/context-packet/:logId/preview` | Redacted preview from stored packet | **PASS** | No raw `packet_json` |

### Writing Session

| Method | Path | Purpose | Tested | Limitation |
|---|---|---|---|---|
| POST | `/api/projects/:id/write/sessions` | Start/resume active session | **PASS** | Idempotent per chapter |
| GET | `/api/projects/:id/write/sessions/:sessionId` | Session + writing state + chapter summary | **PASS** | No packet JSON / planningTruth |
| PATCH | `/api/projects/:id/write/sessions/:sessionId` | `status`, `activeBeatId`, light metadata | **PASS** | Rejects `ready_for_summary`, `proseText`, `planningTruth` |
| POST | `/api/projects/:id/write/sessions/:sessionId/ready-for-summary` | Marker only — no summary canon | **PASS** | Requires ≥1 beat |

### Beats

| Method | Path | Purpose | Tested | Limitation |
|---|---|---|---|---|
| GET | `/api/projects/:id/write/sessions/:sessionId/beats` | List beats ordered | **PASS** | Empty array OK |
| POST | `/api/projects/:id/write/sessions/:sessionId/beats/generate` | Deterministic 5-beat stub | **PASS** | Idempotent; `regenerate=true` guarded |
| PATCH | `/api/projects/:id/write/beats/:beatId` | Beat metadata/direction/status | **PASS** | Rejects `proseText`, `planningTruth` |

### Prose

| Method | Path | Purpose | Tested | Limitation |
|---|---|---|---|---|
| GET | `/api/projects/:id/write/beats/:beatId/prose` | List versions + current | **PASS** | No packet JSON in response |
| POST | `/api/projects/:id/write/beats/:beatId/prose` | Save new version | **PASS** | Requires active/paused session; rejects leaks |
| GET | `/api/projects/:id/write/prose/:versionId` | Version detail | **PASS** | Owner-only |
| POST | `/api/projects/:id/write/prose/:versionId/make-current` | Switch current version | **Implemented, NOT RUN in smoke** | Recomputes chapter word count |

---

## 5. Web Integration Status

### WritePage (`/projects/:id/write`)

| Capability | Status |
|---|---|
| Load session + beats + prose (API mode) | **Confirmed** |
| Mock fallback (`VITE_USE_MOCKS=true`) | **Confirmed** — parity `mockChapterDraft` |
| API error / no auth fallback | **Confirmed** — `IntegrationNotice` + mock |
| `outline_locked` gate | **Confirmed** — mock + notice jika belum locked |
| Generate beats CTA | **Confirmed** (API mode) |
| Context preview (`Siapkan Konteks Aman`) | **Confirmed** — safe counts/labels only |
| Prose textarea + save | **Confirmed** (API mode) |
| `ready_for_summary` → navigate `/summary` mock | **Confirmed** — no Sprint 6 canon |
| AI assistant CTAs | **Disabled** (by design) |

### `useWriteRoomData`

- Orchestrates session, beats, prose, context preview, ready marker
- `source`: `mock` | `api` | `api-fallback`
- Prose safety error mapping untuk leakage markers

### Writer components

| Component | Role |
|---|---|
| `WriterBeatList` | Beat selection, status badges |
| `WriterEditorPanel` | Controlled prose, save, finish CTA |
| `WriterAssistantPanel` | Safe context preview + build button (xl viewport) |
| `WriterMobileLayout` | Mobile parity layout |

### `VITE_USE_MOCKS` behavior

- `true` (default): full mock write room, no API calls required
- `false` + auth: real API; falls back to mock on error or missing outline lock

---

## 6. Context Packet Boundary Confirmed

| Rule | Status | Evidence |
|---|---|---|
| Built backend-side only | **Confirmed** | `buildContextPacketForOwner` in API service |
| Response preview-only | **Confirmed** | Smoke: no `packetJson`/`packet_json` in POST/GET preview JSON |
| Full `packet_json` not exposed to frontend API | **Confirmed** | Web service receives preview + `packetLogId` only |
| `planningTruth` / `planning_truth` absent | **Confirmed** | Smoke regex + DB packet check |
| Chapter 1 packet excludes chapter 2+ title/summary | **Confirmed** | Smoke: ch2 title/summary snippet absent |
| Future reveals as forbidden labels / safe hints only | **Confirmed** | `forbiddenReveals` labels present; planning truth text absent in DB JSON |
| No full outline dump | **Confirmed** | `assertWriterPacketSafe` + snapshot slice |
| No raw prompt/model/provider/token metadata | **Confirmed** | `FORBIDDEN_KEY_PATTERNS` + response leak guard |
| Packet log stored only after safety assertion | **Confirmed** | `assertWriterPacketSafe` before INSERT |

---

## 7. Prose Draft Boundary Confirmed

| Rule | Status | Evidence |
|---|---|---|
| Prose draft is not canon | **Confirmed** | Stored in `chapter_prose_versions` only |
| Prose save does not mutate `facts` | **Confirmed** | Smoke: fact count unchanged |
| Prose save does not mutate `characters` | **Confirmed** | Smoke: character count unchanged |
| Prose save does not mutate `speech_rules` | **Confirmed** | Smoke: speech rule count unchanged |
| Prose save does not mutate `foundation` / `outline` | **Confirmed** | Smoke: outline chapter count unchanged |
| Rejects `planningTruth` and packet dump in prose | **Confirmed** | Smoke: 400 on markers |
| Normal fictional secret prose allowed | **Confirmed** | Smoke: fictional secret POST 201 |
| `ai_generated` source reserved/rejected | **Confirmed** | Smoke: 400 |
| `ready_for_summary` is marker only | **Confirmed** | Status set; no summary table write |

---

## 8. Canon Guardrails Confirmed

| Rule | Status |
|---|---|
| No chapter summary created | **Confirmed** — no `chapter_summaries` table; ready marker only |
| No facts promoted from prose | **Confirmed** |
| No proposals accepted from write flow | **Confirmed** |
| No outline/foundation mutation from writing | **Confirmed** (smoke) |
| No OpenRouter / no AI generation | **Confirmed** |
| No credit deduction | **Confirmed** |
| Draft prose cannot update canon until Sprint 6 summary approval | **Confirmed (design)** |

---

## 9. Security Guardrails Confirmed

| Guardrail | Status |
|---|---|
| JWT required untuk protected endpoints | **Confirmed** |
| Owner-only filtering | **Confirmed** |
| Cross-user access → 404 | **Confirmed** (session + context packet smoke) |
| `userId` dari JWT, tidak dari body | **Confirmed** |
| Service role backend only | **Confirmed** |
| No secrets in repo | **Confirmed** |
| No token logging in smoke scripts | **Confirmed** |
| `packet_json` not returned to frontend | **Confirmed** |
| `planningTruth` not visible in DOM | **Confirmed** (Playwright mock + API mode) |

---

## 10. Smoke Test Checklist

### Build & typecheck (8 Juni 2026, Task 5.7)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `supabase db reset` | **PASS** |
| `npm run smoke:api` | **PASS** — 17/17 (Sprint 2 regression) |
| `scripts/sprint5-smoke-api.ps1` | **PASS** — 49/49 |
| `npm run smoke:web` | **PASS** — 3 mock; API NOT RUN |
| `npm run smoke:web:outline` | **PASS** — mock; API NOT RUN |
| `npm run smoke:web:write` | **PASS** — mock |
| `npm run smoke:web:write -- -IncludeApiMode` | **PASS** — mock + API 10/10 |

### Sprint 5 API runtime smoke (8 Juni 2026)

Script: `scripts/sprint5-smoke-api.ps1` — **49/49 PASS**

| Area | Key tests |
|---|---|
| Context packet | Preview-only; no leaks; ch1 no ch2; DB `packet_json` safe; forbidden labels only |
| Session | Idempotent start; cross-user 404 |
| Beats | Generate 5; idempotent; PATCH rejects prose |
| Prose | Versioning; fictional secret OK; planningTruth/dump rejected; no packet in response |
| Canon | Unchanged after prose + ready_for_summary |
| Ready marker | `ready_for_summary` not `summarized` |

```bash
powershell -ExecutionPolicy Bypass -File scripts/sprint5-smoke-api.ps1
```

### Web runtime smoke Sprint 5 (8 Juni 2026)

| Test | Result |
|---|---|
| Mock `/write` — render + no DOM leaks | **PASS** |
| API-mode write full flow | **PASS** (Task 5.6/5.7) |
| Context preview appears | **PASS** (API mode) |
| Prose save ×2 | **PASS** (API mode) |
| `ready_for_summary` → `/summary` mock safe | **PASS** (API mode) |
| `planningTruth` / `packet_json` not in DOM | **PASS** |

```bash
npm run smoke:web:write
npm run smoke:web:write -- -IncludeApiMode
```

---

## 11. Known Limitations

- **No Sprint 6 summary/canon update** — `ready_for_summary` is handoff marker only
- **SummaryPage still mock** — navigates to Sprint 1 typed mock after finish CTA
- **No OpenRouter / AI generation** — assistant CTAs disabled; `ai_generated` rejected
- **No model router** — deferred
- **No full validator** — prose leakage markers only (MVP)
- **No audit logs** for write operations
- **`sprint5-smoke-api.ps1` not wired into `npm run smoke:api`** — Sprint 2 regression only
- **API-mode write E2E not in GitHub Actions** — local-only (browser + Supabase + dual env)
- **No DB transaction wrapper** for prose save multi-step (version flip + word count + session touch)
- **`make-current` prose endpoint** — implemented but not in automated smoke
- **Possible false positives** for `model`/`token`/`provider` markers in rare fictional prose (substring match)
- **No remote deploy** — Worker + Supabase hosted belum di-push

---

## 12. Closure Decision

| Question | Answer |
|---|---|
| **Sprint 5 ready to close?** | **Yes** |
| **Blockers** | **None** — migration, API runtime, web integration, safety smokes, db reset verified |
| **Non-blocking limitations** | Summary/canon Sprint 6; smoke script consolidation; CI E2E; make-current smoke; audit logs |

Sprint 5 deliverables (write room persistence + Context Packet safety + prose draft + web integration + leak guards) are complete and verified for local development handoff.

---

## 13. Recommended Next Sprint

### Primary: **Sprint 6 — Chapter Summary, Chapter Delta & Canon Proposal Flow**

Per [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md):

- `ready_for_summary` dari Sprint 5 adalah gate natural untuk summary generation
- Draft prose belum canon sampai summary approval flow di Sprint 6
- SummaryPage perlu integrasi API nyata (bukan mock)

**Alasan:** Context Packet dan prose persistence sudah aman; langkah berikutnya yang paling berdampak adalah mengubah draft menjadi canon melalui Chapter Delta yang diaudit — bukan menambah AI generation sebelum gate canon ada.

### Optional pre-Sprint 6 hygiene: **Task 5.8 — Smoke Script Consolidation / Non-blocking Debt Register**

- Wire `sprint5-smoke-api.ps1` ke `npm run smoke:api` atau alias `smoke:api:write`
- Add `make-current` to Sprint 5 smoke
- Document deferred items in `docs/36-non-blocking-technical-debt-and-deferred-items.md` (optional)

Tidak wajib untuk menutup Sprint 5.

---

## Related documents

- [`docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`](34-sprint-5-safe-write-room-context-packet-implementation-plan.md)
- [`docs/33-sprint-4-verification-report.md`](33-sprint-4-verification-report.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`supabase/README.md`](../supabase/README.md)
- [`scripts/README.md`](../scripts/README.md)
- `.agent-logs/sprint-5/`