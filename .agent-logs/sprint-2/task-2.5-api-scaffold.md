# Task 2.5 — API Scaffold (`apps/api`)

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat scaffold backend `apps/api` untuk VibeNovel Sprint 2 dengan Hono/Cloudflare Worker TypeScript: env validation shell, health endpoint, error response format, CORS dasar, dan auth guard shell. Tanpa CRUD project/settings/foundation, tanpa auth UI, tanpa Supabase queries, tanpa deploy.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/README.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `packages/shared/src/api.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `.agents/rules/00-read-first.md`
- `.agents/rules/01-document-navigation-map.md`
- `.agents/rules/02-sprint-discipline.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/package.json` | Created — `@vibenovel/api`, Hono, Wrangler, shared dep |
| `apps/api/tsconfig.json` | Created — strict TS, Workers types |
| `apps/api/wrangler.toml` | Created — local dev port 8787, non-secret vars |
| `apps/api/.dev.vars.example` | Created — env template (no values) |
| `apps/api/README.md` | Created — local dev + endpoint docs |
| `apps/api/src/index.ts` | Created — Hono entry, CORS, routes, error handlers |
| `apps/api/src/env.ts` | Created — bindings types, safe env flags |
| `apps/api/src/errors.ts` | Created — `AppError`, global + 404 handlers |
| `apps/api/src/response.ts` | Created — `{ ok, data }` / `{ ok, error }` |
| `apps/api/src/types.ts` | Created — `AppEnv` (Bindings + Auth Variables) |
| `apps/api/src/middleware/cors.ts` | Created — `ALLOWED_ORIGINS` + dev defaults |
| `apps/api/src/middleware/auth.ts` | Created — Bearer shell, 401 if missing |
| `apps/api/src/routes/health.ts` | Created — `GET /health`, `GET /api/health` |
| `apps/api/src/routes/me.ts` | Created — `GET /api/me` auth shell |
| `apps/api/src/routes/index.ts` | Created — route registration |
| `apps/api/src/lib/supabase.ts` | Created — client factory shell (no queries) |
| `package.json` (root) | Updated — `dev:api`, `typecheck:api`, `build:api`, `typecheck` includes api |
| `package-lock.json` | Updated — workspace lockfile |
| `.gitignore` | Updated — `.dev.vars`, `.wrangler/` |
| `.agent-logs/sprint-2/task-2.5-api-scaffold.md` | Created (log ini) |

**Tidak diubah:** `apps/web`, routes UI, migrations, seed, Supabase config beyond ignore rules.

## Commands run

| Command | Result |
|---|---|
| `npm install` | PASS |
| `npm run typecheck:api` | PASS |
| `npm run typecheck` (shared + web + api) | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` (wrangler dry-run) | PASS |
| `npm run dev:api` | PASS — Ready on http://127.0.0.1:8787 |
| `Invoke-RestMethod GET /health` | PASS — `ok: true`, env flags only |
| `Invoke-RestMethod GET /api/health` | PASS — same as `/health` |
| `Invoke-WebRequest GET /api/me` (no token) | PASS — 401 `UNAUTHORIZED` |
| `Invoke-RestMethod GET /api/me` (Bearer placeholder) | PASS — 200, `profile: null` |
| `supabase db reset` | tidak dijalankan (Task 2.4 sudah approved) |
| Cloudflare deploy | tidak dijalankan (out of scope) |

## Results

- `apps/api` workspace package aktif dengan struktur minimal sesuai scope.
- Response format konsisten: success `{ ok: true, data }`, error `{ ok: false, error: { code, message } }`.
- `/health` hanya mengekspos boolean env flags, bukan nilai secret.
- Auth guard shell: Bearer required untuk `/api/me`; JWT validation dan profile fetch ditunda Task 2.6.
- Supabase client factory shell ada di `lib/supabase.ts` tanpa query production.
- Tidak ada secret di repo; `.dev.vars` dan `.wrangler/` di-ignore.

## Decisions

- **Hono + Wrangler 3.x** — sesuai rencana sprint; `wrangler deploy --dry-run` untuk `build:api`.
- **`AppEnv` terpusat** di `types.ts` — Bindings dari `env.ts`, Variables dari auth middleware.
- **`JsonValue` dari `@vibenovel/shared`** — untuk `details` pada error response.
- **CORS dev default** — localhost:5173–5175 dari `ALLOWED_ORIGINS` atau fallback di `env.ts`.
- **`/api/me` placeholder** — `userId: null`, `profile: null` sampai Task 2.6 validasi JWT + fetch profile.
- **Service role** — hanya dikenali di env flags; tidak pernah dikirim ke client.

## Limitations

- Tidak ada validasi JWT ke Supabase Auth.
- Tidak ada `@supabase/supabase-js` dependency atau query DB.
- Tidak ada CRUD project/settings/foundation.
- Tidak ada integrasi frontend ke API.
- Tidak ada Cloudflare remote deploy.
- Wrangler 3.x menampilkan warning upgrade ke v4 (tidak di-upgrade di Task 2.5).

## Next recommended task

**Task 2.6 — Auth shell:** register/login/logout routes, JWT validation via Supabase, `profiles` sync on first sign-in, `GET /api/me` dengan profile + credit balance; minimal web auth context tanpa redesign AppShell.