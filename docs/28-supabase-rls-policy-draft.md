# 28 — Supabase RLS Policy Draft (Sprint 2)

**Status:** Draft policy document (Task 2.2)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** `docs/27`, `packages/shared`, Task 2.1 approved

Dokumen ini adalah **rancangan kebijakan Row Level Security** untuk Sprint 2. Bukan migration SQL final. Migration executable masuk **Task 2.3**.

---

## 1. Purpose

Menetapkan model kepemilikan data dan draft RLS sebelum tabel core dibuat, agar:

- user hanya mengakses proyek miliknya,
- child tables selalu terikat `project_id` → `projects.owner_id`,
- canon safety (`facts` vs `ai_proposals`) terjaga di layer DB + API,
- service role tidak bocor ke browser.

---

## A. Sprint 2 Tables Covered

### Core 9 tables (Task 2.3 migration)

| # | Table | Responsibility |
|---|---|---|
| 1 | `profiles` | Profil penulis; `id` = `auth.users.id` |
| 2 | `projects` | Workspace serial; `owner_id` → profiles |
| 3 | `project_settings` | Hemat/Seimbang/Terbaik, format, gaya output |
| 4 | `story_foundations` | Fondasi cerita per project (1:1) |
| 5 | `characters` | Registry tokoh canon |
| 6 | `facts` | **Hanya fakta confirmed/sah** |
| 7 | `relationship_speech_rules` | Panggilan & gaya bicara |
| 8 | `ai_proposals` | Antrian saran sebelum masuk canon |
| 9 | `credit_balances` | Saldo display (bukan ledger) |

### Recommended 10th table — `audit_logs`

**Keputusan Task 2.2:** **Ya** — tambahkan `audit_logs` ringan di Task 2.3 migration.

Alasan:

- Sprint 2 mulai persistence canon; perlu jejak siapa mengubah apa tanpa `generation_logs` / `validation_logs` / `credits_ledger`.
- Mendukung foundation lock, accept/reject proposal, dan review keamanan tanpa menyimpan payload AI penuh di log.

**Bukan Sprint 2:** `generation_logs`, `validation_logs`, `credits_ledger`, `chapters`, `prose_versions`, `reveals`, `beat_contracts`.

---

## B. Ownership Model

### Identitas

```txt
profiles.id = auth.uid()
```

- Satu baris profil per user auth.
- INSERT profil: trigger on `auth.users` insert atau API sync pertama login (Task 2.6).

### Project ownership

```txt
projects.owner_id = auth.uid()
```

- User hanya boleh SELECT/UPDATE/DELETE project yang `owner_id` cocok dengan JWT `sub`.
- Satu user boleh punya banyak project; `is_active` enforced di app layer (partial unique optional di 2.3).

### Child table inheritance

Semua tabel berikut punya `project_id` FK → `projects.id`:

- `project_settings`
- `story_foundations`
- `characters`
- `facts`
- `relationship_speech_rules`
- `ai_proposals`

**Aturan akses child:**

```txt
EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = <child>.project_id
    AND p.owner_id = auth.uid()
)
```

User **tidak boleh** membaca atau menulis baris child milik project user lain — bahkan jika mereka menebak `project_id` UUID.

### Credit balance

```txt
credit_balances.user_id = auth.uid()
```

Terkait profil, bukan project — satu baris per user.

### Audit logs

```txt
audit_logs.user_id = auth.uid()   -- actor
audit_logs.project_id nullable    -- jika event terkait project
```

User hanya SELECT audit untuk event yang mereka lakukan atau project mereka own (policy detail di section C).

### Role matrix (ringkas)

| Actor | profiles | projects | child tables | credit_balances | audit_logs |
|---|---|---|---|---|---|
| Authenticated owner | own row | own rows | via project ownership | own row | own + own projects |
| Authenticated other user | own row only | denied | denied | own row only | denied cross-user |
| anon / public | denied | denied | denied | denied | denied |
| service_role (API server) | bypass RLS | bypass RLS | bypass RLS | bypass RLS | INSERT + SELECT all |

**Prinsip:** Browser client memakai `anon` + user JWT. **Service role hanya di `apps/api` dan script admin** — never in `apps/web`.

---

## C. RLS Policy Draft Per Table

Notasi: pseudocode rencana. SQL final di Task 2.3 migration + komentar RLS.

Helper function (direncanakan di 2.3):

