# scripts — Developer & Smoke Test Helpers

Operational scripts for local verification and future CI helpers. **Not** runtime application code.

**Debt register:** [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](../docs/36-non-blocking-technical-debt-and-deferred-items.md)

---

## Smoke command index (Task 5.8)

Run all commands from **repo root**. Windows/PowerShell primary.

| npm script | Script | Mode | Prerequisites |
|---|---|---|---|
| `smoke:api` | `sprint2-smoke-api.ps1` | API Sprint 2 regression (17 steps) | Docker, `supabase start`, `dev:api`, `apps/api/.dev.vars` |
| `smoke:api:base` | same as `smoke:api` | Alias — unchanged semantics for CI/docs | Same |
| `smoke:api:sprint5` | `sprint5-smoke-api.ps1` | Write Room + leak guards (49 steps) | Same as API base |
| `smoke:api:sprint6` | `sprint6-smoke-api.ps1` | Sprint 6 summary/delta/approval safety (Task 6.6) | Same as API base |
| `smoke:web` | `sprint3-smoke-web.ps1` | Web mock (intake/concepts/foundation) | `dev:web`, Playwright chromium |
| `smoke:web:outline` | `sprint4-smoke-web.ps1` | Web mock `/outline`; add `-- -IncludeApiMode` for API | `dev:web`; API mode + `VITE_USE_MOCKS=false` |
| `smoke:web:write` | `sprint5-smoke-web.ps1` | Web mock `/write`; add `-- -IncludeApiMode` for API | Same |
| `smoke:web:summary` | `sprint6-smoke-web.ps1` | Web mock `/summary` + leak guards; `-- -IncludeApiMode` for API flow | Same |
| `smoke:web:publish` | `sprint7-smoke-web.ps1` | Web mock `/publish` + leak guards; `-- -IncludeApiMode` for API flow | Same |
| `smoke:api:sprint7` | `sprint7-smoke-api.ps1` | Publish package generation/update/export safety (Task 7.5) | Same as API base |
| `smoke:all:local` | `smoke-all-local.ps1` | Sprint 2/5/6/7 API + Sprint 3–7 web mock (9 phases) | All API + web prerequisites |
| `smoke:all:local:full` | `smoke-all-local.ps1 -IncludeApiMode` | Above + web API-mode on all web wrappers (incl. summary/publish) | + restart `dev:web` after `VITE_USE_MOCKS=false` |

**Optional (not in package.json):** `scripts/sprint4-smoke-api.ps1` — Sprint 4 outline API (20 steps).

### Prerequisites summary

| Requirement | API smokes | Web mock | Web API-mode |
|---|---|---|---|
| Docker Desktop | ✅ | — | ✅ |
| `supabase start` + `db reset` | ✅ | — | ✅ |
| `npm run dev:api` → :8787 | ✅ | — | ✅ |
| `apps/api/.dev.vars` (gitignored) | ✅ | — | ✅ |
| `npm run dev:web` → :5173 | — | ✅ | ✅ |
| `npx playwright install chromium` | — | ✅ (first run) | ✅ |
| `VITE_USE_MOCKS=true` in `apps/web/.env.local` | — | ✅ default | — |
| `VITE_USE_MOCKS=false` + Supabase env in `.env.local` | — | — | ✅ |
| Restart `dev:web` after env change | — | — | ✅ |

**Never commit** `apps/web/.env.local`, `apps/api/.dev.vars`, or any file containing keys/tokens.

### Vite port troubleshooting

- Default dev server: **http://localhost:5173**
- If 5173 is busy, Vite may use **5174** — smoke scripts default to 5173.
- Fix: stop other dev servers, or pass `-WebBaseUrl "http://localhost:5174"` to web smoke scripts:

  ```powershell
  npm run smoke:web:write -- -WebBaseUrl "http://localhost:5174"
  ```

### CI note

GitHub Actions runs **typecheck + build only** (`.github/workflows/ci.yml`). Docker/Supabase/Playwright smokes remain **local-only** until a dedicated CI job exists.

---

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
npm run smoke:api          # Sprint 2 regression (same as smoke:api:base)
npm run smoke:api:base     # explicit alias
npm run smoke:api:sprint5  # Write Room safety (Sprint 5)
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

## Sprint 5 Write Room API smoke (Task 5.6)

### `sprint5-smoke-api.ps1`

API smoke for **context packet**, **writing session**, **beats**, **prose draft**, and **safety leak guards**.

**Platform:** Windows / PowerShell 5.1+. Same prerequisites as Sprint 2/4 API smoke.

### Run from repo root

```bash
npm run smoke:api:sprint5
```

Or directly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sprint5-smoke-api.ps1
```

### What is tested

| Area | Coverage |
|---|---|
| Context packet | Preview-only response; no `packet_json`/`planningTruth`/provider keys; ch1 no ch2 title/summary |
| DB `packet_json` | Owner SELECT via PostgREST; forbidden reveal labels only (no planning truth text) |
| Prose | Rejects `planningTruth` and packet dumps; allows normal fictional secrets; no packet JSON in response |
| Canon guard | Prose + `ready_for_summary` do not mutate facts/characters/speech_rules/outline |
| Ready marker | `ready_for_summary` status set; not `summarized`; no chapter summary created |

### Output

- `[PASS]` / `[FAIL]` per step
- **Exit code 0** = all steps PASS

Does **not** print JWT or service role keys.

## Sprint 5 write web E2E smoke (Task 5.6)

### `sprint5-smoke-web.ps1`

Playwright browser smoke for **`/projects/:id/write`**: mock mode (default) and optional API mode (`-IncludeApiMode`).

**Platform:** Windows / PowerShell 5.1+. Tests in `apps/web/e2e/sprint5-write-flow.spec.ts`.

### Prerequisites — mock mode (default)

Same as Sprint 4 mock mode:

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

Script bootstraps foundation locked + outline generate/approve/lock via API before Playwright write flow.

### Run from repo root

```bash
# Mock mode — write page renders mock, no planningTruth/packet_json in DOM
npm run smoke:web:write

