# Sprint 3 Web Smoke — Manual API-Mode Checklist

Use when automated API-mode Playwright is **not run** or fails (e.g. `VITE_USE_MOCKS` still `true`, Supabase offline, DevAuth not visible).

**Do not claim PASS** unless every checked step was actually performed in the browser.

## Prerequisites

1. Docker Desktop + `supabase start` + `supabase db reset`
2. `apps/api/.dev.vars` from `.dev.vars.example` (values from `supabase status` — never commit)
3. `apps/web/.env.local` from `.env.example`:
   - `VITE_USE_MOCKS=false`
   - `VITE_API_URL=http://127.0.0.1:8787`
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from `supabase status`
4. Restart after env changes:
   - Terminal A: `npm run dev:api`
   - Terminal B: `npm run dev:web`
5. Optional: `npm run smoke:api` PASS confirms API layer

## Mock mode (quick, no login)

With `VITE_USE_MOCKS=true` and `npm run dev:web`:

| Step | URL | Expect |
|---|---|---|
| 1 | `/projects/demo-project-001/intake` | "Mari Bangun Ceritamu", chat bubbles, signals panel |
| 2 | `/projects/demo-project-001/concepts` | "Pilih Arah Ceritamu", 3 concept cards |
| 3 | `/projects/demo-project-001/foundation` | "Fondasi Cerita", readiness card, premise visible |

Automated: `npm run smoke:web` (mock Playwright).

## API mode (full flow)

With `VITE_USE_MOCKS=false` and servers running:

| # | Action | Expect |
|---|---|---|
| 1 | Open any page; click **Dev Auth** (bottom-right) | Panel opens |
| 2 | Sign up via Supabase (or use test user from `smoke:api`) + **Masuk** | "Masuk: email@..." shown |
| 3 | Create project via API or use active project from dashboard | Project UUID known |
| 4 | `/projects/{id}/intake` | Chat loads from API (not only mock notice) |
| 5 | Send intake message | User bubble + agent stub reply |
| 6 | Signals panel | At least one signal after extract (or on reload) |
| 7 | `/projects/{id}/concepts` | **Buat 3 Konsep Cerita** → 3 cards |
| 8 | **Pilih Konsep Ini** on one card | "Dipilih" badge |
| 9 | `/projects/{id}/foundation` | Readiness + **Buat Usulan Fondasi** |
| 10 | Accept safe proposals (**Terima Usulan**) | Status "Diterima" |
| 11 | **Kunci Fondasi & Lanjut ke Outline** | Lock success OR clear missing-items message |

Automated (when stack ready): `npm run smoke:web -- -IncludeApiMode`

## Known limitations

- DevAuthPanel only in `import.meta.env.DEV` — not production builds
- No sign-up button in DevAuth — signup via Supabase Auth API or separate tool first
- API-mode automation needs **fresh** project per run to avoid lock/idempotency conflicts
- GitHub Actions CI: web E2E **deferred** (browser + Supabase + env split)

## Related

- [`scripts/sprint3-smoke-web.ps1`](sprint3-smoke-web.ps1)
- [`scripts/README.md`](README.md)
- [`docs/31-sprint-3-verification-report.md`](../docs/31-sprint-3-verification-report.md)