```sql
-- PLAN: is_project_owner(project_id uuid) RETURNS boolean
--   SELECT projects.owner_id = auth.uid() WHERE projects.id = project_id
```

---

### C.1 `profiles`

| Op | Policy draft |
|---|---|
| **SELECT** | `auth.uid() = id` — user hanya baca profil sendiri |
| **INSERT** | `auth.uid() = id` — atau hanya via trigger/service role on signup |
| **UPDATE** | `auth.uid() = id` — field terbatas: `display_name`, `default_language`; `email` mirror read-only dari auth |
| **DELETE** | denied untuk authenticated user (soft-delete account = future) |

---

### C.2 `projects`

| Op | Policy draft |
|---|---|
| **SELECT** | `owner_id = auth.uid()` |
| **INSERT** | `owner_id = auth.uid()` AND `owner_id` tidak boleh di-set ke user lain |
| **UPDATE** | `owner_id = auth.uid()` — tidak boleh mengubah `owner_id` ke user lain (WITH CHECK sama) |
| **DELETE** | `owner_id = auth.uid()` — hard delete atau soft delete via `deleted_at` (keputusan 2.3) |

Index direncanakan: `projects(owner_id)`, `projects(owner_id, is_active)`.

---

### C.3 `project_settings`

| Op | Policy draft |
|---|---|
| **SELECT** | `is_project_owner(project_id)` |
| **INSERT** | `is_project_owner(project_id)` — biasanya dibuat bersama project create (API transaction) |
| **UPDATE** | `is_project_owner(project_id)` — `quality_tier` CHECK: `hemat`, `seimbang`, `terbaik` only |
| **DELETE** | denied — settings hidup seumur project; hapus ikut cascade project delete |

---

### C.4 `story_foundations`

| Op | Policy draft |
|---|---|
| **SELECT** | `is_project_owner(project_id)` |
| **INSERT** | `is_project_owner(project_id)` |
| **UPDATE** | `is_project_owner(project_id)` AND jika `is_locked = true` → reject field inti kecuali unlock flow (enforced API + optional DB trigger) |
| **DELETE** | denied — foundation tidak dihapus terpisah di Sprint 2 |

---

### C.5 `characters`

| Op | Policy draft |
|---|---|
| **SELECT** | `is_project_owner(project_id)` |
| **INSERT** | `is_project_owner(project_id)` AND `source IN ('user', 'system_seed', 'accepted_proposal')` |
| **UPDATE** | `is_project_owner(project_id)` |
| **DELETE** | `is_project_owner(project_id)` — atau archive via `status` (prefer update di Sprint 2) |

**Catatan:** INSERT dari `accepted_proposal` idealnya hanya lewat service role saat API accept proposal.

---

### C.6 `facts` (canon confirmed only)

| Op | Policy draft |
|---|---|
| **SELECT** | `is_project_owner(project_id)` |
| **INSERT** | `is_project_owner(project_id)` AND `source IN ('user', 'system', 'accepted_proposal', 'imported_draft')` AND **`source` MUST NOT be any `ai_*` value** |
| **UPDATE** | `is_project_owner(project_id)` AND `source` tidak boleh diubah menjadi AI raw |
| **DELETE** | denied — gunakan `canon_status = deprecated` atau flag (align `FACT_CANON_STATUSES`) |

**Larangan keras di policy + CHECK constraint (2.3):**

```txt
❌ source = 'ai_proposal' | 'ai_chat' | 'ai_raw' — TIDAK BOLEH ada di facts
```

Direct INSERT `facts` dari browser untuk `source = user` boleh di RLS, tetapi **rekomendasi Task 2.9+**: canon writes penting lewat API agar validasi proposal/audit konsisten.

---

### C.7 `relationship_speech_rules`

| Op | Policy draft |
|---|---|
| **SELECT** | `is_project_owner(project_id)` |
| **INSERT** | `is_project_owner(project_id)` AND `source IN ('user', 'accepted_proposal')` |
| **UPDATE** | `is_project_owner(project_id)` |
| **DELETE** | `is_project_owner(project_id)` — atau deprecate via `status` |

---

### C.8 `ai_proposals`

| Op | Policy draft |
|---|---|
| **SELECT** | `is_project_owner(project_id)` |
| **INSERT** | `is_project_owner(project_id)` AND `status = 'proposed'` on create (manual seed Sprint 2) |
| **UPDATE** | `is_project_owner(project_id)` — status transition validated di API: `proposed → accepted|rejected|merged` only |
| **DELETE** | denied — retain history; use `rejected` status |

