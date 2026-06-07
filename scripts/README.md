# scripts — Developer & Smoke Test Helpers

Operational scripts for local verification and future CI helpers. **Not** runtime application code.

## Sprint 2 smoke test (Task 2.15)

### `sprint2-smoke-api.ps1`

Windows-first PowerShell script that exercises the Sprint 2 API surface against a **local** API Worker and Supabase Auth.

**Platform:** Windows / PowerShell 5.1+ (primary). Linux/macOS agents can run equivalent steps manually or via Task 2.15+ bash port later.

### Prerequisites

1. **Docker Desktop** running
2. **Supabase CLI** installed and on `PATH`
3. **Node.js 18+** and `npm install` from repo root
4. Local database ready:

   ```bash
   supabase start
   supabase db reset
   ```

5. API dev server running (separate terminal):

   ```bash
   npm run dev:api
   ```

   Default: http://127.0.0.1:8787

6. API env configured: copy `apps/api/.dev.vars.example` → `apps/api/.dev.vars` (gitignored). Values from `supabase status` — **never commit**.

7. **Supabase anon key** for signup (one of):
   - `SUPABASE_ANON_KEY` environment variable, or
   - `supabase status -o env` (script auto-detects from repo root), or
   - `-SupabaseAnonKey` parameter

   Do **not** commit anon/service keys to the repo.

### Run from repo root

```bash
npm run smoke:api
```

Or directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sprint2-smoke-api.ps1
```

Optional parameters:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sprint2-smoke-api.ps1 `
  -ApiBaseUrl "http://127.0.0.1:8787" `
  -SupabaseUrl "http://127.0.0.1:54321" `
  -TestEmail "my-smoke@example.com"
```

### What is tested

| Step | Endpoint / behavior |
|---|---|
| Health | `GET /health` |
| Auth guard | `GET /api/me` without token → 401 |
| Signup | Supabase Auth signup + JWT |
| Projects | `GET` / `POST /api/projects` |
| Settings | `GET` / `PUT .../settings` (`qualityMode: terbaik`) |
| Foundation | `GET` / `PUT .../foundation` |
| Characters | `POST .../characters` (source: user) |
| Facts | `POST` user OK; `POST ai_direct` → 400 |
| Speech rules | `POST` user OK; `POST ai_direct` → 400 |
| Proposals | `POST` high-risk → `proposed`; accept → `accepted` (status only) |
| Credits | `GET /api/credits/balance` |
| Ownership | Cross-user seed project → 404 |

### Output

- One line per step: `[PASS]` or `[FAIL]` with safe detail (no full JWT)
- Summary table at end
- **Exit code 0** = all steps PASS; **exit code 1** = at least one FAIL

### Known limitations

- Requires **local** Supabase + API — not run in GitHub Actions CI yet (no Docker/Supabase service in basic workflow)
- Windows-first (`npm run smoke:api` uses PowerShell)
- Creates ephemeral auth user + project each run (no cleanup)
- Does not test web UI (`apps/web`) — API only
- Seed demo user `penulis@contoh.id` password login not used (GoTrue SQL seed quirk)
- Does not verify proposal auto-promotion to canon (intentionally status-only in Sprint 2)

### Related docs

- [`docs/29-sprint-2-verification-report.md`](../docs/29-sprint-2-verification-report.md)
- [`apps/api/README.md`](../apps/api/README.md)
- [`supabase/README.md`](../supabase/README.md)

## Future scripts (not yet implemented)

```txt
scripts/check-stitch-parity.ts
scripts/typegen-from-schema.ts
```

## Sprint 3 web E2E smoke (Task 3.8)

### `sprint3-smoke-web.ps1`

Lightweight Playwright browser smoke for Sprint 3 UI flow: **intake → concepts → foundation**.

**Platform:** Windows / PowerShell 5.1+ (primary). Playwright tests live in `apps/web/e2e/sprint3-flow.spec.ts`.

### Prerequisites — mock mode (default)

1. **Node.js 18+** and `npm install` from repo root (installs `@playwright/test` in `apps/web`)
2. **Playwright browser** (first run only):

   ```bash
   cd apps/web
   npx playwright install chromium
   ```

3. Web env: copy `apps/web/.env.example` → `apps/web/.env.local`
   - `VITE_USE_MOCKS=true` (default — mock Sprint 1 UI)
   - `VITE_API_URL=http://127.0.0.1:8787` (optional in mock mode)

4. Web dev server (separate terminal):

   ```bash
   npm run dev:web
   ```

   Default: http://localhost:5173

### Prerequisites — API mode (optional `-IncludeApiMode`)

All mock prerequisites, plus:

1. Docker + `supabase start` + `supabase db reset`
2. `apps/api/.dev.vars` configured (from `supabase status` — never commit)
3. `npm run dev:api` → http://127.0.0.1:8787
4. `apps/web/.env.local`:
   - `VITE_USE_MOCKS=false`
   - `VITE_SUPABASE_URL=http://127.0.0.1:54321`
   - `VITE_SUPABASE_ANON_KEY` from `supabase status`
   - `VITE_API_URL=http://127.0.0.1:8787`
