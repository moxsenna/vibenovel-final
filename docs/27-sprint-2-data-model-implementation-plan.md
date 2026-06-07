# 27 — Sprint 2 Data Model Implementation Plan

**Status:** Planning document (Task 2.0)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite docs:** `docs/22` – `docs/26`, `.agents/rules/00–02`

Dokumen ini adalah **rencana implementasi detail** untuk Sprint 2. Bukan migration, bukan kode production. Agent dan developer manusia wajib membaca ini sebelum menulis schema, API, atau mengubah UI Sprint 1.

---

## 1. Sprint 2 Goal

Mengubah VibeNovel dari **frontend mock** menjadi aplikasi dengan **struktur data nyata** yang aman untuk serial fiction panjang — tanpa membangun AI production, validator production, atau credit deduction production.

Sprint 2 menjawab pertanyaan:

```txt
Bagaimana cara menyimpan proyek, fondasi cerita, tokoh, fakta canon,
aturan bicara, proposal AI, dan preferensi penulis
agar AI nanti tidak bisa mengubah canon secara diam-diam?
```

**Hasil yang diharapkan di akhir Sprint 2:**

- User bisa login dan memiliki proyek miliknya sendiri.
- Dashboard dan settings membaca/menulis data nyata (bukan mock statis).
- Fondasi cerita, tokoh, dan fakta bisa disimpan minimal di database.
- **AI Proposal Queue** (`ai_proposals`) sudah ada sebagai infrastruktur wajib.
- **Fakta penting tidak pernah langsung masuk `facts` dari output AI** — harus lewat proposal + persetujuan.
- `credit_balances` hanya saldo seed/display; belum ada ledger atau pemotongan nyata.

Sprint 2 **bukan** sprint AI. Sprint 2 adalah fondasi data untuk Sprint 3–6.

---

## 2. Sprint 2 Scope

### In scope

| Area | Sprint 2 deliverable |
|---|---|
| `packages/shared` | Shared TypeScript types + Zod schemas (atau setara) untuk domain Sprint 2 |
| `apps/api` | Scaffold minimal: health, env, error format, auth guard shell |
| `supabase/` | Migration awal untuk 9 tabel inti |
| Auth shell | Register / login / logout / session; `profiles` terhubung ke user |
| Project CRUD | Create, list, detail, active project context |
| Settings persistence | Mode kualitas, bahasa, format HP/KBM, gaya output (via `project_settings` + profil jika perlu) |
| Story foundation storage | `story_foundations` + relasi ke `characters`, `facts`, `relationship_speech_rules` |
| AI proposal infrastructure | CRUD proposal manual/API; status workflow; belum AI auto-fill |
| Credit display seed | `credit_balances` row per user; UI menampilkan saldo nyata dari DB |
| Web integration (minimal) | Dashboard, start flow project create, settings load/save — **tanpa redesign UI Sprint 1** |
| Tests | Migration smoke + API integration tests untuk CRUD inti |

### Explicitly not in Sprint 2

Lihat bagian **9. Out of Scope Sprint 2**.

### Alignment dengan Sprint 1

| Sprint 1 asset | Sprint 2 treatment |
|---|---|
| `apps/web/src/mocks/*` | Tetap ada sebagai fallback/dev seed; diganti bertahap di layer data fetch |
| 12 halaman UI final | Layout/visual **tidak di-redesign**; hanya sambungkan ke API where scoped |
| `demo-project-001` | Bisa di-seed ke DB untuk dev; route `:id` pakai ID nyata |

---

## 3. Proposed Database Tables

Sembilan tabel inti Sprint 2 (urutan migrasi disarankan):

```txt
1. profiles
2. projects
3. project_settings
4. story_foundations
5. characters
6. facts
7. relationship_speech_rules
8. ai_proposals
9. credit_balances
```

