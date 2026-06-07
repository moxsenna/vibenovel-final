# apps/api — VibeNovel API (Sprint 2)

Hono API on **Cloudflare Workers** — Supabase JWT auth, profile sync, `/api/me`, projects + settings persistence (Task 2.7–2.8).

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
      projects.ts      # CRUD /api/projects — owner-only
      project-settings.ts  # GET/PUT /api/projects/:id/settings
      index.ts
    services/
      profile.ts       # getOrCreateProfileForAuthUser
      credit.ts        # read-only credit_balances
      project.ts       # project CRUD + default project_settings on create
      project-settings.ts  # settings read/upsert + validation
      audit.ts         # append-only audit_logs (service role)
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
| GET | `/api/projects` | Bearer JWT | List owner's projects (`?includeArchived=true` optional) |
| POST | `/api/projects` | Bearer JWT | Create project + default `project_settings` |
| GET | `/api/projects/:id` | Bearer JWT | Project detail (owner only) |
| PATCH | `/api/projects/:id` | Bearer JWT | Update title, status, isActive, genre, targetLengthPlan |
| DELETE | `/api/projects/:id` | Bearer JWT | Soft archive (`is_active = false`) |
| GET | `/api/projects/:id/settings` | Bearer JWT | Project settings (creates defaults if missing) |
| PUT | `/api/projects/:id/settings` | Bearer JWT | Update settings (enum-validated upsert) |

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

### Project routes (Task 2.7)

All `/api/projects` endpoints require `Authorization: Bearer <access_token>`. Without token → `401 UNAUTHORIZED`.

**Ownership:** Service role client with explicit `owner_id = JWT userId` filter on every query. `owner_id` from request body is never trusted. Cross-user access returns `404` (not `403`).

**`POST /api/projects`**

```json
{
  "title": "Cerita Baru",
  "entryPath": "rough_idea",
  "targetLengthPlan": "70_100",
  "defaultSettings": {
    "qualityTier": "seimbang",
    "defaultFormat": "hp_kbm"
  }
}
```

Server sets `owner_id` from JWT, `status: draft`, `current_chapter: 1`, `is_active: true` only when user has no other active project. Creates default `project_settings` row. Writes `audit_logs` action `project_created`.

**`GET /api/projects`**

Returns `{ ok: true, data: Project[] }` ordered by `updated_at` desc. Default excludes `is_active = false` (archived/inactive). Pass `?includeArchived=true` to include all.

**`DELETE /api/projects/:id`**

Soft archive only — sets `is_active = false`, no hard delete. Audit log `project_updated` with `metadata.reason = "archive"`.

### Project settings routes (Task 2.8)

All settings endpoints require Bearer JWT. Ownership verified via `projects.owner_id = JWT userId` before reading/writing `project_settings`. Cross-user access → `404`.

**`GET /api/projects/:id/settings`**

Returns camelCase settings. Creates default row if missing (`seimbang`, `warm_emotional`, `hp_kbm`). Includes `defaultLanguage` (from profile) and `defaultGenre` (from project) as read context.

**`PUT /api/projects/:id/settings`**

```json
{
  "qualityMode": "terbaik",
  "outputStylePreference": "warm_emotional",
  "mobileFormatPreference": "hp_kbm",
  "targetLengthPlan": "70_100",
  "defaultLanguage": "id",
  "defaultGenre": "Drama Misteri"
}
```

Accepted aliases: `qualityTier`, `defaultFormat`, `targetLengthBand`. Rejects raw model/provider strings (OpenRouter, Gemini, GPT, Claude, etc.). `qualityMode` must be `hemat | seimbang | terbaik` only. Invalid enum → `400 BAD_REQUEST`.

Writes `audit_logs` action `settings_updated` with `changedFields`, compact `before_data` / `after_data`.

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

## Not in Task 2.8

- `POST /api/auth/*` — use Supabase Auth client in browser instead
- Story foundation / characters / facts CRUD (Task 2.9+)
- OpenRouter / AI generation
- Credit deduction / ledger
- Cloudflare deploy
- Frontend dashboard wired to real data

See `docs/27-sprint-2-data-model-implementation-plan.md` Task 2.9+.