# Mock + API-mode write flow (session, context preview, prose, ready_for_summary)
npm run smoke:web:write -- -IncludeApiMode
```

Playwright only (web server must be running):

```bash
npm run test:e2e:sprint5 -w @vibenovel/web
```

### What is tested

| Mode | Coverage |
|---|---|
| **Mock** | `/projects/demo-project-001/write` — not blank; mock markers; no leak patterns in DOM |
| **API** (`-IncludeApiMode`) | DevAuth login → write session → beats → safe context preview → prose save ×2 → ready_for_summary CTA; DOM redaction |

### Output

- `[PASS]` / `[FAIL]` / `[NOT RUN]` per step
- **Exit code 0** = no FAIL steps

**Do not claim API-mode PASS** without `-IncludeApiMode` and `VITE_USE_MOCKS=false` web server.

### Known limitations

- Not in GitHub Actions CI (browser + Supabase + dual `VITE_USE_MOCKS` env)
- API mode bootstraps via API (not full browser upstream flow)
- `ready_for_summary` navigates to summary mock — does not verify Sprint 6 canon
- Mock and API modes need different `VITE_USE_MOCKS` — restart `dev:web` when switching

### Related docs

- [`docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`](../docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md)
- [`scripts/sprint5-smoke-api.ps1`](sprint5-smoke-api.ps1)

## Local smoke suite (Task 5.8, consolidated Task 7.8.4)

### `smoke-all-local.ps1`

Runs **nine phases** in sequence (collects failures; exits 1 if any phase FAIL):

| Phase | Script | `smoke:all:local` | `smoke:all:local:full` |
|---|---|---|---|
| 1 | `sprint2-smoke-api.ps1` | API | API |
| 2 | `sprint5-smoke-api.ps1` | API | API |
| 3 | `sprint6-smoke-api.ps1` | API | API |
| 4 | `sprint7-smoke-api.ps1` | API | API |
| 5 | `sprint3-smoke-web.ps1` | mock | mock + `-IncludeApiMode` |
| 6 | `sprint4-smoke-web.ps1` | mock | mock + `-IncludeApiMode` |
| 7 | `sprint5-smoke-web.ps1` | mock | mock + `-IncludeApiMode` |
| 8 | `sprint6-smoke-web.ps1` | mock | mock + `-IncludeApiMode` |
| 9 | `sprint7-smoke-web.ps1` | mock | mock + `-IncludeApiMode` |

```bash
# Mock web (default) — full Sprint 2/5/6/7 API + Sprint 3–7 web
npm run smoke:all:local

# Full stack + web API-mode (summary/publish API flows included)
npm run smoke:all:local:full
```

**Orchestrator parameters** (direct PowerShell):

```powershell
powershell -File scripts/smoke-all-local.ps1 -SkipApi          # web only
powershell -File scripts/smoke-all-local.ps1 -SkipWeb          # API only
powershell -File scripts/smoke-all-local.ps1 -WebBaseUrl "http://localhost:5174"
powershell -File scripts/smoke-all-local.ps1 -IncludeApiMode   # same as :full
```

### Prerequisites — `smoke:all:local`

| Requirement | Notes |
|---|---|
| Docker Desktop + `supabase start` | API phases 1–4 |
| `supabase db reset` | Fresh schema/seed before long runs |
| `npm run dev:api` → :8787 | API phases + API-mode web bootstrap |
| `apps/api/.dev.vars` (gitignored) | From `supabase status` — never commit |
| `npm run dev:web` → :5173 | Web phases 5–9 |
| `npx playwright install chromium` | First run in `apps/web` |
| `VITE_USE_MOCKS=true` in `apps/web/.env.local` | Default mock web (phases 5–9) |

### Prerequisites — `smoke:all:local:full` (API-mode web)

All mock prerequisites, plus:

| Requirement | Notes |
|---|---|
| `VITE_USE_MOCKS=false` in `apps/web/.env.local` | Real API session in browser |
| Supabase env in `.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |
| **Restart** `dev:web` after env change | Vite bakes env at startup — flaky if skipped |
| Same Supabase + `dev:api` as API smokes | Web API-mode bootstraps via API before Playwright |

**CI note:** `smoke:all:local:full` remains **local/manual only** — not in GitHub Actions (see `docs/41` §5).

Expect **~5–15 minutes** depending on API bootstrap and API-mode web runs. Requires `dev:api` and `dev:web` running before start.

## Future scripts (not yet implemented)

```txt
scripts/check-stitch-parity.ts
scripts/typegen-from-schema.ts
smoke:api:sprint4 npm alias (optional)
```

Add new scripts only with a documented sprint task and update this README.