# supabase — Database & Migrations (Sprint 2+)

Folder ini menyimpan **schema Postgres**, migrasi, seed dev, dan konfigurasi Supabase CLI untuk VibeNovel Core v2.

## Tujuan

- Satu tempat canonical persistence: profiles, projects, story foundation, characters, facts, speech rules, AI proposals, credit display, audit logs.
- Migrasi versioned di `migrations/` — diterapkan hanya lewat workflow yang disetujui (Task 2.3+).
- RLS (Row Level Security) melindungi data per user; detail draft di [`docs/28-supabase-rls-policy-draft.md`](../docs/28-supabase-rls-policy-draft.md).

## Struktur folder

```txt
supabase/
  config.toml          # Konfigurasi local Supabase CLI (bukan secret)
  migrations/          # SQL migrasi berurutan (Task 2.3+)
  seed/                # Seed dev/demo (Task 2.4+)
  README.md            # File ini
```

## Cara migration akan dikelola

| Fase | Task | Apa yang dilakukan |
|---|---|---|
| **2.2** ✅ | Setup + RLS draft | `config.toml`, `docs/28` |
| **2.3** ✅ | Core migration | `migrations/00001_sprint2_core.sql` — 10 tabel, enums, RLS, triggers |
| **2.4** | Seed | `seed/` atau script — demo project dari mock Sprint 1 |
| **Apply local** | Setelah Supabase CLI + Docker | `supabase start` lalu `supabase db reset` |
| **Apply remote** | Manual / CI terpisah | **Tidak** tanpa approval eksplisit user |

### Migration `00001_sprint2_core.sql` (Task 2.3)

Membuat:

- **10 tabel:** `profiles`, `projects`, `project_settings`, `story_foundations`, `characters`, `facts`, `relationship_speech_rules`, `ai_proposals`, `credit_balances`, `audit_logs`
- **Enums** selaras `@vibenovel/shared` (+ `project_entry_path`, `character_importance`, `character_source`, `speech_rule_source`)
- **Helper:** `set_updated_at()`, `is_project_owner(uuid)`
- **RLS** enabled semua tabel; kebijakan mengikuti `docs/28`
- **Canon:** `facts` hanya `fact_source` enum (tanpa AI direct); `ai_proposals.status` default `proposed`

**Belum ada:** seed data, `auth.users` trigger profil (Task 2.6), tabel Sprint 4+.

Urutan disarankan:

1. Review `docs/28-supabase-rls-policy-draft.md`
2. Tulis/review migration di `migrations/`
3. Test lokal dengan Supabase CLI
4. Seed dev
5. Hubungkan `apps/api` (Sprint 2.5+) — canon writes lewat API, bukan client direct ke tabel sensitif

## Sprint 2 — belum menjalankan remote migration

Task 2.2 **tidak**:

- menjalankan `supabase link` ke project remote,
- menjalankan `supabase db push` ke hosted Supabase,
- menyimpan URL/key production di repo.

Remote setup (project Supabase hosted, env di mesin dev) dilakukan manusia developer di luar scope agent Task 2.2.

## Environment variables (referensi nama saja)

Variabel yang akan dipakai nanti (nilai **tidak** disimpan di repo):

| Variable | Konsumen | Catatan |
|---|---|---|
| `SUPABASE_URL` | `apps/api`, optional web anon | Public project URL |
| `SUPABASE_ANON_KEY` | `apps/web` (read terbatas) | Bukan service role |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/api`, seed scripts | **Server only** — jangan di frontend |
| `DATABASE_URL` | migrasi lokal / CI | Connection string Postgres |

Gunakan `.env` lokal (di-`.gitignore`). Contoh nama variabel boleh ada di docs; **jangan commit nilai**.

## Larangan

- Jangan commit `.env`, service role key, JWT secret, atau OpenRouter key.
- Jangan taruh service role di `apps/web` atau bundle browser.
- Jangan edit migration yang sudah applied di shared environment tanpa strategi rollback.
- Jangan buat tabel Sprint 4+ (chapters, prose_versions, credits_ledger) di migrasi Sprint 2.
- Jangan INSERT AI output langsung ke `facts` — lihat canon rule di doc 28.

## Dokumen terkait

- [`docs/27-sprint-2-data-model-implementation-plan.md`](../docs/27-sprint-2-data-model-implementation-plan.md) — 9 tabel + task breakdown
- [`docs/28-supabase-rls-policy-draft.md`](../docs/28-supabase-rls-policy-draft.md) — RLS draft Sprint 2
- [`packages/shared`](../packages/shared/) — enums/types domain