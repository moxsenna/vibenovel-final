# apps/api — VibeNovel API (Sprint 2–3)

Hono API on **Cloudflare Workers** — Supabase JWT auth, projects, canon APIs, AI proposal queue, credit balance read (Task 2.6–2.12), intake persistence (Task 3.2).

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
      credits.ts       # GET /api/credits/balance — read-only
      intake.ts        # GET/POST intake, messages, signals (Task 3.2)
      concepts.ts      # GET/POST/PATCH concepts, generate, select (Task 3.3)
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
      intake.ts        # intake sessions, messages, detected signals (stub extractor)
      concept.ts       # story_concepts list/generate/select (stub generator)
      foundation-proposal.ts  # stub foundation proposal batch (Task 3.4)
      foundation-readiness.ts # server-side readiness calculator (Task 3.4)
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
| GET | `/api/credits/balance` | Bearer JWT | Read-only credit balance for authenticated user |
| GET | `/api/projects/:id/intake` | Bearer JWT | Intake bundle: session + recent messages + signals (auto-create session if missing) |
| POST | `/api/projects/:id/intake` | Bearer JWT | Create or reset active intake session |
| GET | `/api/projects/:id/intake/messages` | Bearer JWT | List messages (`?limit=50` default) |
| POST | `/api/projects/:id/intake/messages` | Bearer JWT | Append user message + deterministic agent stub reply |
| GET | `/api/projects/:id/intake/signals` | Bearer JWT | List detected signals (`?status=` optional) |
| POST | `/api/projects/:id/intake/extract-signals` | Bearer JWT | Rule-based signal extraction from user messages (not AI) |
| PATCH | `/api/projects/:id/intake/signals/:signalId` | Bearer JWT | Update signal status (`detected` / `confirmed` / `dismissed`) |
| GET | `/api/projects/:id/concepts` | Bearer JWT | List concept options (`?status=`, `?includeRejected=true`) |
| POST | `/api/projects/:id/concepts/generate` | Bearer JWT | Stub-generate 3 concepts (`regenerate`, `basedOnSignals` optional) |
| GET | `/api/projects/:id/concepts/:conceptId` | Bearer JWT | Concept detail |
| PATCH | `/api/projects/:id/concepts/:conceptId` | Bearer JWT | Update proposed concept only (`selected` → 409) |
| POST | `/api/projects/:id/concepts/:conceptId/select` | Bearer JWT | Select concept → updates `projects.selected_concept_id`, `workflow_phase=foundation` |
| POST | `/api/projects/:id/foundation/proposals/generate` | Bearer JWT | Stub foundation proposal batch from selected concept (`regenerate` optional) |
| GET | `/api/projects/:id/foundation/proposals` | Bearer JWT | Foundation-flow proposals (`?includeResolved=true`) |
| GET | `/api/projects/:id/foundation/readiness` | Bearer JWT | Server-side readiness score, checks, `canLock` (lock deferred 3.5) |

### Intake routes (Task 3.2)

All intake endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` — cross-user access → `404`.

**Not canon:** `detected_signals`, `intake_messages`, and `story_concepts` never write to `facts`, `characters`, or `ai_proposals` in Task 3.2.

**Agent reply:** `POST .../intake/messages` creates a **deterministic stub** agent message server-side. No OpenRouter, no model router, no frontend LLM.

**Signal extraction:** `POST .../extract-signals` uses keyword heuristics on user message text. Upserts/dedupes by `type` + `value`. Does not create foundation or concepts.

**Audit:** No `audit_logs` writes for intake in Task 3.2 (`audit_action` enum extension deferred).

### Concept routes (Task 3.3)

All concept endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + concept `project_id` match → cross-user `404`.

**Not canon:** `story_concepts` never writes to `facts`, `story_foundations`, or `ai_proposals`. Select concept does **not** lock foundation.

**Generate:** `POST .../concepts/generate` uses deterministic stub templates informed by `detected_signals` and project title. `regenerate=false` (default) returns existing active concepts if ≥3; `regenerate=true` rejects old `proposed` and creates 3 new. No OpenRouter / AI.

**Select:** Sets one `selected` concept, rejects others, updates `projects.selected_concept_id` and `workflow_phase=foundation`.

**Audit:** No concept-specific `audit_logs` in Task 3.3.

### Foundation proposal & readiness (Task 3.4)

Requires **selected concept** before `POST .../foundation/proposals/generate`. Cross-user → `404`.

**Generate:** Deterministic stub batch → `ai_proposals` (`foundation`, `character`, `fact`, `relationship_speech_rule`, `secret`, `style`). `source=system_seed`, `payload.generator=foundation_stub_batch`. Does **not** write `facts`, `characters`, `speech_rules`, or lock foundation.

**Dedupe:** `regenerate=false` returns existing proposed stub batch; `regenerate=true` rejects old proposed foundation-flow proposals with note `regenerated`.

**Readiness:** `GET .../foundation/readiness` computes score server-side, updates `story_foundations.readiness_percent` / `readiness_status` only (no canon copy from proposals). `canLock` requires score ≥75 + core checks — actual lock is Task 3.5.

**Audit:** Batch generator does not write per-proposal audit (manual `POST /proposals` still audits via existing service).

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

### Credit balance read (Task 2.12)

`GET /api/credits/balance` — read-only display balance for the authenticated user. Uses the same `getCreditBalanceForUser` service as `/api/me`. No query/body `userId`; no mutation, ledger, deduction, or audit log on GET.

```json
{
  "ok": true,
  "data": {
    "creditBalance": {
      "balance": 1250,
      "monthlyQuota": 1000,
      "monthlyUsed": 450,
      "source": "seed",
      "updatedAt": "..."
    }
  }
}
```

`creditBalance` is `null` when no `credit_balances` row exists (no auto-create in Sprint 2).

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

## Not in Task 2.12

- `POST /api/auth/*` — use Supabase Auth client in browser instead
- Canon auto-promotion on accept (Task 2.11b / Sprint 3)
- OpenRouter / AI generation
- Credit deduction / ledger / top-up / payment
- `PATCH /api/credits/*` or balance auto-create for new users
- Cloudflare deploy
- Frontend wired to real data

See `docs/27-sprint-2-data-model-implementation-plan.md` Task 2.13+.