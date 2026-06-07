# Task 2.4 — Seed Demo Project

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat seed dev/demo yang mencerminkan mock Sprint 1 ("Istri yang Mereka Buang") agar Sprint 2 berikutnya bisa menghubungkan dashboard/settings/foundation ke data nyata lokal. Tanpa API, auth UI, seed remote, atau perubahan frontend.

## Files read

- `supabase/migrations/00001_sprint2_core.sql`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/web/src/mocks/projects.ts`
- `apps/web/src/mocks/shell.ts`
- `apps/web/src/mocks/storyFoundation.ts`
- `apps/web/src/mocks/settings.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `supabase/seed.sql` | Created — idempotent demo seed |
| `supabase/config.toml` | Updated — `[db.seed]` enabled, `sql_paths = ["./seed.sql"]` |
| `supabase/README.md` | Updated — dokumentasi seed Task 2.4 |
| `.agent-logs/sprint-2/task-2.4-seed-demo-project.md` | Created (log ini) |

**Tidak diubah:** `apps/web`, `apps/api`, `packages/shared`, routes, UI.

## Commands run

| Command | Result |
|---|---|
| `docker desktop start` | PASS |
| `docker --version` | PASS — 29.5.2 |
| `supabase db reset` (pertama) | PASS — seed applied |
| `supabase db reset` (kedua, idempotent) | PASS |
| `supabase db query` (row counts) | PASS |
| `supabase db push` | tidak dijalankan |

## Seed data ringkasan

| Entity | Fixed UUID / nilai | Sumber mock |
|---|---|---|
| User/profile | `a0000000-...-000001`, `penulis@contoh.id` | `shell.ts`, `settings.ts` |
| Project | `a0000000-...-000101`, Istri yang Mereka Buang | `projects.ts` |
| Settings | quality `seimbang`, `warm_emotional`, `hp_kbm` | `settings.ts` |
| Foundation | premise, conflict, readiness 82% | `storyFoundation.ts` |
| Characters | 4 (Nadira, Arman, Bu Siti, Siska) | `storyFoundation.ts` |
| Facts | 4 confirmed, `is_locked=true`, source `system` | `lockedFacts` |
| Speech rule | Nadira ↔ Bu Siti | derived dari tokoh |
| AI proposal | 1 × `proposed`, `high` risk | canon guardrail demo |
| Credit balance | 1250, quota 1000, used 450 | `shell.ts`, `settings.ts` |
| Audit logs | project_created, foundation_created, credit_balance_seeded | Task 2.4 scope |

**Canon:** Fakta tentang hubungan Siska–Arman hanya di `ai_proposals` (proposed), tidak di `facts`.

## Verifikasi row count (post-reset)

| Table | Rows |
|---|---|
| profiles | 1 |
| projects | 1 |
| project_settings | 1 |
| story_foundations | 1 |
| characters | 4 |
| facts | 4 |
| relationship_speech_rules | 1 |
| ai_proposals (proposed) | 1 |
| credit_balances | 1 |
| audit_logs | 3 |

## Decisions

- Fixed UUID prefix `a0000000-0000-4000-8000-...` untuk repeatability.
- `auth.users` + `auth.identities` di-seed untuk memenuhi FK `profiles.id`.
- Password lokal hanya untuk dev seed — bukan production credential; tidak dicatat di README.
- `ON CONFLICT DO UPDATE` / `DO NOTHING` pada semua insert utama — idempotent setelah reset.
- Satu project demo saja (bukan `demo-project-002`) — cukup untuk Sprint 2 integrasi minimal.

## Limitations

- Mock route `demo-project-001` (string) belum dipetakan di frontend — UUID berbeda sampai Task 2.13.
- `auth.users` trigger on signup belum ada (Task 2.6).
- Seed tidak menulis ke remote Supabase.
- `monthly_used` hanya di `credit_balances`, bukan di `project_settings` (field tidak ada di schema).

## Next recommended task

**Task 2.5 — API scaffold (`apps/api`)** — health, env validation, error format, auth guard shell.