**Catatan:** Tabel planning (`chapters`, `reveals`, `chapter_beats`, `prose_versions`, `chapter_deltas`, `credits_ledger`) **ditunda** ke Sprint 4–8 sesuai `docs/12-database-schema-and-data-model.md` dan `docs/26-current-sprint-plan.md`.

### 3.1 `profiles`

Extension profil penulis, terhubung ke Supabase Auth `auth.users`.

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `display_name` | text | User-facing: nama tampilan |
| `email` | text | Mirror dari auth (read-only di app) |
| `default_language` | text | e.g. `id` |
| `plan_label` | text | e.g. `Free Plan` (display only Sprint 2) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3.2 `projects`

Satu baris = satu serial fiction workspace.

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK → profiles | RLS: owner only |
| `title` | text | Judul sementara / working title |
| `genre` | text nullable | |
| `status` | enum | `draft`, `in_progress`, `published` (align mock Sprint 1) |
| `current_chapter` | int default 0 | Display progress |
| `entry_path` | text nullable | `no_idea`, `rough_idea`, `has_draft`, `has_outline`, `repair_only` |
| `is_active` | boolean | Satu active per user (constraint app-level atau partial unique) |
| `last_edited_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3.3 `project_settings`

Preferensi penulis + mode kualitas per proyek (atau global di profile — keputusan: **per project** untuk Sprint 2, mirror UI settings saat ini).

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK unique → projects | 1:1 |
| `quality_tier` | enum | `hemat`, `seimbang`, `terbaik` — **bukan raw model ID** |
| `default_output_style` | text | e.g. `Narasi hangat & emosional` |
| `default_format` | enum/text | `hp_kbm`, `desktop` |
| `target_length_band` | text nullable | Placeholder untuk Sprint 4 (`30-50`, `70-100`, dll.) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3.4 `story_foundations`

Fondasi cerita — internal: Story Foundation; UI: **Fondasi Cerita**.

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK unique → projects | 1:1 per project |
| `premise` | text | |
| `main_conflict` | text | |
| `reader_promise` | text | |
| `tone` | text nullable | |
| `genre` | text nullable | |
| `target_reader` | text nullable | |
| `story_secrets_preview` | text nullable | Ringkasan rahasia (bukan truth mentah untuk writer) |
| `style_tags` | jsonb | Array string gaya cerita |
| `readiness_percent` | int | 0–100, computed atau stored |
| `readiness_status` | text | User-facing: `belum_siap`, `bisa_lanjut`, `siap_dikunci` |
| `is_locked` | boolean default false | Setelah lock foundation (manual Sprint 2) |
| `locked_at` | timestamptz nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3.5 `characters`

Tokoh dalam proyek — canon description, bukan knowledge engine penuh (knowledge state Sprint 5).

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → projects | |
| `name` | text | |
| `role_label` | text | User-facing: Tokoh Utama, Suami, dll. |
| `description` | text | |
| `importance` | enum | `main`, `supporting`, `minor` |
| `sort_order` | int | Urutan tampilan UI |
| `source` | enum | `user`, `system_seed`, `accepted_proposal` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3.6 `facts`

**Hanya fakta canon yang sudah sah.** Bukan tempat menyimpan draft AI.

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → projects | |
| `text` | text | Kalimat fakta user-facing |
| `category` | enum | `identity`, `relationship`, `family`, `event`, `secret`, `motive`, `location`, `item`, `world_rule`, `timeline`, `status`, `promise` |
| `importance` | enum | `minor`, `major`, `core` |
| `is_locked` | boolean | Fakta yang Dikunci |
| `source` | enum | `user`, `system`, `accepted_proposal`, `imported_draft` (imported inactive Sprint 2) |
| `accepted_from_proposal_id` | uuid FK nullable → ai_proposals | Audit trail |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Rule:** Row dengan `source = ai_proposal` **tidak boleh** ada. AI harus masuk `ai_proposals` dulu.

### 3.7 `relationship_speech_rules`

Aturan bicara / gaya dialog per relasi — migrasi dari konsep legacy, wajib di Sprint 2 per audit.

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → projects | |
| `relationship_label` | text | e.g. `Nadira ↔ Bu Siti` |
| `character_a_id` | uuid FK nullable → characters | |
| `character_b_id` | uuid FK nullable → characters | |
| `rule_text` | text | User-facing rule, plain language |
| `examples` | jsonb nullable | Contoh kalimat (opsional) |
| `source` | enum | `user`, `accepted_proposal` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 3.8 `ai_proposals`

**AI Proposal Queue** — jantung canon safety Sprint 2+.

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK → projects | |
| `proposal_type` | enum | Lihat daftar di bawah |
| `status` | enum | **`proposed`, `accepted`, `rejected`, `merged`** (minimum wajib) |
| `risk_level` | enum | `low`, `medium`, `high` |
| `source` | enum | `user_manual`, `system_seed`, `ai_chat`, `ai_foundation`, `ai_import` — AI sources inactive until Sprint 3 |
| `title` | text | Ringkasan singkat untuk UI kartu |
| `payload` | jsonb | Structured proposal body |
| `review_note` | text nullable | Catatan user saat reject/merge |
| `reviewed_at` | timestamptz nullable | |
| `reviewed_by` | uuid FK nullable → profiles | |
| `merged_into_id` | uuid FK nullable → ai_proposals | Untuk status `merged` |
| `result_fact_id` | uuid FK nullable → facts | Setelah accept → fact |
| `result_character_id` | uuid FK nullable → characters | Setelah accept → character |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**`proposal_type` (Sprint 2 minimum set):**

```txt
character_proposal
fact_proposal
relationship_proposal
secret_proposal
speech_rule_proposal
style_proposal
foundation_field_proposal
```

Types berikut **ditunda** (kolom enum bisa reserved, belum dipakai):

```txt
reveal_proposal
world_rule_proposal
chapter_delta_proposal
```

**Status workflow wajib:**

```txt
proposed  → menunggu keputusan user
accepted  → dipromosikan ke canon (facts/characters/rules) via API transaction
rejected  → ditolak, tidak masuk canon
merged    → digabung ke proposal lain sebelum accept
```

Opsional internal later: `deprecated` (bukan minimum Sprint 2).

**High-risk categories** (flag di `payload` atau `risk_level = high`):

```txt
kehamilan, anak, kematian, hubungan keluarga, masa lalu romantis,
rahasia besar, benda penting, status nikah/hukum
```

### 3.9 `credit_balances`

Saldo display — **bukan ledger**.

| Column (proposed) | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK unique → profiles | 1:1 |
| `balance` | int | Seed e.g. 1250 (align Sprint 1 shell mock) |
| `monthly_quota` | int | Display quota Sprint 2 |
| `monthly_used` | int | Display usage Sprint 2 — **tidak dipotong otomatis** |
| `reset_at` | date nullable | Tanggal reset kuota display |
| `updated_at` | timestamptz | |

**Tidak ada** `credits_ledger`, `usage_events`, atau deduction logic di Sprint 2.

---

## 4. Table Responsibility

| Table | Tanggung jawab | Bukan tanggung jawab |
|---|---|---|
| `profiles` | Identitas penulis, default bahasa, plan label display | Auth token storage (Supabase Auth) |
| `projects` | Workspace serial, ownership, status, entry path | Outline, bab, prose |
| `project_settings` | Hemat/Seimbang/Terbaik, format, gaya output | Model routing, OpenRouter config |
| `story_foundations` | Premise, konflik, janji pembaca, readiness, lock state | Generate foundation via AI |
| `characters` | Canon character registry (accepted) | Character knowledge states (Sprint 5) |
| `facts` | **Confirmed canon facts only** | Menyimpan saran AI mentah |
| `relationship_speech_rules` | Aturan bicara antar tokoh | Voice DNA / mimicry (Sprint 11) |
| `ai_proposals` | Antrian saran AI/user sebelum canon | Menjadi source of truth langsung |
| `credit_balances` | Saldo & kuota **display** | Pemotongan, refund, ledger |

**Hierarki kebenaran Sprint 2:**

```txt
User explicit input + accepted proposals → facts / characters / rules
AI/chat/import output → ai_proposals ONLY (status: proposed)
facts table → NEVER receives raw AI output
```

---

## 5. Canon Rule

Aturan canon VibeNovel Core v2 yang **harus diimplementasikan** mulai Sprint 2:

### 5.1 Sumber kebenaran

```txt
Canonical Story State = facts + characters + story_foundations (locked fields)
                     + relationship_speech_rules (accepted)
