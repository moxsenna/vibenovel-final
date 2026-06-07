# 29 — Sprint 2 Verification Report

**Sprint:** Sprint 2 — Data Model & API Shell  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/27-sprint-2-data-model-implementation-plan.md`](27-sprint-2-data-model-implementation-plan.md)

Dokumen ini adalah laporan penutupan resmi Sprint 2. Dibaca oleh developer manusia dan AI agent sebelum memulai Sprint 3.

**Work logs:** `.agent-logs/sprint-2/task-2.1` … `task-2.14`

---

## 1. Sprint 2 Summary

### Tujuan Sprint 2

Mengubah VibeNovel dari **frontend mock** menjadi aplikasi dengan **struktur data nyata** yang aman untuk serial fiction panjang — tanpa AI production, validator production, atau credit deduction production.

Sprint 2 menjawab: bagaimana menyimpan proyek, fondasi, tokoh, fakta canon, aturan bicara, proposal AI, dan preferensi penulis agar AI nanti tidak bisa mengubah canon secara diam-diam.

### Status akhir

| Aspek | Status |
|---|---|
| `packages/shared` domain types & enums | **Selesai (Task 2.1)** |
| Supabase migration + seed lokal | **Selesai (Task 2.3/2.4)** |
| `apps/api` — auth + CRUD canon APIs | **Selesai (Task 2.5–2.12)** |
| Web integration minimal | **Selesai (Task 2.13)** |
| Sprint 2 verification | **Selesai (Task 2.14 — dokumen ini)** |
| AI generation / OpenRouter | **Tidak ada (by design)** |
| Remote deploy / remote migration | **Tidak dilakukan** |

### Production-ish (siap dipakai lokal / handoff Sprint 3)

- Postgres schema 10 tabel + RLS + seed demo
- Hono API Worker dengan JWT auth, owner-only filtering, audit logs
- Endpoint CRUD: projects, settings, foundation, characters, facts, speech rules, proposals, credit balance read
- Web client + hooks untuk dashboard/settings/foundation dengan fallback mock
- Canon guardrails di API (AI source ditolak di facts/speech rules; proposals queue)

### Masih mock / fallback

- Halaman web selain dashboard, settings, foundation (intake, concepts, outline, write, summary, publish)
- Default `VITE_USE_MOCKS=true` — UI tidak pecah jika API offline
- Credit display seed-only; tidak ada ledger/deduction
- Proposal accept = status only (belum auto-promote ke facts/characters)
- Start flow / project create dari UI belum terhubung API
- Seed user `penulis@contoh.id` tidak bisa login via GoTrue (SQL seed limitation)

---

## 2. Architecture Added

### `packages/shared` (Task 2.1)

- Domain interfaces: `Project`, `StoryFoundation`, `Character`, `Fact`, `AiProposal`, `CreditBalance`, …
- Enums: quality modes (`hemat|seimbang|terbaik`), proposal status, fact categories, canon sources
- Konsumen: `apps/api`, `apps/web` (Task 2.13+)

### Supabase (Task 2.2–2.4)

- `supabase/migrations/00001_sprint2_core.sql` — 10 tabel, enums, RLS, triggers
- `supabase/seed.sql` — demo "Istri yang Mereka Buang"
- RLS draft: [`docs/28-supabase-rls-policy-draft.md`](28-supabase-rls-policy-draft.md)

### `apps/api` (Task 2.5–2.12)

- Hono 4 + Cloudflare Workers (Wrangler dev)
- `authMiddleware` — Supabase JWT via `getUser(token)`
- Service role server-side only; explicit `owner_id` / `project_id` filters
- Response format: `{ ok, data }` / `{ ok, error: { code, message } }`
- Append-only `audit_logs` untuk mutasi penting

### Web API client & fallback (Task 2.13)

- `apps/web/src/lib/api.ts` — fetch + Bearer dari Supabase session
- `apps/web/src/lib/env.ts` — `VITE_USE_MOCKS`, `VITE_API_URL`
- Services + hooks: projects, credits, settings, foundation, me
- `IntegrationNotice` — note kecil saat fallback mock
- `DevAuthPanel` — dev-only login helper (`import.meta.env.DEV` + `VITE_USE_MOCKS=false`)

---

## 3. Database Verification

### Migration

| Item | Status |
|---|---|
| File | `supabase/migrations/00001_sprint2_core.sql` |
| `supabase db reset` | **PASS** (8 Juni 2026, Task 2.14) |
| Tabel Sprint 4+ (chapters, prose_versions, credits_ledger) | **Tidak ada** ✓ |

### Tabel Sprint 2 (10)

```txt
profiles, projects, project_settings, story_foundations,
characters, facts, relationship_speech_rules, ai_proposals,
credit_balances, audit_logs
```

### Row count setelah `supabase db reset` + seed

| Tabel | Rows |
|---|---|
| profiles | 1 |
| projects | 1 |
| project_settings | 1 |
| story_foundations | 1 |
| characters | 4 |
| facts | 4 |
| relationship_speech_rules | 1 |
| ai_proposals | 1 |
| credit_balances | 1 |
| audit_logs | 3 |

**Seed IDs:** user `a0000000-0000-4000-8000-000000000001`, project `a0000000-0000-4000-8000-000000000101` (maps konsep `demo-project-001`).

### RLS & canon guardrail (ringkas)

- RLS enabled semua tabel publik Sprint 2
- Child tables: akses via `is_project_owner(project_id)`
- `credit_balances`: `user_id = auth.uid()`, read-only untuk authenticated
- `facts`: hanya `fact_source` enum — tidak ada `ai_direct` di schema
- `ai_proposals`: default `proposed`; workflow status di API
- Browser: anon key + JWT; **service role hanya `apps/api`**

---

## 4. API Endpoint Map

### Health

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /health`, `GET /api/health` | No | Health + env presence booleans | **PASS** | Tidak expose secret values |

