# Task 2.6 — Auth Shell + Profiles

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat auth shell Sprint 2: Supabase JWT validation di API, profile sync on first `/api/me`, credit balance read, minimal web AuthContext — tanpa CRUD, tanpa auth custom/password storage, tanpa UI redesign.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/seed.sql`
- `apps/api/README.md`
- `apps/api/src/env.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/routes/me.ts`
- `apps/api/src/lib/supabase.ts`
- `packages/shared/src/api.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/package.json` | Added `@supabase/supabase-js` |
| `apps/api/src/lib/supabase.ts` | Real anon + service role clients |
| `apps/api/src/lib/mappers.ts` | Created — DB row → shared types |
| `apps/api/src/services/profile.ts` | Created — `getOrCreateProfileForAuthUser` |
| `apps/api/src/services/credit.ts` | Created — read-only `getCreditBalanceForUser` |
| `apps/api/src/middleware/auth.ts` | JWT validation via `auth.getUser(token)` |
| `apps/api/src/routes/me.ts` | Full `/api/me` response |
| `apps/api/src/env.ts` | `assertAuthBindings` (URL + anon + service role) |
| `apps/api/src/errors.ts` | `AppError.serviceUnavailable` |
| `apps/api/.dev.vars.example` | Updated with local URL placeholders |
| `apps/api/README.md` | Task 2.6 auth approach + endpoints |
| `apps/web/package.json` | Added `@supabase/supabase-js` |
| `apps/web/src/lib/supabase.ts` | Browser anon client |
| `apps/web/src/context/AuthContext.tsx` | Minimal session + signIn/signUp/signOut |
| `apps/web/src/App.tsx` | Wrapped with `AuthProvider` |
| `apps/web/.env.example` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `apps/web/src/vite-env.d.ts` | Vite env types |
| `package-lock.json` | Lockfile update |
| `.agent-logs/sprint-2/task-2.6-auth-shell-profiles.md` | Created (log ini) |

**Tidak diubah:** migrations, seed, UI routes/AppShell, project CRUD, settings/foundation API.

**Tidak di-commit:** `apps/api/.dev.vars` (local test only, gitignored).

## Commands run

| Command | Result |
|---|---|
| `npm install` | PASS |
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run dev:api` | PASS |
| `GET /health` | PASS — env flags true dengan `.dev.vars` |
| `GET /api/me` tanpa token | PASS — 401 `UNAUTHORIZED` |
| `GET /api/me` invalid JWT | PASS — 401 `UNAUTHORIZED` |
| `GET /api/me` valid JWT (admin-created test user) | PASS — profile synced, creditBalance null |
| `supabase db reset` | PASS (untuk auth test lokal) |
| Seed user `penulis@contoh.id` password login | FAIL — GoTrue "Database error" (seed SQL direct insert) |
| `git push` / Cloudflare deploy | tidak dijalankan |

## Results

- Auth middleware memvalidasi Bearer JWT ke Supabase Auth (`getUser`).
- `/api/me` mengembalikan `{ user, profile, creditBalance }` format standar.
- `getOrCreateProfileForAuthUser` membuat profile baru (role writer, plan free) jika belum ada.
- Credit balance read-only; null jika tidak ada row.
- Service role hanya di server; tidak di response/log/health.
- Web: `AuthProvider` + Supabase browser client (anon key only); routes tidak di-protect.
- Tidak ada `POST /api/auth/*` — auth via Supabase client di browser (sesuai preferensi task).

## Decisions

- **Supabase Auth sebagai identity source** — tidak ada custom password auth di API.
- **Service role untuk profile sync + credit read** — filter eksplisit `user.id` dari JWT yang sudah divalidasi.
- **Auth context di web minimal** — wrap `App`, tidak redesign AppShell, tidak protect routes.
- **Auth endpoints API ditunda** — frontend memakai `supabase.auth.signInWithPassword` / `signUp` / `signOut`.
- **Seed demo user password login** — gagal via GoTrue (direct `auth.users` insert); authenticated flow diverifikasi dengan user admin-created.

## Limitations

- Seed user `penulis@contoh.id` tidak bisa login via password GoTrue setelah SQL seed (known local Supabase quirk).
- `creditBalance` untuk user baru null (belum auto-seed credit row).
- Tidak ada route protection di web; dashboard masih mock data.
- Tidak ada `POST /api/auth/register|login|logout`.
- Wrangler 3.x upgrade warning masih ada.

## Next recommended task

**Task 2.7 — Project persistence API:** CRUD `projects`, owner-only RLS, dashboard list real projects.