AI is NOT the source of truth.
```

### 5.2 Jalur fakta penting

```txt
1. AI atau sistem menghasilkan saran → INSERT ai_proposals (status: proposed)
2. User review di UI (kartu persetujuan — UI Sprint 3, API Sprint 2)
3. User accept → API transaction:
   - UPDATE ai_proposals.status = accepted
   - INSERT facts / characters / relationship_speech_rules
   - SET accepted_from_proposal_id / result_*_id
4. User reject → status = rejected, tidak ada write ke facts
5. User merge → status = merged, payload digabung ke proposal target
```

### 5.3 Larangan keras

```txt
❌ INSERT langsung ke facts dari AI generation
❌ UPDATE facts dari chat output tanpa proposal
❌ Menyimpan "proposed fact" di facts dengan canonStatus proposed
   (gunakan ai_proposals saja — facts hanya confirmed)
❌ Frontend menulis canon langsung ke Supabase tanpa API
```

### 5.4 Fakta user vs fakta AI

| Source | Masuk ke | Kapan |
|---|---|---|
| User mengetik di form foundation | `ai_proposals` (optional) atau langsung `facts` jika user explicitly saves as canon | Sprint 2: manual CRUD dengan `source = user` |
| System seed / demo | `facts` dengan `source = system` | Dev seed only |
| AI (Sprint 3+) | `ai_proposals` only | Never direct to `facts` |

### 5.5 Lock foundation

Saat `story_foundations.is_locked = true`:

- Field inti tidak boleh diubah tanpa warning + audit (Sprint 3 UI).
- Sprint 2: enforce di API — reject update kecuali admin flag atau unlock flow.

---

## 6. User-facing Terms

Istilah **UI** (Indonesia, beginner-friendly) vs istilah **internal/docs**:

| User-facing (UI Sprint 1 — pertahankan) | Internal table / code | Jangan tampilkan ke user |
|---|---|---|
| Fondasi Cerita | `story_foundations` | Story Foundation, Canonical State |
| Fakta yang Dikunci | `facts` where `is_locked = true` | Fact Registry |
| Rahasia Cerita | `story_secrets_preview`, `secret_proposal` | Reveal Gate, Mystery Layer |
| Kesiapan Fondasi | `readiness_percent`, `readiness_status` | Foundation Readiness Score |
| Tokoh Utama / Tokoh Penting | `characters` | Character State Engine |
| Aturan Bicara | `relationship_speech_rules` | Speech Rules Engine |
| Saran AI / Perlu Persetujuan | `ai_proposals` | AI Proposal Queue, Approval Card |
| Terima / Tolak / Gabungkan | `accepted`, `rejected`, `merged` | canon promotion |
| Mode Kualitas: Hemat / Seimbang / Terbaik | `project_settings.quality_tier` | OpenRouter, model ID, provider |
| Kredit / Pemakaian Bulan Ini | `credit_balances` | ledger, usage_events |
| Proyek Baru | `projects` | — |

**Copy guardrail Sprint 2 (sama seperti Sprint 1):**

- Tidak ada raw model ID, OpenRouter, Canonical State, Context Packet, Reveal Gate, Validator, Chapter Delta di UI utama.
- Tidak klaim kredit sudah terpotong otomatis.
- Tidak klaim AI sudah menghasilkan cerita sempurna.

---

## 7. Sprint 2 Task Breakdown

Task diurutkan untuk **split kecil** per `.agents/rules/02-sprint-discipline.md`. Satu task = satu verifikasi sebelum lanjut.

### Task 2.0 — Data Model Implementation Plan ✅

**Output:** `docs/27-sprint-2-data-model-implementation-plan.md` (dokumen ini)  
**Acceptance:** Plan reviewed; no code/migration yet.

---

### Task 2.1 — Shared package foundation

**Goal:** Satu sumber tipe untuk web + api.

**Build:**

```txt
packages/shared/
  src/types/     — Project, Profile, StoryFoundation, Character, Fact, AiProposal, ...
  src/schemas/   — Zod validation mirrors (optional but recommended)
  src/constants/ — enums: quality_tier, proposal_status, proposal_type, fact_category
  package.json + tsconfig
