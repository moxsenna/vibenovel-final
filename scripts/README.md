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

Add new scripts only with a documented sprint task and update this README.