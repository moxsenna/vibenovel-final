# 33 — Sprint 4 Verification Report

**Sprint:** Sprint 4 — Outline Planning Engine  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/32-sprint-4-outline-planning-engine-implementation-plan.md`](32-sprint-4-outline-planning-engine-implementation-plan.md)

Dokumen ini adalah laporan penutupan resmi Sprint 4. Dibaca oleh developer manusia dan AI agent sebelum memulai Sprint 5.

**Work logs:** `.agent-logs/sprint-4/task-4.0` … `task-4.7`

---

## 1. Sprint 4 Summary

### Tujuan Sprint 4

Mengubah **halaman Outline** dari mock Sprint 1 menjadi **outline persistence nyata** yang aman untuk serial fiction KBM/mobile — tanpa prose generation:

```txt
Foundation locked
  → Generate rencana 10 bab (deterministic stub)
  → Edit chapter outline manual
  → Lacak open loops & reveal schedule (planning data)
  → Approve & lock outline
  → workflow_phase = outline_locked
```

Planner boleh menyimpan full outline dan `planning_truth`; Writer (Sprint 5+) belum dibuat.

### Status akhir

| Aspek | Status |
|---|---|
| Migration `00003` + shared Sprint 4 types | **Selesai (Task 4.1)** |
| Outline generation stub API | **Selesai (Task 4.2 + 4.2b scope fix)** |
| Chapter outline CRUD API | **Selesai (Task 4.3)** |
| Open loop / planned reveal tracking API | **Selesai (Task 4.4)** |
| Outline approve/lock workflow API | **Selesai (Task 4.5)** |
| Web OutlinePage integration | **Selesai (Task 4.6)** |
| Sprint 4 verification report | **Selesai (Task 4.7)** |
| OpenRouter / AI generation | **Tidak ada (by design)** |
| Write Room persistence | **Tidak ada (Sprint 5+)** |
| Remote deploy / remote migration | **Tidak dilakukan** |

### Fitur yang selesai

- Tabel baru: `outline_plans`, `chapter_outlines`, `open_loops`, `planned_reveals`
- Extend `workflow_phase`: `outline`, `outline_locked`
- Deterministic outline stub: 10 chapters, 3 open loops, 3 planned reveals (MVP cap 4)
- GET outline bundle + POST generate (foundation locked gate)
- Chapter outline list/detail/PATCH dengan locked guard
- Open loop & planned reveal CRUD (soft drop/cancel)
- `planningTruth` redacted di default GET/POST/PATCH responses
- Approve (`reviewing`) + lock (`outline_locked`) dengan readiness checks
- Web: `OutlinePage` + `useOutlineData` + workflow/tracking/editor components
- Mock fallback (`VITE_USE_MOCKS`) tetap aman
- Sprint 2 regression smoke tetap PASS (`npm run smoke:api` 17/17)
- Sprint 4 outline API smoke: **20/20 PASS** (`scripts/sprint4-smoke-api.ps1`)

### Fitur yang masih deferred

- Write Room persistence / prose generation (Sprint 5)
- Writer Context Packet (Sprint 5+)
- Beat contracts / beat writer
- Reveal Gate resolver production
- Validator suite production
- OpenRouter / model routing / AI generation
- Credit deduction / ledger
- Publish package production
- Full open loop/reveal CRUD UI di web (display-only di Task 4.6)
- Outline unlock API
- `audit_logs` untuk outline edits/approve/lock
- DB transaction wrapper untuk outline lock
- Automated outline API-mode Playwright E2E (**Task 4.8 optional**)
- Web E2E in GitHub Actions CI (local smoke only)
- Remote Cloudflare deploy

---

## 2. Architecture Added

### Migration `00003` (Task 4.1)

- File: `supabase/migrations/00003_sprint4_outline_planning.sql`
- 4 tabel planning + 8 enum PostgreSQL baru
- RLS owner-only via `is_project_owner(project_id)`
- Seed parity `mockOutline`: 10 chapters, 3 loops, 3 reveals

### Shared Sprint 4 types (Task 4.1)

- `packages/shared/src/enums.ts` — `OUTLINE_PLAN_STATUSES`, `CHAPTER_OUTLINE_STATUSES`, `OPEN_LOOP_STATUSES`, `PLANNED_REVEAL_STATUSES`, `WORKFLOW_PHASES` extend
- `packages/shared/src/domain.ts` — `OutlinePlan`, `ChapterOutline`, `OpenLoop`, `PlannedReveal`

### Outline generation stub API (Task 4.2, 4.2b)

- `apps/api/src/services/outline-generator.ts` — deterministic 10-chapter stub
- `apps/api/src/services/outline-snapshot.ts` — read-only canon snapshot
- `apps/api/src/services/outline.ts` — bundle read + generate
- `GET/POST /api/projects/:id/outline` (+ `/generate`)

### Chapter outline CRUD API (Task 4.3)

- `apps/api/src/services/chapter-outline.ts`
- `GET/PATCH /api/projects/:id/outline/chapters/:chapterId`

### Open loop & reveal tracking API (Task 4.4)

- `apps/api/src/services/outline-tracking.ts`
- CRUD `/outline/open-loops`, `/outline/reveals` dengan redaction

### Outline approve/lock workflow (Task 4.5)

- `apps/api/src/services/outline-lock.ts`
- `POST /outline/approve`, `POST /outline/lock`

### Web OutlinePage integration (Task 4.6)

| Layer | Files |
|---|---|
| Service | `apps/web/src/services/outline.ts` |
| Hook | `apps/web/src/hooks/useOutlineData.ts` |
| Page | `apps/web/src/pages/OutlinePage.tsx` |
| Components | `OutlineWorkflowActions`, `OutlineTrackingPanels`, `OutlineChapterEditor` |
| Mappers | `apps/web/src/lib/api-mappers.ts` (outline bundle, workflow errors) |

---

## 3. Database Verification

### Migration `00003`

| Item | Status |
|---|---|
| File | `supabase/migrations/00003_sprint4_outline_planning.sql` |
| `supabase db reset` | **PASS** (8 Juni 2026, Task 4.7) |
| Migrations applied | `00001` + `00002` + `00003` + seed |
| Prose tables (`chapters`, `prose_versions`, …) | **Tidak ada** ✓ |

### Tabel baru Sprint 4

```txt
outline_plans, chapter_outlines, open_loops, planned_reveals
```

### `workflow_phase` extension

| Value | When set |
|---|---|
| `outline` | After successful outline generate (from `foundation_locked`) |
| `outline_locked` | After `POST .../outline/lock` success |

### Seed update (demo project)

| Table | Rows |
|---|---|
| `outline_plans` | 1 |
| `chapter_outlines` | 10 |
| `open_loops` | 3 |
| `planned_reveals` | 3 |
| `projects.workflow_phase` | `outline` |

Foundation/intake/concepts seed unchanged (`is_locked=false` on fresh seed — outline generate requires lock via API flow).

### RLS summary

Semua tabel Sprint 4:

```txt
USING (is_project_owner(project_id))
WITH CHECK (is_project_owner(project_id))
```

Browser tidak menulis langsung — semua via `apps/api` + service role + filter `owner_id`.

---

## 4. API Endpoint Map

### Outline bundle & generate

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/outline` | Yes | Bundle: plan + chapters + loops + reveals (redacted) | **PASS** | `outlinePlan: null` when absent |
| `POST /api/projects/:id/outline/generate` | Yes | Deterministic stub; requires foundation locked | **PASS** | Stub only; no OpenRouter |