```

**Read:** `docs/12`, `docs/04`, mock types di `apps/web/src/types/`

**Acceptance:**

```txt
packages/shared builds
apps/web imports shared types for new data layer (no duplicate enums)
no AI/engine code in shared
```

---

### Task 2.2 — Supabase project setup & RLS policy draft

**Goal:** Supabase project terhubung; kebijakan keamanan ditulis sebelum migration.

**Build:**

```txt
supabase/config.toml (or link existing)
supabase/migrations/00001_sprint2_core.sql — REVIEW ONLY in 2.2, apply in 2.3
RLS: projects.owner_id = auth.uid()
RLS: child tables via project ownership join
```

**Acceptance:**

```txt
RLS document exists in migration comments
no public write without auth
service role only for admin scripts
```

---

### Task 2.3 — Core migration (9 tables)

**Goal:** Apply migration untuk 9 tabel inti.

**Build:** SQL migration dengan:

- PK/FK constraints
- indexes: `projects.owner_id`, `ai_proposals.project_id + status`, `facts.project_id`
- enums as Postgres ENUM or text + check constraint
- `updated_at` triggers (optional)

**Acceptance:**

```txt
supabase db reset / migration apply succeeds locally
all 9 tables exist
foreign keys valid
no chapters/beats/prose tables yet
```

---

### Task 2.4 — Seed script (dev/demo)

**Goal:** Seed `demo-project-001` equivalent dari Sprint 1 mocks.

**Build:**

```txt
scripts/seed-demo-project.ts (or supabase/seed.sql)
Maps mockStoryFoundation → story_foundations + characters + facts
Seed credit_balances = 1250
Seed ai_proposals examples (status: proposed) — NOT auto-promoted to facts
```

**Acceptance:**

```txt
After seed, dev user sees familiar "Istri yang Mereka Buang" data
facts table only contains confirmed/seed canon
at least 1 sample ai_proposal in proposed state
```

---

### Task 2.5 — API scaffold (`apps/api`)

**Goal:** Backend shell siap menerima routes.

**Build:**

```txt
Hono (or agreed stack) + TypeScript
GET /health
env validation (SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.)
standard error JSON { error, code, details? }
auth middleware stub (verify JWT from Supabase)
README with local run instructions
```

**Acceptance:**

```txt
npm run dev:api (or documented command) starts
/health returns 200
no AI routes
```

---

### Task 2.6 — Auth shell

**Goal:** User dapat login; `profiles` terisi on first sign-in.

**Build:**

```txt
POST /auth/register (or Supabase client-side + POST /profiles/sync)
POST /auth/login
POST /auth/logout
GET /me → profile + credit_balances
Trigger: on auth.users insert → profiles row
```

**Web (minimal):** auth context atau Supabase client; protect app routes — **tanpa redesign AppShell**.

**Acceptance:**

```txt
user can register/login
profiles row exists
/me returns display_name
unauthenticated API returns 401
```

---

### Task 2.7 — Project persistence API

**Goal:** CRUD proyek nyata.

**Build:**

```txt
POST   /projects
GET    /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id (soft delete optional)
POST   /projects/:id/activate
```

**Acceptance:**

```txt
owner can CRUD own projects only
dashboard can list real projects
/start → create project → redirect to intake with real :id
```

---

### Task 2.8 — Project settings API

**Goal:** Persist Hemat/Seimbang/Terbaik dan preferensi penulis.

**Build:**

```txt
GET  /projects/:id/settings
PUT  /projects/:id/settings
Maps to project_settings table
quality_tier validates: hemat | seimbang | terbaik only
```

**Acceptance:**

```txt
/settings page loads real settings for active project
save persists to DB
reload shows same values
no model ID stored or returned
```

---

### Task 2.9 — Story foundation + characters + facts API

**Goal:** Manual CRUD fondasi — belum AI.

**Build:**

```txt
GET   /projects/:id/foundation
PUT   /projects/:id/foundation
GET   /projects/:id/characters
POST  /projects/:id/characters
PATCH /projects/:id/characters/:characterId
GET   /projects/:id/facts
POST  /projects/:id/facts          — source must be user | system only
PATCH /projects/:id/facts/:factId
POST  /projects/:id/foundation/lock
```

**Acceptance:**

```txt
foundation page reads from API for real project
user can add fact with source=user directly (explicit human action)
API rejects POST /facts with source=ai_*
readiness_percent computed or returned
```

---

### Task 2.10 — Relationship speech rules API

**Build:**

```txt
GET  /projects/:id/speech-rules
POST /projects/:id/speech-rules
PATCH /projects/:id/speech-rules/:id
```

**Acceptance:**

```txt
rules persist per project
only accepted/user sources in Sprint 2
```

---

### Task 2.11 — AI Proposal Queue API (manual workflow)

**Goal:** Infrastruktur proposal tanpa AI generation.

**Build:**

```txt
GET   /projects/:id/proposals?status=proposed
POST  /projects/:id/proposals        — manual create for testing
POST  /projects/:id/proposals/:id/accept  — promotes to facts/characters/rules in transaction
POST  /projects/:id/proposals/:id/reject
POST  /projects/:id/proposals/:id/merge
```

**Acceptance:**

```txt
accept creates fact/character ONLY inside transaction
reject does not touch facts
high-risk proposal_types require risk_level=high
status transitions validated (cannot accept rejected)
unit test: AI-simulated proposal → accept → fact exists
```

---

### Task 2.12 — Credit balance read API

**Build:**

```txt
GET /me/credits → { balance, monthly_quota, monthly_used, reset_at }
PATCH /me/credits — FORBIDDEN in Sprint 2 (admin seed only)
```

**Acceptance:**

```txt
CreditIndicator shows DB balance
no deduction endpoint exists
UI copy still says dummy/local if monthly_used is display-only
```

---

### Task 2.13 — Web data layer integration (minimal)

**Goal:** Sambungkan halaman ter-scope tanpa UI redesign.

**Pages (priority order):**

```txt
1. /dashboard      — list projects, active project
2. /settings       — load/save project_settings
3. /start          — create project
4. /projects/:id/foundation — read/write foundation, facts, characters
```

**Pattern:**

```txt
apps/web/src/lib/api/ — fetch wrappers
React Query or simple hooks (match existing stack)
Keep mocks as fallback behind env flag VITE_USE_MOCKS=true
```

**Acceptance:**

```txt
npm run typecheck PASS
npm run build:web PASS
dashboard shows real project after login
foundation loads from API for seeded project
UI visual unchanged from Sprint 1
```

---

### Task 2.14 — Sprint 2 verification report

**Output:** `docs/28-sprint-2-verification-report.md`

**Acceptance:** Same format as doc 22; lists what is real vs still dummy.

---

## 8. Acceptance Criteria Sprint 2

Sprint 2 dianggap **selesai** jika semua berikut terpenuhi:

### Data & schema

- [ ] 9 tabel inti ada dan ter-migrate
- [ ] RLS mencegah akses lintas user
- [ ] `facts` hanya berisi fakta confirmed (`user`, `system`, `accepted_proposal`)
- [ ] `ai_proposals` ada dengan status `proposed | accepted | rejected | merged`
- [ ] Tidak ada tabel `chapters`, `prose_versions`, `credits_ledger` production

### Auth & projects

- [ ] User dapat register/login/logout
- [ ] User dapat membuat proyek; proyek muncul di dashboard
- [ ] Project ownership enforced
- [ ] Settings (mode kualitas, preferensi) persist ke `project_settings`

### Canon safety

- [ ] API **menolak** menulis fakta penting langsung dari source AI
- [ ] Flow accept proposal → create fact berjalan dalam transaction
- [ ] Reject proposal tidak mengubah canon
- [ ] Dokumentasi canon rule di doc 27 dipatuhi di code review

### Credits

- [ ] `credit_balances` menampilkan saldo seed
- [ ] **Tidak ada** endpoint deduction / ledger / OpenRouter

### Frontend

- [ ] UI Sprint 1 tidak di-redesign
- [ ] Dashboard + settings + foundation terhubung data nyata (minimal)
- [ ] `npm run typecheck` dan `npm run build:web` lulus

### Explicit non-goals verified absent

- [ ] No OpenRouter integration
- [ ] No AI generation endpoints
- [ ] No beat writer / prose tables
- [ ] No validator execution
- [ ] No reveal gate service
- [ ] No draft import
- [ ] No publish API integration

---

## 9. Out of Scope Sprint 2

| Item | Defer to |
|---|---|
| OpenRouter / model routing production | Sprint 3 skeleton, Sprint 8 full |
| AI generation (chat, concept, foundation, prose) | Sprint 3–5 |
| Beat writer / prose_versions | Sprint 5 |
| Validator suite (Cek Cerita production) | Sprint 6 |
| Reveal Gate / breadcrumbs / reveals table | Sprint 4–5 |
| Character knowledge states | Sprint 5 |
| Chapter Delta / ringkasan bab extractor | Sprint 6 |
| Credit ledger / deduction / refund | Sprint 8 |
| Draft import / upload | Sprint 10 |
| Publish integration / platform API | Sprint 7 |
| Outline / chapters / beats schema | Sprint 4 |
| Intake sessions / chat messages persistence | Sprint 3 |
| Legacy code copy | Never |
| UI Sprint 1 redesign | Never in Sprint 2 |
| Advanced Mode / Story Bible editor | Sprint 9 |

---

## 10. Risks & Guardrails

### Risk 1 — Schema creep

**Risk:** Sprint 2 mengembangkan tabel chapters/beats terlalu awal.  
**Guardrail:** Hanya 9 tabel inti; planning tables explicit defer Sprint 4.

### Risk 2 — AI output langsung ke facts

**Risk:** Developer shortcut `INSERT INTO facts` dari chat.  
**Guardrail:** API layer wajib; `source` enum tanpa `ai_raw`; code review + test accept/reject.

### Risk 3 — Frontend bypass canon

**Risk:** Web menulis langsung ke Supabase dari browser.  
**Guardrail:** Semua canon writes lewat `apps/api`; RLS deny direct client write ke `facts` (read-only client or none).

### Risk 4 — Exposing model IDs

**Risk:** `project_settings` menyimpan `gemini-2.x` atau `openrouter/...`.  
**Guardrail:** Hanya `hemat | seimbang | terbaik`; routing table di backend Sprint 3+ (env/config, bukan DB user-facing).

### Risk 5 — Credit system setengah jadi

**Risk:** User mengira kredit sudah terpotong.  
**Guardrail:** No ledger; UI copy tetap jujur; `monthly_used` display-only atau manual seed.

### Risk 6 — Breaking Sprint 1 UI

**Risk:** Integrasi API memaksa redesign.  
**Guardrail:** Adapter layer maps API → existing component props; mock fallback flag.

### Risk 7 — Mixing tasks

**Risk:** Schema + AI prompt + UI dalam satu PR.  
**Guardrail:** Satu task = satu PR; typecheck antara task (`02-sprint-discipline`).

### Risk 8 — Legacy architecture bleed

**Risk:** Copy Zustand/store atau client-side AI dari legacy.  
**Guardrail:** `docs/23` DROP list; reference only.

---

## 11. Recommended First Coding Task

**Start with Task 2.1 — Shared package foundation** (`packages/shared`).

Alasan:

1. **Risiko terendah** — tidak menyentuh DB, auth, atau UI.
2. Memaksa keputusan enum (`proposal_status`, `quality_tier`, `fact_category`) ditulis sekali sebelum migration.
3. `apps/web` dan `apps/api` bisa mengimpor tipe yang sama — mencegah drift mock vs schema.
4. Sesuai urutan `docs/26-current-sprint-plan.md` Task 2.1.
5. Mudah diverifikasi: `packages/shared` build + typecheck tanpa Supabase.

**Prompt siap pakai untuk Task 2.1:**

```txt
Lanjut Task 2.1 — Shared Package Foundation.