5. **Restart** `dev:web` after changing `.env.local` (Vite bakes env at startup)

### Run from repo root

```bash
# Mock mode only (3 pages render, no login)
npm run smoke:web

# Mock + API-mode full flow (DevAuthPanel + proposals + lock)
npm run smoke:web -- -IncludeApiMode
```

Or directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sprint3-smoke-web.ps1
powershell -ExecutionPolicy Bypass -File scripts/sprint3-smoke-web.ps1 -IncludeApiMode
```

Playwright only (web server must already be running):

```bash
npm run test:e2e:sprint3 -w @vibenovel/web
```

### What is tested

| Mode | Coverage |
|---|---|
| **Mock** (`VITE_USE_MOCKS=true`) | `/projects/demo-project-001/intake`, `/concepts`, `/foundation` — page not blank; mock markers visible |
| **API** (`-IncludeApiMode`) | Signup via script → DevAuth login → intake message + agent stub → generate/select concept → foundation proposals → accept safe → lock or missing checks |

### Output

- `[PASS]` / `[FAIL]` / `[NOT RUN]` per step
- Playwright list reporter in terminal
- **Exit code 0** = no FAIL steps; API mode may show `NOT RUN` when `-IncludeApiMode` omitted

### Manual fallback

If API-mode automation cannot run: [`sprint3-smoke-web-manual-checklist.md`](sprint3-smoke-web-manual-checklist.md)

**Do not claim API-mode PASS** without running `-IncludeApiMode` or completing the manual checklist.

### Known limitations

- Requires **local** web dev server — not in GitHub Actions CI yet (browser + Supabase + dual `VITE_USE_MOCKS` env)
- Windows-first `npm run smoke:web` uses PowerShell
- API mode needs fresh ephemeral user/project per run (script creates via Supabase + API)
- DevAuthPanel dev-only; no production E2E
- Mock and API modes need different `VITE_USE_MOCKS` — restart `dev:web` when switching
- Does not test outline/write/summary/publish pages (Sprint 3 scope only)

### Related docs

- [`docs/31-sprint-3-verification-report.md`](../docs/31-sprint-3-verification-report.md)
- [`docs/30-sprint-3-story-foundation-flow-implementation-plan.md`](../docs/30-sprint-3-story-foundation-flow-implementation-plan.md)

## Sprint 4 outline web E2E smoke (Task 4.8)

### `sprint4-smoke-web.ps1`

Playwright browser smoke for **`/projects/:id/outline`**: mock mode (default) and optional API mode (`-IncludeApiMode`).

**Platform:** Windows / PowerShell 5.1+. Tests in `apps/web/e2e/sprint4-outline-flow.spec.ts`.

### Prerequisites — mock mode (default)

Same as Sprint 3 mock mode:

1. `npm install` from repo root
2. `cd apps/web && npx playwright install chromium` (first run)
3. `apps/web/.env.local` with `VITE_USE_MOCKS=true` (default)
4. `npm run dev:web` → http://localhost:5173

### Prerequisites — API mode (`-IncludeApiMode`)

All mock prerequisites, plus:

1. `supabase start && supabase db reset`
2. `apps/api/.dev.vars` configured (never commit)
3. `npm run dev:api` → http://127.0.0.1:8787
4. `apps/web/.env.local`:
   - `VITE_USE_MOCKS=false`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
5. **Restart** `dev:web` after env changes

Script bootstraps foundation locked via API (intake → concepts → proposals → lock) before Playwright outline flow.

### Run from repo root

```bash
# Mock mode — outline page renders mock, no planningTruth in DOM
npm run smoke:web:outline

# Mock + API-mode outline flow (generate, edit, approve, lock)
npm run smoke:web:outline -- -IncludeApiMode
```

Playwright only (web server must be running):

```bash
npm run test:e2e:sprint4 -w @vibenovel/web
```

### What is tested

| Mode | Coverage |
|---|---|
| **Mock** | `/projects/demo-project-001/outline` — not blank; mock markers; no `planningTruth` in DOM |
| **API** (`-IncludeApiMode`) | DevAuth login → outline generate → 10 chapters → tracking panels → chapter edit → approve → lock → locked badge + disabled editor; DOM redaction |

### Output

- `[PASS]` / `[FAIL]` / `[NOT RUN]` per step
- **Exit code 0** = no FAIL steps

**Do not claim API-mode PASS** without `-IncludeApiMode` and `VITE_USE_MOCKS=false` web server.

### Known limitations

- Not in GitHub Actions CI (browser + Supabase + dual `VITE_USE_MOCKS` env)
- API mode bootstraps foundation via API (not full browser upstream flow) — faster, still uses real session
- Does not test write/summary/publish pages
- Mock and API modes need different `VITE_USE_MOCKS` — restart `dev:web` when switching

### Related docs

- [`docs/33-sprint-4-verification-report.md`](../docs/33-sprint-4-verification-report.md)
- [`scripts/sprint4-smoke-api.ps1`](sprint4-smoke-api.ps1)

## Future scripts (not yet implemented)

```txt
scripts/check-stitch-parity.ts
scripts/typegen-from-schema.ts
```

Add new scripts only with a documented sprint task and update this README.