### Chapter outlines

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/outline/chapters` | Yes | List chapter outlines | **PASS** (Task 4.3) | Empty if no plan |
| `GET /api/projects/:id/outline/chapters/:chapterId` | Yes | Chapter detail | **PASS** (Task 4.3) | |
| `PATCH /api/projects/:id/outline/chapters/:chapterId` | Yes | Manual edit planning fields | **PASS** | 409 when plan locked; rejects prose/planningTruth |

### Open loops

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/outline/open-loops` | Yes | List open loops | **PASS** | |
| `POST /api/projects/:id/outline/open-loops` | Yes | Create open loop | **PASS** | 409 when plan locked |
| `PATCH /api/projects/:id/outline/open-loops/:loopId` | Yes | Update open loop | **PASS** (Task 4.4) | |
| `DELETE /api/projects/:id/outline/open-loops/:loopId` | Yes | Soft drop (`dropped`) | **PASS** | No hard delete |

### Planned reveals

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/outline/reveals` | Yes | List reveals — `planningTruth` redacted | **PASS** | No `includeTruth` param |
| `POST /api/projects/:id/outline/reveals` | Yes | Create reveal (stores truth, response redacted) | **PASS** | Does not create facts |
| `PATCH /api/projects/:id/outline/reveals/:revealId` | Yes | Update reveal (response redacted) | **PASS** (Task 4.4) | |
| `DELETE /api/projects/:id/outline/reveals/:revealId` | Yes | Soft cancel (`cancelled`) | **PASS** | No hard delete |

### Approve & lock

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `POST /api/projects/:id/outline/approve` | Yes | Set plan `reviewing`; chapter `approved` | **PASS** | Does not lock |
| `POST /api/projects/:id/outline/lock` | Yes | Lock plan + chapters; `workflow_phase=outline_locked` | **PASS** | 409 with checks if preconditions fail; no DB transaction |

**Canon:** outline endpoints **bukan canon** — tidak menulis `facts`/`characters`/`speech_rules` dari generate atau tracking CRUD.

---

## 5. Web Integration Status

| Component | API mode | Mock fallback |
|---|---|---|
| **OutlinePage** | `useOutlineData` — bundle, generate, edit, approve, lock | `mockOutline` penuh |
| **useOutlineData** | API/fallback/mock source routing | Notice saat no login / API down |
| **OutlineWorkflowActions** | Generate / Setujui / Kunci CTA | Hidden (`apiMode=false`) |
| **OutlineTrackingPanels** | Yang Masih Menggantung + Jadwal Rahasia | Empty panels (mock tidak punya API loops) |
| **OutlineChapterEditor** | PATCH title/summary/hook/miniVictory | Hidden di mock mode |

### `VITE_USE_MOCKS` behavior

| Value | Behavior |
|---|---|
| `true` (default) | Mock Sprint 1 outline penuh — UI stabil tanpa API |
| `false` + login | API mode: fetch/generate/edit/approve/lock |
| `false` + no login | Mock + `IntegrationNotice` |
| API error | `api-fallback` + mock + notice; UI tidak blank |

### API project id resolution

- Route `demo-project-001` → `resolveProjectIdForRoute` → active API project UUID (Task 2.13/3.6 pattern)
- `apps/web/src/lib/project-context.ts`

### Locked state behavior

- Badge **Outline Terkunci** + header `planBadge`
- Editor disabled; PATCH guarded di hook
- Workflow CTA approve/lock hidden saat locked
- Write CTA tetap ada → `/write` (masih Sprint 1 mock)

### Web runtime smoke

| Check | Status | Catatan |
|---|---|---|
| `npm run build:web` | **PASS** | 8 Juni 2026, Task 4.7 |
| `VITE_USE_MOCKS=true` `/outline` mock render | **NOT RUN** (automated) | `smoke:web` belum cover `/outline`; pola sama Task 3.6 — mock hook verified via build + Task 4.6 integration |
| `VITE_USE_MOCKS=false` no login → no crash | **NOT RUN** (automated) | Hook pattern Task 4.6; manual checklist deferred |
| `VITE_USE_MOCKS=false` + login full outline flow | **NOT RUN** (automated) | **Tidak diklaim PASS** — lihat Task 4.8 optional |
| `planningTruth` not in DOM | **NOT RUN** (automated) | API redaction verified; browser DOM check deferred |

**Penting:** API-mode browser E2E untuk `/outline` **belum otomatis dijalankan**. Sprint 4 tetap dapat ditutup karena API runtime + build + mock smoke PASS.

---

## 6. Planner / Writer Boundary Confirmed

| Rule | Status |
|---|---|
| Planner boleh menyimpan full outline (10 chapters, arc, hooks, loops, reveals) | **Confirmed** |
| Writer belum dibuat (Sprint 5+) | **Confirmed** |
| `planned_reveals.planning_truth` disimpan di DB | **Confirmed** |
| Default GET/UI tidak menampilkan `planningTruth` | **Confirmed** — `planningTruthRedacted: true`; smoke regex `"planningTruth":` absent |
| Writer Context Packet Sprint 5+ harus slice-only | **Confirmed (design)** — no full outline dump to writer |
| Outline/chapter/open-loop/reveal bukan prose | **Confirmed** — PATCH rejects `chapterText`/`prose` |
| No future outline dump to writer API | **Confirmed (guardrail)** — documented in `apps/api/README.md` |

---

## 7. Canon Guardrails Confirmed

| Rule | Status | Evidence |
|---|---|---|
| Outline generation tidak mutate `facts` | **Confirmed** | Smoke: counts unchanged post-generate |
| Outline generation tidak mutate `characters` | **Confirmed** | Smoke: counts unchanged post-generate |
| Outline generation tidak mutate `speech_rules` | **Confirmed** | Service read-only snapshot |
| Outline generation tidak mutate `foundation` | **Confirmed** | No foundation writes in `outline.ts` |
| Chapter PATCH tidak menerima prose/planningTruth | **Confirmed** | Smoke: 400 on `chapterText`, `planningTruth` |
| Planned reveals tidak menjadi `facts` | **Confirmed** | Tracking service no fact INSERT |
| Open loops bukan `facts` | **Confirmed** | Separate planning table |
| Lock outline hanya update planning status + `workflow_phase` | **Confirmed** | No canon promotion on lock |
| No OpenRouter / no AI generation | **Confirmed** | `outline_stub_deterministic` only |

---

## 8. Security Guardrails Confirmed

| Guardrail | Status |
|---|---|
| JWT required untuk protected endpoints | **Confirmed** (GET outline no token → 401) |
| Owner-only filtering (`owner_id` dari JWT) | **Confirmed** |
| Cross-user access → 404 (bukan 403) | **Confirmed** (smoke Sprint 4 + Sprint 2) |
| `userId` dari JWT, tidak dari body/query | **Confirmed** |
| Service role backend only (`apps/api`) | **Confirmed** |
| No secrets in repo | **Confirmed** (`.dev.vars`, `.env.local` gitignored) |
| No token logging | **Confirmed** (smoke scripts redact JWT) |
| `planningTruth` redacted in default responses | **Confirmed** (Sprint 4 smoke + Task 4.4 runtime) |

---

## 9. Smoke Test Checklist

### Build & typecheck (8 Juni 2026, Task 4.7)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `supabase db reset` | **PASS** |
| `npm run smoke:api` | **PASS** — 17/17 (Sprint 2 regression) |
| `npm run smoke:web` | **PASS** — 3 mock Playwright; API mode **NOT RUN** |

### Sprint 4 API runtime smoke (8 Juni 2026)

Script: `scripts/sprint4-smoke-api.ps1` — **20/20 PASS**

| Test | Result |
|---|---|
| GET outline no token → 401 | **PASS** |
| POST generate without locked foundation → 409 | **PASS** |
| Generate after foundation locked → 10 chapters, 3 loops, 3 reveals | **PASS** |
| `planningTruth` redacted in GET bundle | **PASS** |
| Canon counts unchanged post-generate | **PASS** |
| PATCH chapter valid → 200 | **PASS** |
| PATCH `chapterText` / `planningTruth` → 400 | **PASS** |
| PATCH chapter when locked → 409 | **PASS** |
| CRUD open loops → soft `dropped` | **PASS** |
| CRUD reveals → soft `cancelled` + redacted | **PASS** |
| POST approve outline → 200 (`reviewing`) | **PASS** |
| POST lock outline → 200 (`locked`) | **PASS** |
| `workflow_phase = outline_locked` | **PASS** |
| GET after locked → 200, redacted | **PASS** |
| Cross-user → 404 | **PASS** |

```bash
# Reproducible
npm run smoke:api
powershell -ExecutionPolicy Bypass -File scripts/sprint4-smoke-api.ps1
```

### Web runtime smoke

| Test | Result |
|---|---|
| `npm run smoke:web` mock (intake/concepts/foundation) | **PASS** |
| `VITE_USE_MOCKS=true` `/outline` renders mock | **NOT RUN** (no Playwright spec for outline) |
| `VITE_USE_MOCKS=false` no login — no crash | **NOT RUN** (automated) |
| `VITE_USE_MOCKS=false` login — full outline API flow in browser | **NOT RUN** (automated) |
| `planningTruth` not visible in DOM | **NOT RUN** (automated) |

**Catatan:** Jangan klaim full browser API-mode E2E PASS untuk `/outline`. Task 4.8 (optional) disarankan sebelum Sprint 5 jika ingin otomasi DOM/redaction check.

---

## 10. Known Limitations

- **No Write Room persistence** — `/write` masih Sprint 1 mock
- **No writer context packet** — Sprint 5+
- **No prose generation** — outline-only planning
- **No OpenRouter / AI generation** — deterministic stub
- **No full Reveal Gate yet** — breadcrumb compiler deferred
- **No automated outline API-mode Playwright** — Task 4.8 optional; **NOT RUN** di Task 4.7
- **No audit logs** untuk outline edits/approve/lock (`audit_action` extension deferred)
- **No DB transaction wrapper** untuk outline lock (plan + chapters + workflow_phase)
- **Open loop/reveal UI display-only** — CRUD via API only
- **Sprint 2 `smoke:api`** belum mencakup endpoint Sprint 3/4 (regression canon APIs only)
- **No remote deploy** — Worker + Supabase hosted belum di-push
- **Halaman web lain** (write, summary, publish) masih mock

---

## 11. Closure Decision

| Question | Answer |
|---|---|
| **Sprint 4 ready to close?** | **Yes** |
| **Blockers** | **None** — migration, API runtime, build, db reset, Sprint 4 smoke verified |
| **Non-blocking limitations** | Outline API-mode browser E2E **NOT RUN**; no audit on lock; no DB transaction; tracking UI display-only |

Sprint 4 deliverables (outline persistence + stub planner + tracking + approve/lock + web integration) are complete and verified for local development handoff.

---

## 12. Recommended Next Sprint

### Primary: **Sprint 5 — Safe Write Room & Context Packet**

Per [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md):

- `workflow_phase=outline_locked` adalah gate natural untuk Write Room
- Context Packet harus slice-only — tidak dump full outline / `planningTruth`
- Prose persistence (`prose_versions`, beat contracts) dimulai di Sprint 5

**Alasan:** Outline planning engine sudah terverifikasi; nilai produk berikutnya adalah menulis bab pertama dengan context aman — bukan menambah lapisan planning.

### Optional pre-Sprint 5 hardening: **Task 4.8 — Outline Web E2E API-mode Smoke Automation**

- Playwright spec untuk `/projects/:id/outline` di API mode
- Assert: generate, chapters, loops/reveals, no `planningTruth` in DOM, approve/lock, locked badge
- Extend `npm run smoke:web` atau script terpisah
- **Alasan:** Menutup gap verifikasi browser yang sengaja **NOT RUN** di Task 4.7; mengurangi risiko regresi web integration sebelum prose writer.

---

## Related documents

- [`docs/32-sprint-4-outline-planning-engine-implementation-plan.md`](32-sprint-4-outline-planning-engine-implementation-plan.md)
- [`docs/31-sprint-3-verification-report.md`](31-sprint-3-verification-report.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`supabase/README.md`](../supabase/README.md)
- `.agent-logs/sprint-4/`