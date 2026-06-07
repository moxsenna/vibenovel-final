# apps/api — VibeNovel API (Sprint 2)

Hono API on **Cloudflare Workers** — Supabase JWT auth, profile sync, `/api/me`. No CRUD or AI routes yet.

## Stack

- [Hono](https://hono.dev/) 4.x
- TypeScript
- Wrangler 3.x (local dev)
- `@supabase/supabase-js` — JWT validation + server-side reads
- `@vibenovel/shared` — domain types

## Structure

```txt
apps/api/
  src/
    index.ts
    env.ts
    errors.ts
    response.ts
    middleware/
      cors.ts
      auth.ts          # JWT validation via Supabase Auth
    routes/
      health.ts
      me.ts            # GET /api/me — profile + credit balance
      index.ts
    services/
      profile.ts       # getOrCreateProfileForAuthUser
      credit.ts        # read-only credit_balances
    lib/
      supabase.ts      # anon + service role clients
      mappers.ts
  wrangler.toml
  .dev.vars.example
```

## Local development

1. Start Supabase locally:

   ```bash
   supabase start
   supabase status   # copy API URL and keys
   ```

2. Copy env template (no secrets in git):

   ```bash
   cp apps/api/.dev.vars.example apps/api/.dev.vars
   ```

3. Fill `.dev.vars` with values from `supabase status`.

4. From repo root:

   ```bash
   npm run dev:api
   ```

   Default: http://127.0.0.1:8787

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Service health + env presence flags |
| GET | `/api/health` | No | Alias |
| GET | `/api/me` | Bearer JWT | User + profile + creditBalance |

### Auth approach (Task 2.6)

- **No custom password auth on API.** Identity comes from Supabase Auth.
- Frontend signs in via `@supabase/supabase-js` (browser anon client).
- API validates `Authorization: Bearer <access_token>` with `supabase.auth.getUser(token)`.
- Profile sync uses **service role** server-side only, filtered by validated `user.id`.
- Service role key never appears in responses, logs, or `/health`.

### `GET /api/me` response

```json
{
  "ok": true,
  "data": {
    "user": { "id": "...", "email": "..." },
    "profile": { "displayName": "...", "email": "...", "role": "writer" },
    "creditBalance": { "balance": 1250, "monthlyQuota": 1000 } 
  }
}
```

`creditBalance` is `null` when no row exists. No credit mutation in Task 2.6.

### Response format

Success: `{ "ok": true, "data": { ... } }`

Error: `{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }`

## Scripts (root)

```bash
npm run dev:api
npm run typecheck:api
npm run build:api
```

## Environment variables

| Variable | Required (2.6) | Notes |
|---|---|---|
| `SUPABASE_URL` | Yes for `/api/me` | Local: `http://127.0.0.1:54321` |
| `SUPABASE_ANON_KEY` | Yes for JWT validation | Never sent to browser from API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for profile/credit reads | Server only |
| `APP_ENV` | Optional | Default `development` |
| `ALLOWED_ORIGINS` | Optional | CSV; default localhost:5173–5175 |

## Not in Task 2.6

- `POST /api/auth/*` — use Supabase Auth client in browser instead
- Project / settings / foundation CRUD
- OpenRouter / AI generation
- Credit deduction / ledger
- Cloudflare deploy
- Frontend dashboard wired to real data

See `docs/27-sprint-2-data-model-implementation-plan.md` Task 2.7+.