**Status minimum (align `@vibenovel/shared`):**

```txt
proposed | accepted | rejected | merged
```

**Accept flow:** tidak cukup UPDATE proposal saja — API transaction harus:

1. UPDATE `ai_proposals.status = accepted`
2. INSERT ke `facts` / `characters` / `relationship_speech_rules` sesuai `proposal_type`
3. SET `result_*_id`, `accepted_from_proposal_id`
4. INSERT `audit_logs`

RLS untuk authenticated user boleh UPDATE proposal, tetapi **promosi canon direkomendasikan service role via API** untuk atomicity.

---

### C.9 `credit_balances`

| Op | Policy draft |
|---|---|
| **SELECT** | `user_id = auth.uid()` |
| **INSERT** | denied untuk authenticated — seed via service role / migration only |
| **UPDATE** | denied untuk authenticated — Sprint 2 display-only; no deduction endpoint |
| **DELETE** | denied |

---

### C.10 `audit_logs` (recommended Sprint 2)

| Op | Policy draft |
|---|---|
| **SELECT** | `user_id = auth.uid()` OR `is_project_owner(project_id)` when `project_id` not null |
| **INSERT** | denied untuk authenticated client — **service role / API only** |
| **UPDATE** | denied — append-only |
| **DELETE** | denied |

**Kolom direncanakan (ringan):**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | Actor (`auth.uid()`) |
| `project_id` | uuid FK nullable | Context project |
| `event_type` | text | Lihat daftar event di section E |
| `entity_type` | text nullable | e.g. `fact`, `ai_proposal` |
| `entity_id` | uuid nullable | |
| `metadata` | jsonb | **Tanpa secret** — no tokens, no full AI payload |
| `created_at` | timestamptz | |

---

## D. Canon Guardrails

### Hierarki kebenaran

```txt
Canonical Story State = facts + characters + story_foundations (locked fields)
                     + relationship_speech_rules (accepted)
AI is NOT the source of truth.
```

### Jalur fakta

```txt
1. AI/sistem menghasilkan saran → INSERT ai_proposals (status: proposed)
2. User review (UI Sprint 3; API Sprint 2.11)
3. User accept → API transaction promotes to facts/characters/rules
4. User reject → status = rejected; NO write to facts
5. User merge → status = merged; payload digabung ke proposal target
```

### Larangan

```txt
❌ INSERT langsung ke facts dari AI generation
❌ UPDATE facts dari chat output tanpa proposal
❌ Menyimpan "proposed fact" di facts — gunakan ai_proposals saja
❌ Frontend menulis canon langsung ke Supabase tanpa API (rekomendasi keras)
```

### Proposal status & types

Align `packages/shared`:

- Status: `proposed`, `accepted`, `rejected`, `merged`
- Types (minimum): `character`, `fact`, `relationship_speech_rule`, `secret`, `reveal`, `style`, `foundation`, `chapter_delta` (last two reserved/deferred usage)

High-risk categories (`HIGH_RISK_FACT_CATEGORIES` di shared) → `risk_level = high` di proposal.

### Menerima proposal

Harus melalui **API/service layer** (service role + transaction), bukan:

- client-side sequential Supabase calls dari browser,
- direct INSERT `facts` tanpa update proposal,
- bypass audit log.

---

## E. Audit Logs Decision

### Keputusan: **Ya — `audit_logs` di Task 2.3**

Tabel ringan, append-only, tanpa menyimpan secret atau full model output.

### Event types (Sprint 2 minimum)

| `event_type` | Trigger context |
|---|---|
| `project_created` | POST /projects |
| `project_updated` | PATCH /projects |
| `settings_updated` | PUT /projects/:id/settings |
| `foundation_created` | PUT foundation first save |
| `foundation_updated` | PUT foundation |
| `foundation_locked` | POST foundation/lock |
| `character_created` | POST character |
| `character_updated` | PATCH character |
| `fact_created` | POST fact (source user/system) |
| `fact_updated` | PATCH fact |
| `fact_deprecated` | soft-remove canon fact |
| `speech_rule_created` | POST speech-rules |
| `speech_rule_updated` | PATCH speech-rules |
| `ai_proposal_created` | POST proposal |
| `ai_proposal_accepted` | accept + canon promote |
| `ai_proposal_rejected` | reject |
| `ai_proposal_merged` | merge |
| `credit_balance_seeded` | seed script / admin |

### Explicitly NOT in Sprint 2 audit