Baca:
- docs/27-sprint-2-data-model-implementation-plan.md
- docs/12-database-schema-and-data-model.md
- docs/04-story-foundation-and-canon-system.md
- apps/web/src/types/ (existing mocks)

Build packages/shared dengan types + enums Sprint 2.
Jangan buat migration.
Jangan buat API.
Jangan ubah UI.
Jangan mulai AI.

Acceptance: packages/shared builds; enums match doc 27.
```

---

## Appendix A — Entity relationship (Sprint 2)

```txt
profiles 1───* projects
projects 1───1 project_settings
projects 1───1 story_foundations
projects 1───* characters
projects 1───* facts
projects 1───* relationship_speech_rules
projects 1───* ai_proposals
profiles 1───1 credit_balances

ai_proposals ──(accept)──► facts | characters | relationship_speech_rules
facts.accepted_from_proposal_id ──► ai_proposals.id
```

## Appendix B — Mapping Sprint 1 mocks → Sprint 2 tables

| Mock file | Target tables |
|---|---|
| `mocks/projects.ts` | `projects` |
| `mocks/shell.ts` | `profiles`, `credit_balances` |
| `mocks/settings.ts` | `project_settings`, `credit_balances` |
| `mocks/storyFoundation.ts` | `story_foundations`, `characters`, `facts` |
| `mocks/dashboard.ts` | `projects` (aggregated view) |
| `mocks/concepts.ts` | **Sprint 3** (`ai_proposals` type concept) |
| `mocks/intake.ts` | **Sprint 3** (intake_sessions) |
| `mocks/outline.ts` | **Sprint 4** |
| `mocks/chapter.ts` | **Sprint 5** |
| `mocks/summary.ts` | **Sprint 6** |
| `mocks/publishPackage.ts` | **Sprint 7** |

## Appendix C — Document cross-reference

| Topic | Doc |
|---|---|
| Sprint 1 status | `docs/22-sprint-1-verification-report.md` |
| Legacy audit | `docs/23-legacy-vibenovel-audit.md` |
| Feature migration | `docs/24-feature-migration-map.md` |
| Problem coverage | `docs/25-problem-coverage-matrix.md` |
| Current sprint plan | `docs/26-current-sprint-plan.md` |
| Canon system | `docs/04-story-foundation-and-canon-system.md` |
| Schema overview | `docs/12-database-schema-and-data-model.md` |
| API workflow | `docs/13-api-routes-and-backend-workflow.md` |
| Credits (later) | `docs/14-ai-model-routing-credit-and-cost-system.md` |

---

*Task 2.0 selesai. Jangan mulai coding schema sebelum Task 2.1–2.3 direview.*