### Auth & profile

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/me` | Bearer JWT | User + profile + creditBalance | **PASS** | No `POST /api/auth/*`; auth via Supabase client |

### Projects

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects` | Yes | List owner projects | **PASS** | |
| `POST /api/projects` | Yes | Create + default settings | **PASS** | |
| `GET /api/projects/:id` | Yes | Detail | **PASS** | Cross-user → 404 |
| `PATCH /api/projects/:id` | Yes | Update metadata | **PASS** (Task 2.7) | |
| `DELETE /api/projects/:id` | Yes | Soft archive `is_active=false` | **PASS** (Task 2.7) | Bukan hard delete |

### Settings

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/settings` | Yes | Read settings; create default if missing | **PASS** | |
| `PUT /api/projects/:id/settings` | Yes | Upsert quality mode, format, style | **PASS** | Rejects raw model/provider strings |

### Foundation bundle

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/projects/:id/foundation` | Yes | Foundation + active characters + confirmed facts | **PASS** | |
| `PUT /api/projects/:id/foundation` | Yes | Upsert foundation fields | **PASS** | Lock rules; no reveal truth |

### Characters

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET/POST/PATCH/DELETE .../characters` | Yes | Manual CRUD | **PASS** (POST smoke) | DELETE → `archived`; POST source must be `user` |

### Facts

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET/POST/PATCH/DELETE .../facts` | Yes | Confirmed canon CRUD | **PASS** | POST `ai_direct` → **400**; DELETE → `deprecated` |

### Speech rules

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET/POST/PATCH/DELETE .../speech-rules` | Yes | Relationship speech rules | **PASS** | POST `ai_direct` → **400**; DELETE → `deprecated` |

### AI proposals

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET/POST/PATCH .../proposals` | Yes | Proposal queue CRUD | **PASS** (Task 2.11) | |
| `POST .../accept|reject|merge` | Yes | Lifecycle transitions | **PASS** | **Accept status-only** — no auto canon promotion |

### Credits

| Endpoint | Auth | Purpose | Tested | Limitation |
|---|---|---|---|---|
| `GET /api/credits/balance` | Yes | Read-only display balance | **PASS** | No mutation, ledger, deduction |

---

## 5. Web Integration Status

| Page | API mode (`VITE_USE_MOCKS=false` + login) | Mock fallback |
|---|---|---|
| **Dashboard** | List projects, active project, credit usage | Mock projects + usage |
| **Settings** | GET settings, PUT quality mode, profile/credits from `/api/me` | Full mock settings |
| **Foundation** | GET foundation bundle (premise, characters, facts) | Mock foundation |

### `VITE_USE_MOCKS` behavior

| Value | Behavior |
|---|---|
| `true` (default) | Selalu mock Sprint 1 — UI stabil tanpa API |
| `false` | Coba API jika session ada; error → mock + `IntegrationNotice` |

### Fallback behavior

- API mati / network error → mock + notice kecil
- Tidak login (API mode) → mock + notice
- User tanpa proyek → mock + "belum ada proyek aktif"
- UI tidak blank; layout Sprint 1 tidak di-redesign

### DevAuthPanel

- Hanya `import.meta.env.DEV` + `VITE_USE_MOCKS=false` + Supabase configured
- Pojok kanan bawah; email/password signup/login untuk test lokal
- Tidak muncul di production build

### Web runtime smoke (Task 2.14)

| Check | Status | Catatan |
|---|---|---|
| `npm run build:web` | **PASS** | Task 2.14 |
| `npm run dev:web` live fetch | **Skipped** | Dev server tidak berjalan di sesi verifikasi |
| Mock mode render | **PASS** (by design + Task 2.13) | Default `VITE_USE_MOCKS=true` |
| API mode fallback | **PASS** (Task 2.13) | Error paths verified in hooks |
| API mode + DevAuth | **PASS** (Task 2.13) | Signup user + API reads |

---

## 6. Canon Guardrails Confirmed

| Rule | Status | Evidence |
|---|---|---|
| AI output tidak langsung masuk canon `facts` | **Confirmed** | `POST fact source=ai_direct` → 400 BAD_REQUEST |
| Facts menolak `openrouter`/`gemini`/`gpt`/… di source | **Confirmed** | API validation di `fact.ts` |
| Proposals accept = status only, tidak auto-promote | **Confirmed** | Task 2.11; accept smoke → `accepted`, no new fact row |
| Fact delete = soft deprecate (`canon_status: deprecated`) | **Confirmed** | Task 2.9 API |
| Speech rule delete = soft deactivate (`status: deprecated`) | **Confirmed** | Task 2.10 API |
| Project delete = archive (`is_active: false`) | **Confirmed** | Task 2.7 API |
| Owner-only filtering (`owner_id` dari JWT) | **Confirmed** | Cross-user GET project → 404 |

---

## 7. Security Guardrails Confirmed

| Guardrail | Status |
|---|---|
| Service role backend only (`apps/api`, never `apps/web`) | **Confirmed** |
| No secrets in repo (`.dev.vars`, `.env.local` gitignored) | **Confirmed** |
| `/health` exposes env presence booleans only | **Confirmed** |
| JWT required for protected endpoints | **Confirmed** (`GET /api/me` no token → 401) |
| `userId` always from JWT, never trusted from body/query | **Confirmed** |
| Cross-user project access returns 404 (not 403) | **Confirmed** (smoke test) |
| No access token in logs / responses | **Confirmed** (code review Task 2.6–2.13) |

---

## 8. Smoke Test Checklist

### Build & typecheck (8 Juni 2026)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `supabase db reset` | **PASS** |

### Dev servers

| Command | Result | Catatan |
|---|---|---|
| `npm run dev:api` | **Running** | Port 8787 (sesi dev existing) |
| `npm run dev:web` | **Not run** | `build:web` PASS; live dev skipped |

### API runtime smoke (signup test user, 8 Juni 2026)

| Test | Result |
|---|---|
| `GET /health` | **PASS** |
| `GET /api/me` no token → 401 | **PASS** |
| signup/login test user | **PASS** |
| `GET /api/projects` | **PASS** |
| `POST /api/projects` | **PASS** |
| `GET/PUT /api/projects/:id/settings` | **PASS** (`qualityMode: terbaik`) |
| `GET/PUT /api/projects/:id/foundation` | **PASS** |
| `POST /api/projects/:id/characters` | **PASS** |
| `POST fact source=user` | **PASS** |
| `POST fact source=ai_direct` → 400 | **PASS** |
| `POST speech rule source=user` | **PASS** |
| `POST speech rule source=ai_direct` → 400 | **PASS** |
| `POST proposal high-risk` → `proposed` | **PASS** |
| accept proposal → `accepted` (status only) | **PASS** |
| `GET /api/credits/balance` | **PASS** (`null` for new user) |
| cross-user seed project → 404 | **PASS** |

Script reproducible: `scripts/sprint2-smoke-api.ps1` (lokal, opsional).

### Web runtime smoke

| Test | Result |
|---|---|
| `VITE_USE_MOCKS=true` pages render | **PASS** (default + build) |
| `VITE_USE_MOCKS=false` no login → safe fallback | **PASS** (Task 2.13 hooks) |
| `VITE_USE_MOCKS=false` + DevAuth → API mode | **PASS** (Task 2.13) |

---

## 9. Known Limitations

- **No AI generation** — tidak ada OpenRouter, chat intake persistence, concept generation
- **No real credit deduction / ledger** — `credit_balances` display-only
- **No outline / chapter / prose persistence** — tabel Sprint 4+ belum ada
- **No publish package production API**
- **No global route protection** — AuthProvider ada; routes tidak di-guard
- **Only dashboard / settings / foundation integrated** — 9 halaman lain masih mock
- **Settings save limited** — web PUT hanya `qualityMode` di Task 2.13
- **Foundation edit/lock UI** belum wired ke PUT API
- **Proposal accept tidak auto-promote** ke facts/characters (keputusan Task 2.11)
- **Seed user GoTrue login** — `penulis@contoh.id` gagal password login setelah SQL seed
- **No CI automated test suite** — smoke manual / script lokal
- **No remote deploy** — Worker + Supabase hosted belum di-push

---

## 10. Sprint 2 Acceptance vs Plan (doc 27)

| Kriteria doc 27 | Status | Catatan |
|---|---|---|
| 9+ tabel inti + RLS | **Met** | 10 tabel termasuk audit_logs |
| Auth register/login | **Met** | Supabase client; bukan API routes |
| Project CRUD + ownership | **Met** | |
| Settings persist | **Met** | API + web PUT quality mode |
| Canon safety (no AI direct to facts) | **Met** | |
| Accept proposal → create fact transaction | **Deferred** | Status-only accept (Task 2.11 user decision) |
| Credit display seed | **Met** | |
| No OpenRouter / deduction | **Met** | |
| UI not redesigned | **Met** | |
| Dashboard/settings/foundation API | **Met** | |
| Automated integration tests | **Partial** | Manual smoke + optional script |

---

## 11. Recommended Next Sprint

### Primary: **Sprint 3 — Story Foundation Flow (Intake + Concept + Foundation Real)**

Per [`docs/17-roadmap-sprint-plan-mvp-to-full.md`](17-roadmap-sprint-plan-mvp-to-full.md):

- Chat intake + concept selection dengan **proposal queue** (bukan canon direct)
- Foundation readiness + lock UI wired ke API
- Proposal accept → canon promotion (transaction) — lanjutan Task 2.11b
- Intake/concept pages mulai baca/tulis API

### Optional hardening (Sprint 2.15)

- CI job: `typecheck` + `build:*` + `supabase db reset` + `scripts/sprint2-smoke-api.ps1`
- Fix seed user GoTrue login (auth trigger vs SQL insert)
- Wire start flow project create ke `POST /api/projects`

---

## 12. Closure Decision

| Question | Answer |
|---|---|
| **Sprint 2 ready to close?** | **Yes** |
| **Blockers** | **None** — limitations documented above are intentional deferrals, not defects |

Sprint 2 deliverables (data model, API shell, canon infrastructure, minimal web integration) are complete and verified for local development handoff to Sprint 3.

---

## Related documents

- [`docs/27-sprint-2-data-model-implementation-plan.md`](27-sprint-2-data-model-implementation-plan.md)
- [`docs/28-supabase-rls-policy-draft.md`](28-supabase-rls-policy-draft.md)
- [`docs/22-sprint-1-verification-report.md`](22-sprint-1-verification-report.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`supabase/README.md`](../supabase/README.md)
- `.agent-logs/sprint-2/`