# Task 2.13 — Web Integration Minimal

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Menghubungkan dashboard, settings, dan foundation ke API Sprint 2 secara minimal dengan fallback mock Sprint 1. Tanpa redesign UI, tanpa AI generation, tanpa route protection penuh.

## Files read

- `README.md`
- `docs/22-sprint-1-verification-report.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `apps/api/README.md`
- `apps/api/src/routes/projects.ts`
- `apps/api/src/routes/project-settings.ts`
- `apps/api/src/routes/foundation.ts`
- `apps/api/src/routes/characters.ts`
- `apps/api/src/routes/facts.ts`
- `apps/api/src/routes/credits.ts`
- `apps/web/src/context/AuthContext.tsx`
- `apps/web/src/lib/supabase.ts`
- `apps/web/src/pages/DashboardPage.tsx`
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/pages/FoundationPage.tsx`
- `apps/web/src/mocks/index.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/api.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/web/src/lib/env.ts` | Created — `VITE_USE_MOCKS`, API base URL |
| `apps/web/src/lib/api.ts` | Created — fetch client + error parsing |
| `apps/web/src/lib/api-mappers.ts` | Created — API → UI shape mappers |
| `apps/web/src/services/projects.ts` | Created |
| `apps/web/src/services/credits.ts` | Created |
| `apps/web/src/services/settings.ts` | Created |
| `apps/web/src/services/foundation.ts` | Created |
| `apps/web/src/services/me.ts` | Created |
| `apps/web/src/hooks/useDashboardData.ts` | Created |
| `apps/web/src/hooks/useSettingsData.ts` | Created |
| `apps/web/src/hooks/useFoundationData.ts` | Created |
| `apps/web/src/components/common/IntegrationNotice.tsx` | Created — subtle fallback note |
| `apps/web/src/components/dev/DevAuthPanel.tsx` | Created — dev-only login helper |
| `apps/web/src/pages/DashboardPage.tsx` | API integration + fallback |
| `apps/web/src/pages/SettingsPage.tsx` | GET/PUT settings integration |
| `apps/web/src/pages/FoundationPage.tsx` | GET foundation bundle integration |
| `apps/web/src/components/dashboard/DashboardGreeting.tsx` | Accept usage prop |
| `apps/web/src/App.tsx` | Mount DevAuthPanel (dev + API mode) |
| `apps/web/.env.example` | `VITE_API_URL`, `VITE_USE_MOCKS` |
| `apps/web/src/vite-env.d.ts` | New env types |
| `apps/web/package.json` | Add `@vibenovel/shared` |
| `README.md` | Web+API run notes |
| `.agent-logs/sprint-2/task-2.13-web-integration-minimal.md` | Created (log ini) |

**Tidak diubah:** route map, mock files, API backend, migrations, outline/chapter/prose pages, auth UI besar, route protection.

## Commands run

| Command | Result |
|---|---|
| `npm install` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| API: signup + create project + GET settings | PASS — default `seimbang` |
| API: PUT `qualityMode: terbaik` | PASS |
| API: GET foundation (new project) | PASS — default row `readinessPercent: 0` |
| API: GET credits (new user) | PASS — `creditBalance: null` |
| API down (port 9797) | PASS — network timeout (client fallback path) |
| `git push` / deploy | tidak dijalankan |

## Results

- API client: Bearer dari Supabase session, parse `{ ok, data/error }`, no token logging.
- `VITE_USE_MOCKS=true` (default): dashboard/settings/foundation tetap mock — UI tidak pecah.
- `VITE_USE_MOCKS=false` + login: dashboard list project aktif, credit usage, settings GET/PUT quality mode, foundation GET bundle.
- API error / no session / no project → fallback mock + `IntegrationNotice` kecil.
- `demo-project-001` route ID di-resolve ke active API project saat API mode.
- DevAuthPanel hanya `import.meta.env.DEV` + `VITE_USE_MOCKS=false`.

## Decisions

1. **Default `VITE_USE_MOCKS=true`** — UI aman jika API offline (preferensi user).
2. **Hooks + services layer** — tidak fetch langsung di komponen besar; tanpa React Query.
3. **Settings save minimal** — PUT hanya `qualityMode` di Task 2.13; preferensi lain read-only dari API.
4. **Foundation partial API** — `secretSchedule` tetap dari mock (belum ada di API); characters/facts/foundation fields dari API.
5. **Tidak protect routes** — AuthProvider + optional DevAuthPanel cukup untuk local test.
6. **`@vibenovel/shared` di web** — types konsisten dengan API domain.

## Limitations

- Hanya 3 halaman terintegrasi (dashboard, settings, foundation); route lain masih mock.
- Seed user `penulis@contoh.id` tidak bisa login GoTrue — test API mode via signup user baru.
- User baru tanpa proyek → fallback mock dengan notice.
- Credit balance null untuk user baru → usage/credit card fallback mock values.
- Settings writer preferences belum editable via API di Task 2.13.
- Foundation edit/lock UI belum dihubungkan ke PUT API.
- DevAuthPanel tidak muncul di production build (`import.meta.env.DEV`).

## Next recommended task

**Task 2.14 — Integration tests / sprint verification** (atau per `docs/27`): API integration tests untuk CRUD inti, smoke test web+API mode, sprint closure report — tanpa scope AI atau redesign.