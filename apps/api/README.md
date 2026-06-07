# apps/api — VibeNovel API (Sprint 2)

Hono API on **Cloudflare Workers** — Supabase JWT auth, projects, canon APIs, AI proposal queue (Task 2.6–2.11).

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
      foundation.ts    # GET/PUT /api/projects/:id/foundation
      characters.ts    # CRUD /api/projects/:id/characters
      facts.ts         # CRUD /api/projects/:id/facts (soft deprecate)
      speech-rules.ts  # CRUD /api/projects/:id/speech-rules
      ai-proposals.ts  # AI proposal queue lifecycle
      index.ts
    services/
      profile.ts       # getOrCreateProfileForAuthUser
      credit.ts        # read-only credit_balances
      project.ts       # project CRUD + default project_settings on create
      project-settings.ts  # settings read/upsert + validation
      foundation.ts    # story_foundations bundle + upsert
      character.ts     # characters manual CRUD
      fact.ts          # facts manual CRUD + canon guardrails
      speech-rule.ts   # speech rules CRUD + character ref validation
      ai-proposal.ts   # proposal queue CRUD + accept/reject/merge
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
| GET | `/api/projects/:id/foundation` | Bearer JWT | Foundation + active characters + confirmed facts |
| PUT | `/api/projects/:id/foundation` | Bearer JWT | Upsert story foundation fields |
| GET | `/api/projects/:id/characters` | Bearer JWT | List characters (`?includeArchived=true` optional) |
| POST | `/api/projects/:id/characters` | Bearer JWT | Create character (source: user only) |
| PATCH | `/api/projects/:id/characters/:characterId` | Bearer JWT | Update character |
| DELETE | `/api/projects/:id/characters/:characterId` | Bearer JWT | Soft archive (`status: archived`) |
| GET | `/api/projects/:id/facts` | Bearer JWT | List facts (`?includeDeprecated=true` optional) |
| POST | `/api/projects/:id/facts` | Bearer JWT | Create confirmed fact (user/system source only) |
| PATCH | `/api/projects/:id/facts/:factId` | Bearer JWT | Update fact |
| DELETE | `/api/projects/:id/facts/:factId` | Bearer JWT | Soft deprecate (`canon_status: deprecated`) |
| GET | `/api/projects/:id/speech-rules` | Bearer JWT | List speech rules (`?includeInactive=true` optional) |
| POST | `/api/projects/:id/speech-rules` | Bearer JWT | Create speech rule (source: user only) |
| PATCH | `/api/projects/:id/speech-rules/:ruleId` | Bearer JWT | Update speech rule |
| DELETE | `/api/projects/:id/speech-rules/:ruleId` | Bearer JWT | Soft deactivate (`status: deprecated`) |
| GET | `/api/projects/:id/proposals` | Bearer JWT | List proposals (default: `proposed` only) |
| POST | `/api/projects/:id/proposals` | Bearer JWT | Create manual proposal (`status: proposed`) |
| GET | `/api/projects/:id/proposals/:proposalId` | Bearer JWT | Proposal detail |
| PATCH | `/api/projects/:id/proposals/:proposalId` | Bearer JWT | Update proposed proposal only |
| POST | `/api/projects/:id/proposals/:proposalId/accept` | Bearer JWT | Accept (status only — no canon promotion) |
| POST | `/api/projects/:id/proposals/:proposalId/reject` | Bearer JWT | Reject proposal |
| POST | `/api/projects/:id/proposals/:proposalId/merge` | Bearer JWT | Merge proposal |

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

### Foundation, characters, facts (Task 2.9)

All endpoints require Bearer JWT. Ownership via `projects.owner_id = JWT userId`. Cross-user → `404`.

**`GET /api/projects/:id/foundation`**

```json
{
  "ok": true,
  "data": {
    "foundation": { "premise": "...", "readinessPercent": 82, "isLocked": false },
    "characters": [{ "name": "Nadira", "role": "protagonist" }],
    "facts": [{ "text": "...", "category": "identity", "canonStatus": "confirmed" }]
  }
}
```

Creates default foundation row if missing. Characters: active only. Facts: confirmed only.

**`PUT /api/projects/:id/foundation`** — upsert premise, conflicts, readiness, lock. Rejects edits to locked core fields unless `isLocked: false`. Audit: `foundation_created` | `foundation_updated` | `foundation_locked`.

**Characters** — manual CRUD; DELETE sets `status: archived`. POST source must be `user`. Audit: `character_created` | `character_updated`.

**Facts** — canon confirmed only. POST rejects AI sources (`ai`, `ai_direct`, `openrouter`, `gemini`, etc.). DELETE sets `canon_status: deprecated` (no hard delete). Audit: `fact_created` | `fact_updated` | `fact_deprecated`.

### Speech rules (Task 2.10)

All endpoints require Bearer JWT. Ownership via `projects.owner_id = JWT userId`. Cross-user project/rule → `404`. Invalid character ref → `400`.

**`POST /api/projects/:id/speech-rules`**

```json
{
  "fromCharacterId": "...",
  "toCharacterId": "...",
  "addressTerm": "Bu",
  "speechStyle": "Nada merendahkan dari Bu Siti; Nadira menjawab singkat dan dingin.",
  "examples": ["Bu Siti: Kau masih belajar, Nak.", "Nadira: Iya, Bu."]
}
```

Aliases: `characterAId`/`characterBId`, `fromCharacterName`/`toCharacterName`, `relationshipLabel`, `ruleText`, `panggilan`, `gayaBicara`. POST source must be `user`. Rejects AI/provider sources. Character IDs validated against project.

**`DELETE /api/projects/:id/speech-rules/:ruleId`** — sets `status: deprecated` (no hard delete). Audit: `speech_rule_created` | `speech_rule_updated` (deactivate uses `metadata.reason = "deactivate"`).

### AI proposal queue (Task 2.11)

Canon safety gate — proposals stay in queue until explicit accept/reject/merge. **Accept does not auto-promote to facts/characters/speech rules** (deferred to Task 2.11b / Sprint 3).

**`GET /api/projects/:id/proposals`** — default `status=proposed` only. Filters: `?status=`, `?type=`, `?riskLevel=`, `?includeResolved=true`.

**`POST /api/projects/:id/proposals`**

```json
{
  "type": "fact",
  "title": "Saran fakta hubungan",
  "summary": "Siska dekat dengan Arman di masa lalu",
  "payload": { "suggested_text": "...", "category": "relationship" },
  "riskLevel": "high",
  "source": "user_manual"
}
```

Status always `proposed` on create. Rejects raw provider sources (`openrouter`, `gemini`, `gpt`, etc.). Payload max 8KB; blocks `full_prompt`, `prose`, `chapter_text`.

**Lifecycle:** `proposed` → `accepted` | `rejected` | `merged` via explicit POST actions. Resolved proposals return `409 CONFLICT` on PATCH. Audit: `ai_proposal_created` | `ai_proposal_accepted` | `ai_proposal_rejected` | `ai_proposal_merged`.

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

## Not in Task 2.11

- `POST /api/auth/*` — use Supabase Auth client in browser instead
- Canon auto-promotion on accept (Task 2.11b / Sprint 3)
- OpenRouter / AI generation
- Credit deduction / ledger
- Cloudflare deploy
- Frontend wired to real data

See `docs/27-sprint-2-data-model-implementation-plan.md` Task 2.12+.