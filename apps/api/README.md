# apps/api — VibeNovel API (Sprint 2 Task 2.5)

Hono API on **Cloudflare Workers** — health, env shell, CORS, auth guard shell. No CRUD or AI routes yet.

## Stack

- [Hono](https://hono.dev/) 4.x
- TypeScript
- Wrangler 3.x (local dev)
- `@vibenovel/shared` for `JsonValue` types

## Structure

```txt
apps/api/
  src/
    index.ts           # Worker entry
    env.ts             # Bindings + safe env flags
    errors.ts          # AppError + global handlers
    response.ts        # { ok, data } / { ok, error }
    middleware/
      cors.ts
      auth.ts          # Bearer shell (full auth → Task 2.6)
    routes/
      health.ts
      me.ts
      index.ts
    lib/
      supabase.ts      # Client factory shell (no queries)
  wrangler.toml
  .dev.vars.example
```

## Local development

1. Copy env template (no secrets in git):

   ```bash
   cp apps/api/.dev.vars.example apps/api/.dev.vars
   ```

2. Fill `.dev.vars` locally with Supabase local URLs/keys if needed.

3. From repo root:

   ```bash
   npm run dev:api
   ```

   Default: http://127.0.0.1:8787

## Endpoints (Task 2.5)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Service health + env presence flags |
| GET | `/api/health` | No | Alias |
| GET | `/api/me` | Bearer | Auth shell — 401 without token |

### Response format

Success:

```json
{ "ok": true, "data": { ... } }
```

Error:

```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

`/health` never returns env **values** — only booleans like `hasSupabaseUrl`.

## Scripts (root)

```bash
npm run dev:api
npm run typecheck:api
npm run build:api
```

## Environment variables

| Variable | Required (2.5) | Notes |
|---|---|---|
| `SUPABASE_URL` | Optional | Flag only on /health |
| `SUPABASE_ANON_KEY` | Optional | Never sent to browser from API |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Server only — Task 2.6+ data routes |
| `APP_ENV` | Optional | Default `development` |
| `ALLOWED_ORIGINS` | Optional | CSV; default localhost:5173–5175 |

## Not in Task 2.5

- Project / settings / foundation CRUD
- Supabase query execution
- OpenRouter / AI generation
- Credit deduction
- Cloudflare deploy
- Frontend integration

See `docs/27-sprint-2-data-model-implementation-plan.md` Task 2.6+.