```txt
generation_logs
validation_logs
credit_ledger entries
openrouter_request_logs
```

### Metadata rules for `audit_logs.metadata`

- Boleh: entity ids, field names changed, proposal_type, risk_level
- Tidak boleh: API keys, JWT, passwords, full `payload` AI proposal, env values

---

## F. Security Notes

| Rule | Detail |
|---|---|
| No `.env` in git | Sudah di `.gitignore`; gunakan `.env.example` dengan nama variabel saja |
| No service role in client | `SUPABASE_SERVICE_ROLE_KEY` hanya `apps/api`, seed CLI, CI terisolasi |
| No JWT secret in repo | Supabase managed; jangan copy ke docs/logs |
| No OpenRouter key in DB/RLS docs | Routing Sprint 3+ di server env |
| Anon key scope | Client boleh read own data via RLS; **tidak** bypass canon writes |
| Domain mutation | `facts`, accept proposal, foundation lock → **API service layer** |
| Audit log hygiene | Jangan log secret atau raw prompts |

---

## G. Migration Boundary

| Task | Scope | Apply? |
|---|---|---|
| **2.2 (ini)** | Folder `supabase/`, `config.toml`, RLS draft doc | Tidak ada migration SQL |
| **2.3** | `migrations/00001_sprint2_core.sql` — 9 tabel + `audit_logs`, enums, RLS SQL, helper functions | Local `supabase db reset` setelah review |
| **2.3** | Harus align enum dengan `packages/shared/src/enums.ts` | CHECK constraints atau Postgres ENUM |
| **Remote** | `supabase db push` / hosted | **Hanya setelah approval user** — tidak otomatis di 2.3 |

Task 2.2 **tidak** membuat file `00001_sprint2_core.sql`. Folder `migrations/` hanya placeholder (`.gitkeep`).

---

## H. Risks & Mitigations

| Risk | Impact | Mitigation (draft) |
|---|---|---|
| RLS terlalu longgar | User A reads User B projects | `owner_id = auth.uid()` on projects; child via `is_project_owner()` |
| Child table tanpa ownership check | Guess `project_id` → data leak | Semua child policies pakai EXISTS join ke `projects` |
| Frontend direct mutation | Bypass canon, no audit | Deny atau limit client INSERT on `facts`; API service role for accept flow; docs + code review |
| facts/proposals tercampur | AI canon tanpa approval | CHECK on `facts.source`; no `ai_*` sources; proposals queue mandatory |
| audit log berisi secret | Credential leak via logs | metadata schema guideline; API redaction; no service role in browser |
| service role bocor ke client | Full DB bypass | Env server-only; never import in `apps/web`; CI secret scanning |
| RLS + service role confusion | Agent uses wrong key | Document in `supabase/README.md` and API README (2.5) |
| Over-broad UPDATE on locked foundation | Canon drift | API reject + optional DB guard when `is_locked = true` |

---

## Appendix — Enum alignment checklist (Task 2.3)

Migration SQL harus mirror `@vibenovel/shared`:

| Domain | Shared const | Postgres approach |
|---|---|---|
| Project status | `PROJECT_STATUSES` | CHECK or ENUM |
| Quality tier | `WRITER_QUALITY_MODES` | CHECK — only 3 values |
| Fact source | `FACT_SOURCES` | CHECK — no AI values |
| Fact category | `FACT_CATEGORIES` | CHECK or ENUM |
| Proposal status | `AI_PROPOSAL_STATUSES` | CHECK |
| Proposal type | `AI_PROPOSAL_TYPES` | CHECK |
| Proposal risk | `AI_PROPOSAL_RISK_LEVELS` | CHECK |
| Readiness | `FOUNDATION_READINESS_LEVELS` | CHECK |

---

## Appendix — Entity relationship (unchanged from doc 27)

```txt
profiles 1───* projects
projects 1───1 project_settings
projects 1───1 story_foundations
projects 1───* characters
projects 1───* facts
projects 1───* relationship_speech_rules
projects 1───* ai_proposals
profiles 1───1 credit_balances
profiles 1───* audit_logs (actor)
projects 1───* audit_logs (context)

ai_proposals ──(accept)──► facts | characters | relationship_speech_rules
facts.accepted_from_proposal_id ──► ai_proposals.id
```

---

*Task 2.2 selesai saat dokumen ini, `supabase/README.md`, dan `config.toml` ada; tanpa migration SQL final. Task 2.3: tulis migration mengikuti draft ini.*