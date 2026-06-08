# apps/api — VibeNovel API (Sprint 2–4)

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
      outline.ts       # GET outline bundle, generate, chapters, loops, reveals, approve/lock (Task 4.2–4.5)
      write.ts         # context packet, writing sessions, beats (Task 5.2–5.3)
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
      foundation-lock.ts      # lock workflow + safe canon promotion (Task 3.5)
      outline.ts       # outline bundle read + stub generate (Task 4.2)
      chapter-outline.ts    # chapter outline list/detail/PATCH (Task 4.3)
      outline-tracking.ts   # open loop + planned reveal CRUD (Task 4.4)
      outline-lock.ts       # outline approve + lock workflow (Task 4.5)
      outline-snapshot.ts   # canon snapshot for planner (read-only)
      outline-generator.ts  # deterministic 10-chapter stub (Task 4.2)
      write-snapshot.ts     # write room gate + context snapshot loader (Task 5.2)
      context-packet-builder.ts  # safe context packet build (Task 5.2)
      context-packet-safety.ts   # packet hash + safety asserts (Task 5.2)
      write-session.ts    # writing session start/patch/ready-for-summary (Task 5.3)
      chapter-beat.ts     # beat list/generate/patch stub (Task 5.3)
      prose-draft.ts      # prose version save/list/make-current (Task 5.4)
      audit.ts         # append-only audit_logs (service role)
      audit-snapshot.ts   # compact snapshots + metadata sanitizer (Task 7.8.2)
      transaction.ts   # compensation runner + failure classification (Task 7.8.3)
      ai-generation-types.ts  # internal AI router types (Task 8.2)
      ai-prompt-safety.ts     # prompt/output safety asserts (Task 8.2)
      model-router.ts         # model allowlist + provider boundary (Task 8.2)
      openrouter-client.ts    # OpenRouter shell — Worker-only (Task 8.2)
      mock-ai-provider.ts     # deterministic mock for local smoke (Task 8.2)
    lib/
      supabase.ts      # anon + service role clients
      mappers.ts
  wrangler.toml
  .dev.vars.example
```

## Audit log coverage (Task 7.8.2)

Migration `00007_audit_enum_extension.sql` extends `audit_action` / `audit_entity_type`. Types mirrored in `@vibenovel/shared` (`AUDIT_ACTIONS`, `AUDIT_ENTITY_TYPES`).

**P0 writers (implemented):**

| Workflow | Actions |
|---|---|
| Foundation lock | `foundation_lock_started`, `foundation_locked`, `foundation_lock_failed` |
| Delta extract | `chapter_delta_extracted`, `summary_proposal_linked` (+ legacy `ai_proposal_created`) |
| Summary proposal review | `summary_proposal_accepted`, `summary_proposal_rejected`, `canon_promotion_applied`, `canon_promotion_failed` (+ legacy `ai_proposal_accepted` / `rejected`) |
| Publish export/update | `publish_package_exported`, `publish_package_updated`, `publish_checklist_updated` |

**P1 writers (implemented):**

| Workflow | Actions |
|---|---|
| Summary approval | `chapter_summary_approved` (replaces generic `project_updated` on approve path) |
| Publish generate | `publish_package_generated`, `publish_package_regenerated` |

**Payload policy:** `audit-snapshot.ts` strips secrets, prose, `packet_json`, `planningTruth`, long captions. Audit insert failure → HTTP 500.

**Deferred (P2):** intake/concept/outline/write-room audit writers — enum ready, writers not yet added.

See [`docs/42-audit-action-enum-and-coverage-plan.md`](../docs/42-audit-action-enum-and-coverage-plan.md).

## Transaction strategy (Task 7.8.3)

**Chosen approach: Option B — transaction-like service hardening** (not true Postgres `BEGIN/COMMIT` via PostgREST).

Cloudflare Worker + `@supabase/supabase-js` cannot wrap arbitrary multi-table writes in a single DB transaction without Supabase RPC/stored procedures. Task 7.8.3 adds `services/transaction.ts` (`runWithCompensation`, `TransactionPlan`, `classifyTransactionFailure`) and hardens P0 workflows:

| Workflow | Pattern |
|---|---|
| Foundation lock | Validate-all-before-write → promote canon → lock foundation row → update `workflow_phase`; on phase failure **unlock** foundation (compensation); `foundation_lock_failed` on any write failure |
| Delta extract + link | Preflight proposal drafts → write delta → batch insert proposals/links with compensation delete on partial failure; **delete new delta** if linking fails |
| Proposal accept + canon | Preflight promotion → promote canon → `canon_promotion_applied` → update `accepted` status; on status failure **compensate** newly created canon entities + `canon_promotion_failed` |

**Invariants enforced:**

- `ai_proposals.status = accepted` only after canon promotion succeeds (or idempotent re-read).
- `story_foundations.is_locked = true` only after promotions + lock row update succeed.
- Delta extract does not return success if proposal/link enqueue fails (new delta rolled back).

## AI model router shell (Task 8.2)

**Status:** Internal services only — **no public `/api/projects/:id/ai/*` routes yet** (Task 8.4). **No credit mutation** (Task 8.3). **AI disabled by default.**

```txt
(future) route → ai-generation-service → model-router → openrouter-client | mock-ai-provider
```

| Service | Role |
|---|---|
| `model-router.ts` | `resolveModelForGeneration`, `generateWithModelRouter` — allowlist, quality tier mapping |
| `openrouter-client.ts` | OpenRouter `/chat/completions` shell — timeout, safe error mapping, no key/body logging |
| `mock-ai-provider.ts` | Deterministic local output when `AI_PROVIDER_MOCK=true` |
| `ai-prompt-safety.ts` | `assertPromptSafeForProvider`, `assertProviderOutputSafe` — never logs prompt |

**Env (Worker-only — names in `.dev.vars.example`, never commit values):**

| Variable | Default | Notes |
|---|---|---|
| `AI_GENERATION_ENABLED` | `false` | When false, `generateWithModelRouter` → `503 AI_DISABLED` |
| `AI_PROVIDER_MOCK` | `false` | Use mock provider (no network) |
| `AI_PROVIDER_MOCK_MODE` | `success` | `fail_provider` \| `unsafe_output` for future smoke |
| `OPENROUTER_API_KEY` | unset | Required for live OpenRouter when mock off |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Optional override |
| `DEFAULT_AI_MODEL` | unset | Fallback if tier env invalid; must be in allowlist |
| `AI_MODEL_HEMAT` / `SEIMBANG` / `TERBAIK` | tier defaults | Must be in `MODEL_ALLOWLIST` |
| `AI_TIMEOUT_MS` | `45000` | Per-request timeout (tier caps also apply) |
| `AI_MAX_RETRIES` | `1` | Transient provider retries only |

`/health` exposes safe flags: `aiGenerationEnabled`, `aiProviderMock`, `hasOpenRouterApiKey` (booleans only).

**Security:** OpenRouter key never in frontend. Raw prompt never logged or stored. Client cannot pass arbitrary `model`. Provider errors mapped to `AI_*` codes without raw body.

**Audit ordering:** `*_started` / preflight before writes; `*_applied` only after success; `*_failed` after validation or write failure. No payload leak (`audit-snapshot.ts`).

**Remaining limitations (no schema redesign):**

- Mid-promotion partial canon during foundation lock (characters/facts/rules) is not fully rolled back — only lock flag compensation on phase failure.
- Delta **regenerate** path may leave updated delta without proposals if linking fails after update (documented; prefer delete compensation only for new inserts).
- Character/reveal **updates** (non-create) cannot be compensated on accept status failure.
- True atomic RPC deferred to pre-production (`docs/41` §4, `docs/36`).

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
| GET | `/api/projects/:id/foundation/readiness` | Bearer JWT | Server-side readiness score, checks, `canLock` |
| POST | `/api/projects/:id/foundation/lock` | Bearer JWT | Lock foundation + promote accepted safe proposals (Task 3.5) |
| GET | `/api/projects/:id/outline` | Bearer JWT | Outline bundle: plan + chapters + loops + reveals (Task 4.2) |
| POST | `/api/projects/:id/outline/generate` | Bearer JWT | Deterministic outline stub — requires foundation locked (Task 4.2) |
| GET | `/api/projects/:id/outline/chapters` | Bearer JWT | List chapter outlines ordered by `chapter_number` (Task 4.3) |
| GET | `/api/projects/:id/outline/chapters/:chapterId` | Bearer JWT | Chapter outline detail (Task 4.3) |
| PATCH | `/api/projects/:id/outline/chapters/:chapterId` | Bearer JWT | Manual edit chapter outline fields (Task 4.3) |
| GET | `/api/projects/:id/outline/open-loops` | Bearer JWT | List open loops (`?status=` optional) (Task 4.4) |
| POST | `/api/projects/:id/outline/open-loops` | Bearer JWT | Create open loop (Task 4.4) |
| PATCH | `/api/projects/:id/outline/open-loops/:loopId` | Bearer JWT | Update open loop (Task 4.4) |
| DELETE | `/api/projects/:id/outline/open-loops/:loopId` | Bearer JWT | Soft drop (`status=dropped`) (Task 4.4) |
| GET | `/api/projects/:id/outline/reveals` | Bearer JWT | List planned reveals — `planningTruth` redacted (Task 4.4) |
| POST | `/api/projects/:id/outline/reveals` | Bearer JWT | Create planned reveal — response redacted (Task 4.4) |
| PATCH | `/api/projects/:id/outline/reveals/:revealId` | Bearer JWT | Update planned reveal — response redacted (Task 4.4) |
| DELETE | `/api/projects/:id/outline/reveals/:revealId` | Bearer JWT | Soft cancel (`status=cancelled`) (Task 4.4) |
| POST | `/api/projects/:id/outline/approve` | Bearer JWT | Mark outline ready for final lock check (Task 4.5) |
| POST | `/api/projects/:id/outline/lock` | Bearer JWT | Lock outline plan + `workflow_phase=outline_locked` (Task 4.5) |

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

**Readiness:** `GET .../foundation/readiness` computes score server-side, updates `story_foundations.readiness_percent` / `readiness_status` only (no canon copy from proposals). `canLock` requires score ≥75 + core checks.

**Audit:** Batch generator does not write per-proposal audit (manual `POST /proposals` still audits via existing service).

### Foundation lock (Task 3.5)

`POST /api/projects/:id/foundation/lock` — requires Bearer JWT. Ownership via `getOwnedProjectRow` → cross-user `404`.

**No AI generation.** Lock does not call OpenRouter, model router, or auto-accept `proposed` proposals.

**Idempotency:** If foundation already locked → `409 CONFLICT` (`Foundation is already locked`). Does not re-run promotion.

**Lock preconditions** (all required):

- Selected concept with `status=selected`
- `readinessScore >= 75` and `canLock=true` from readiness service
- Core canon satisfied via existing foundation rows **or** accepted proposals ready for promotion:
  - premise, main conflict, reader promise, protagonist, ≥2 facts, target reader, genre + tone
- Foundation not already locked

On failure → `409 CONFLICT` with `details`: `readinessScore`, `missing`, `failedChecks`.

**Promotion at lock** (accepted proposals only):

| Type | Action |
|---|---|
| `foundation` | Fill empty `story_foundations` core fields (allowed payload keys only) |
| `character` | Create/update `characters` with `source=accepted_proposal` |
| `fact` | Create `facts` with `source=accepted_proposal` |
| `relationship_speech_rule` | Create speech rule with `source=accepted_proposal` |
| `style` | Merge `tone` / `style_tags` into foundation if empty |

**Forbidden promotion:**

- `secret`, `reveal`, `chapter_delta` proposal types
- `proposed` / `rejected` / `merged` proposals
- Facts with `category=secret` or high-risk secret payloads
- Raw provider/model output fields in payload

Lock does **not** write `ai_proposal_accepted` audit (accept is separate). Writes `foundation_locked` plus `character_created` / `fact_created` / `speech_rule_created` for promoted entities.

**On success:** Sets `story_foundations.is_locked=true`, `status=locked`, `locked_at`, updates readiness; sets `projects.workflow_phase=foundation_locked`. Returns `{ foundation, readiness, promoted: { characters, facts, speechRules } }`.

**Limitation (7.8.3):** Transaction-like hardening only — validate-all-before-write, ordered writes, phase-failure unlock compensation. Mid-promotion partial canon without lock remains possible if lock row update fails after promotions (rare); `foundation_lock_failed` audit emitted.

### Outline routes (Task 4.2)

All outline endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` — cross-user access → `404`.

**Not prose / not AI:** Outline generation is a **deterministic stub** (`outline_stub_deterministic`). No OpenRouter, no model router, no AI generation, no prose/chapter bodies.

**Foundation gate:** `POST .../outline/generate` requires `story_foundations.is_locked=true` and a selected concept (`status=selected`). If foundation not locked → `409 CONFLICT` with message `Foundation must be locked before generating outline` and `details.missing: ["foundation_locked"]`.

**`GET /api/projects/:id/outline`**

Returns `200` with camelCase bundle:

```json
{
  "ok": true,
  "data": {
    "outlinePlan": null,
    "chapterOutlines": [],
    "openLoops": [],
    "plannedReveals": [],
    "planningTruthRedacted": true
  }
}
```

When no plan exists, `outlinePlan` is `null` and arrays are empty (UI can show generate CTA). When plan exists, includes ordered `chapterOutlines`, `openLoops`, and `plannedReveals`.

**Planner/writer boundary — `planning_truth` redaction:** Default GET (and generate response) **omit** `plannedReveals[].planningTruth`. Each reveal includes `planningTruthRedacted: true`. Raw `planning_truth` is planner-only DB data; writer Context Packet (Sprint 5+) must never receive it from this endpoint.

**`POST /api/projects/:id/outline/generate`**

Optional body:

```json
{
  "targetChapterCount": 10,
  "regenerate": false,
  "seasonLabel": "Bab 1–10: Awal Konflik",
  "arcSummary": "Ringkasan arc opsional"
}
```

- `targetChapterCount` — integer `1..50` (Sprint 4 API cap; DB allows up to 200). Default `10`.
- `regenerate=false` (default) — if outline plan exists with chapters, returns existing bundle (`200`, `created: false`).
- `regenerate=true` — deletes existing `open_loops`, `planned_reveals`, `chapter_outlines` for the plan and inserts fresh stub. Rejected if `outline_plans.status=locked` → `409`.

Stub output (default 10 chapters): parity baseline `apps/web/src/mocks/outline.ts` — drama rumah tangga / revenge arc, hooks every chapter, ≥3 mini victories, **3** `open_loops`, **3** `planned_reveals` (MVP cap 4 each before Reveal Gate matures).

**Canon guardrails — outline does NOT mutate:**

- `facts`, `characters`, `relationship_speech_rules`, `story_foundations`
- No `ai_proposals` created from generate (Task 4.2)
- No credit balance changes

**Workflow:** On successful generate, if `projects.workflow_phase=foundation_locked`, sets `workflow_phase=outline`. Does not set `outline_locked` or unlock foundation.

**Audit:** No outline-specific `audit_action` enum in Task 4.2. Workflow phase change may write existing `project_updated` audit when advancing from `foundation_locked`.

### Chapter outline routes (Task 4.3)

All chapter outline endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + chapter `project_id` / `outline_plan_id` match — cross-user → `404`.

**Not prose:** PATCH accepts planning fields only (`title`, `summary`, `purpose`, `hook`, `endingHook`, `miniVictory`, markers). Rejects `chapterText`, `prose`, `body`, `planningTruth`, and outline identity fields (`chapterNumber`, `outlinePlanId`, `projectId`).

**`GET /api/projects/:id/outline/chapters`**

Returns `{ ok: true, data: { chapters: ChapterOutline[] } }` ordered by `chapter_number` asc. If no outline plan → `200` with `chapters: []`. Optional filters: `?status=`, `?chapterNumber=`.

**`GET /api/projects/:id/outline/chapters/:chapterId`**

Returns single `ChapterOutline` in camelCase. Does not include `planned_reveals.planning_truth` (chapter rows have no reveal truth).

**`PATCH /api/projects/:id/outline/chapters/:chapterId`**

Editable when `outline_plans.status` is not `locked`. If plan `locked` → `409 CONFLICT` (`Outline plan is locked; chapter outlines cannot be edited`). GET still allowed when locked.

Allowed fields: `title`, `summary`, `purpose`, `chapterFunction`, `emotionalDirection`, `hook`, `endingHook`, `miniVictory`, `status`, `markers`, `metadata` (light JSON, max 4KB).

Validation: non-empty `title`/`summary` when provided; enum checks for `chapterFunction`, `emotionalDirection`, `status`; `markers` max 20 items with valid `RetentionMarkerType`.

**Canon guardrails:** PATCH does not mutate `facts`, `characters`, `speech_rules`, `foundation`, `open_loops`, `planned_reveals`, or create prose.

**Audit:** No `audit_logs` for chapter outline edits in Task 4.3 (`audit_action` extension deferred).

### Open loop & planned reveal routes (Task 4.4)

All tracking endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + resource `project_id` / `outline_plan_id` match — cross-user → `404`.

**Not canon:** Open loops and planned reveals are planner-only tracking. No writes to `facts`, `characters`, `speech_rules`, `story_foundations`, or `ai_proposals`. No prose generation.

**Locked plan guard:** When `outline_plans.status=locked`, POST/PATCH/DELETE for open loops and planned reveals → `409 CONFLICT`. GET still allowed.

**`planningTruth` redaction policy:** Default GET list and all POST/PATCH/DELETE responses for reveals use `mapPlannedRevealPublic` — `planningTruth` is **never** returned. Each reveal includes `planningTruthRedacted: true`. List response also includes top-level `planningTruthRedacted: true`. Raw truth is accepted on POST/PATCH body only (planner input); no `includeTruth` query param in Task 4.4.

**`GET /api/projects/:id/outline/open-loops`**

Returns `{ ok: true, data: { openLoops: OpenLoop[] } }` ordered by `created_at` asc. If no outline plan → `200` with `openLoops: []`. Optional filter: `?status=opened|developed|paid_off|dropped`.

**`POST /api/projects/:id/outline/open-loops`**

Required: `question` (non-empty). Optional: `readerFacingHint`, `openedInChapterOutlineId`, `payoffChapterOutlineId`, `status`, `importance`, `metadata` (light JSON). Chapter refs must belong to same project and outline plan.

**`PATCH /api/projects/:id/outline/open-loops/:loopId`**

Allowed: `question`, `readerFacingHint`, `openedInChapterOutlineId`, `payoffChapterOutlineId`, `status`, `importance`, `metadata`. Rejects identity/prose fields.

**`DELETE /api/projects/:id/outline/open-loops/:loopId`**

Soft delete only — sets `status=dropped` (no hard delete).

**`GET /api/projects/:id/outline/reveals`**

Returns `{ ok: true, data: { reveals: PlannedRevealPublic[], planningTruthRedacted: true } }`. Optional filters: `?status=`, `?riskLevel=`. No `planningTruth` in response.

**`POST /api/projects/:id/outline/reveals`**

Required: `title`, `planningTruth` (stored but not returned). Optional: `readerFacingHint`, `plannedChapterOutlineId`, `relatedFactId`, `relatedProposalId`, `forbiddenBeforeChapter` (>0), `status`, `riskLevel`, `metadata`. Related fact/proposal must belong to same project.

**`PATCH /api/projects/:id/outline/reveals/:revealId`**

Same editable fields as POST (all optional on PATCH). Response redacted.

**`DELETE /api/projects/:id/outline/reveals/:revealId`**

Soft delete only — sets `status=cancelled`.

**Canon guardrails:** Tracking CRUD does not mutate canon tables, create proposals, or expose raw `planningTruth` in default responses.

**Audit:** No `audit_logs` for tracking edits in Task 4.4.

### Outline approve & lock workflow (Task 4.5)

All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` — cross-user → `404`.

**Not canon / not prose:** Approve and lock only update `outline_plans`, `chapter_outlines.status`, and `projects.workflow_phase`. No writes to `facts`, `characters`, `speech_rules`, `story_foundations`, `open_loops`, `planned_reveals`, or prose. `planningTruth` remains redacted in all GET responses.

**`POST /api/projects/:id/outline/approve`**

Preconditions (409 if fail):

- Outline plan exists
- Plan status is not `locked`
- At least one `chapter_outlines` row
- Every chapter has non-empty `title`, `summary`, and `endingHook` or `hook`

Action:

- Sets `outline_plans.status = reviewing`
- Sets passing chapters to `status = approved` (skips already `locked` chapters)
- Does **not** lock the plan

Returns `200`:

```json
{
  "ok": true,
  "data": {
    "outlinePlan": { "status": "reviewing", "..." : "..." },
    "chapters": [],
    "checks": [{ "key": "...", "label": "...", "status": "pass", "reason": "..." }],
    "canLock": true
  }
}
```

`canLock` uses the same readiness calculator as lock (foundation locked, full chapter count, mini victory cadence, open loops ≥2, reveals ≥2, etc.).

**`POST /api/projects/:id/outline/lock`**

Preconditions (409 with `checks`, `missing`, `failedChecks` if fail):

| Check key | Requirement |
|---|---|
| `foundationLocked` | `story_foundations.is_locked = true` |
| `outlineExists` | Outline plan present |
| `notAlreadyLocked` | Plan status ≠ `locked` |
| `chapterCount` | Chapter count ≥ `target_chapter_count` (default 10) |
| `allChaptersHaveBasics` | title, summary, purpose, chapterFunction, hook per chapter |
| `hooksEveryChapter` | endingHook, hook, or retention marker per chapter |
| `summariesEveryChapter` | Non-empty summary per chapter |
| `miniVictoryCadence` | ≥3 chapters with `miniVictory` or `mini_victory` marker |
| `openLoopsEnough` | ≥2 active open loops (not `dropped`) |
| `plannedRevealsEnough` | ≥2 active planned reveals (not `cancelled`) |
| `noPlanningTruthExposed` | API policy — always pass |

On success:

- `outline_plans.status = locked`, `locked_at = now()`
- All `chapter_outlines.status = locked`
- `projects.workflow_phase = outline_locked`

Returns `200` with `{ outlinePlan, chapters, checks, locked: true }`.

**Idempotency:** Already locked → `409` (`Outline is already locked`) for both approve and lock. GET outline/chapters/loops/reveals still work when locked. PATCH chapter and POST/PATCH/DELETE loops/reveals return `409` (Tasks 4.3–4.4).

**Audit:** No outline-specific `audit_logs` in Task 4.5 (`audit_action` extension deferred).

### Context Packet Builder (Task 5.2)

All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` — cross-user → `404`.

**Not canon / not prose / not AI:** Context packet build is read-only against canon and outline tables. Persists `context_packet_logs` only. Does **not** write `facts`, `characters`, `speech_rules`, `story_foundations`, `chapter_outlines`, `chapter_prose_versions`, or call OpenRouter/AI.

**Gate (409 `details.missing`):**

| Missing key | Requirement |
|---|---|
| `outline_locked` | `projects.workflow_phase` is `outline_locked` or `writing` |
| `outline_plan_locked` | `outline_plans.status = locked` |
| `foundation_locked` | `story_foundations.is_locked = true` |

**`POST /api/projects/:id/write/context-packet`**

Body:

```json
{ "chapterOutlineId": "uuid", "beatId": "optional-uuid" }
```

- Builds `WriterContextPacket` **server-side** (does not use GET outline bundle as source).
- `planned_reveals` SELECT excludes `planning_truth`.
- Runs `assertWriterPacketSafe` before insert — unsafe packet → `500`, no log row.
- Persists `context_packet_logs` (`writing_session_id` null in Task 5.2).
- Returns **preview only** (not `packetJson`):

```json
{
  "ok": true,
  "data": {
    "packetLogId": "...",
    "preview": { "chapterNumber": 1, "chapterTitle": "...", "direction": "...", "packetLogId": "..." },
    "safety": {
      "planningTruthPresent": false,
      "futureChapterSummaryPresent": false,
      "packetHash": "...",
      "builderVersion": "context_packet_v1_stub"
    }
  }
}
```

**`GET /api/projects/:id/write/context-packet/:logId/preview`**

- Owner-only; returns redacted `preview` from stored `packet_json`.
- Does **not** return raw `packetJson` or `planningTruth`.

**Writer boundary:** Packet is slice-only — current chapter outline, previous summaries `< N`, safe breadcrumbs from `reader_facing_hint`, forbidden reveals for future chapters. No full outline dump, no future chapter summaries, no raw `planning_truth`.

### Writing Session & Chapter Beat API (Task 5.3)

All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + session/beat `project_id` match — cross-user → `404`.

**Not canon / not prose / not AI:** Sessions and beats are write-room scaffolding only. Does **not** write `facts`, `characters`, `speech_rules`, `story_foundations`, `chapter_outlines`, or `chapter_prose_versions` (Task 5.3). No OpenRouter, no AI generation, no context packet auto-build on beat generate.

**Gate (409 `details.missing`):** Same as Task 5.2 — `outline_locked` or `writing` workflow phase, locked outline plan, locked foundation.

**`POST /api/projects/:id/write/sessions`**

Body:

```json
{ "chapterOutlineId": "uuid", "activeBeatId": "optional-uuid" }
```

- Start or resume **active** session for `project_id` + `chapterOutlineId`.
- Idempotent: existing active session → `200` with same session (no duplicate).
- New session → `201`, upserts `chapter_writing_states` (`status=drafting`), optionally sets `projects.workflow_phase=writing` when previously `outline_locked`.
- Does not create prose or mutate canon/outline content.

Returns `{ session, writingState }`.

**`GET /api/projects/:id/write/sessions/:sessionId`**

Returns `{ session, writingState, chapterOutline, activeBeat, beatsCount }`. Chapter outline is safe summary only (no `planningTruth`, no context packet JSON, no prose versions).

**`PATCH /api/projects/:id/write/sessions/:sessionId`**

Allowed: `status` (`active` | `paused` | `abandoned`), `activeBeatId`, light `metadata`.

Rejected: `ready_for_summary` (use dedicated endpoint), `projectId`, `chapterOutlineId`, `contextPacketJson`, `proseText`, `planningTruth`.

**`POST /api/projects/:id/write/sessions/:sessionId/ready-for-summary`**

- Requires ≥1 beat for the chapter.
- Sets `writing_sessions.status=ready_for_summary`, `ready_for_summary_at=now()`, `chapter_writing_states.status=ready_for_summary`.
- **Marker only** — no chapter summary, no canon update (Sprint 6 handoff).

**`GET /api/projects/:id/write/sessions/:sessionId/beats`**

Returns `{ beats: ChapterBeat[] }` ordered by `sort_order` / `beat_number`. Empty array `200` when no beats.

**`POST /api/projects/:id/write/sessions/:sessionId/beats/generate`**

Optional body: `{ "regenerate": false }`.

- Deterministic stub generator (5 beats, parity Bab 1 seed/mock).
- `regenerate=false` (default): returns existing beats for chapter if any.
- `regenerate=true`: replaces beats only when no `chapter_prose_versions` exist for those beats; otherwise `409`.
- Links `writing_session_id` on generated/linked beats. Does not auto-build context packet.

**`PATCH /api/projects/:id/write/beats/:beatId`**

Allowed: `title`, `summary`, `direction`, `status` (`empty` | `draft` | `done`), `emotionalShift`, `mustInclude`, `mustNotInclude`, `wordTarget`, `stopCondition`, `sortOrder`, light `metadata`.

Rejected: `proseText`, `chapterText`, `body`, `planningTruth`, `contextPacketJson`, identity fields. Updates `writing_sessions.last_activity_at` when beat is linked to a session.

### Prose Draft Persistence API (Task 5.4)

All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + beat/version `project_id` match — cross-user → `404`.

**Draft only — not canon:** Prose versions are stored in `chapter_prose_versions` only. Does **not** write `facts`, `characters`, `speech_rules`, `story_foundations`, `chapter_outlines`, or create chapter summaries. No OpenRouter, no AI generation, no prose-to-fact parsing.

**Gate (409):**

| Requirement | Detail |
|---|---|
| Write room gates | Same as Task 5.2/5.3 (`outline_locked`/`writing`, locked plan, locked foundation) |
| Writing session | Active or paused session required for beat's `chapter_outline_id` — else `409` `Writing session required` |

**`GET /api/projects/:id/write/beats/:beatId/prose`**

Returns `{ versions: ChapterProseVersion[], currentVersion: ChapterProseVersion | null }` ordered by `versionNumber` desc. Does not return `context_packet_logs.packet_json` — only `contextPacketLogId` on version rows when linked.

**`POST /api/projects/:id/write/beats/:beatId/prose`**

Body:

```json
{
  "proseText": "required",
  "source": "user_edited",
  "contextPacketLogId": "optional-uuid",
  "metadata": {}
}
```

- `proseText` — non-empty, max 30_000 chars.
- `source` — `user_edited` (default) or `stub_deterministic`. `ai_generated` → `400` (`ai_generated source is reserved`).
- Versioning: `version_number = max + 1`; previous versions `is_current=false`; new version `is_current=true`.
- Updates `chapter_beats.status`: `empty` → `draft`; `draft`/`done` preserved.
- Recomputes `chapter_writing_states.word_count` as sum of current prose word counts across all beats in chapter; sets `last_saved_at`.
- Touches `writing_sessions.last_activity_at`.

Returns `201` `{ version, chapterWordCount }`.

**Content safety (400):** Rejects internal leakage markers in `proseText` (`planningTruth`, `full_prompt`, `packet_json`, `openrouter`, `provider`, `model`, `token`, etc.) and JSON packet dumps containing `currentChapter` + `revealGate` + `forbiddenReveals`. Normal fictional secrets in prose are allowed.

**Metadata safety:** Rejects `full_prompt`, `packet_json`, `planningTruth`, `model`, `provider`, `token`, raw AI payloads.

**`GET /api/projects/:id/write/prose/:versionId`**

Returns `{ version: ChapterProseVersion }` — owner-only, no context packet JSON.

**`POST /api/projects/:id/write/prose/:versionId/make-current`**

Sets selected version `is_current=true`, clears other current versions for same beat, recomputes chapter word count. Does not mutate canon.

**Deferred Task 5.4:** WritePage integration, OpenRouter, AI generation, full validator, chapter summary/canon update.

### Chapter Summary Generation API (Task 6.2)

All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + row `project_id` match — cross-user → `404`.

**Summary artifact — not canon:** `chapter_summaries` and `chapter_summary_items` are review documents only. Does **not** write `facts`, `characters`, `speech_rules`, `open_loops`, `planned_reveals`, or create `ai_proposals` / `chapter_deltas`. Does **not** mark `chapter_writing_states.summarized` or approve summary. No OpenRouter, no AI generation.

**Gate (409) for `POST .../summary/generate`:**

| Requirement | `details.missing` |
|---|---|
| `writing_sessions.status = ready_for_summary` | `session_ready_for_summary` |
| `chapter_writing_states.status = ready_for_summary` | `chapter_ready_for_summary` |
| ≥1 current prose version on a beat | `current_prose_required` |
| Locked outline plan | `outline_plan_locked` |
| Locked foundation | `foundation_locked` |
| Write room phase gates | `outline_locked` (via shared gate) |

**`POST /api/projects/:id/summary/generate`**

Body:

```json
{
  "chapterOutlineId": "required-uuid",
  "writingSessionId": "optional-uuid",
  "regenerate": false
}
```

- Deterministic stub (`summary_stub_v1`) from current prose + beat metadata + chapter outline fields.
- `regenerate=false` + current summary exists → returns existing (`created=false`, `200`).
- `regenerate=true` → supersedes current (`is_current=false`, `status=superseded`), inserts `summary_version+1`.
- `regenerate=true` on `approved` summary → `409`.
- Prose with internal leak markers → `400` (no summary insert).
- Returns `{ summary, items, created }` — no raw `proseText`, no `planningTruth`, no `packet_json`.

**`GET /api/projects/:id/summary`**

Query: `chapterOutlineId`, `status`. Default: current summaries (`is_current=true`) with `itemCount`. Ordered by `chapterNumber`.

**`GET /api/projects/:id/summary/:summaryId`**

Returns `{ summary, items }` — owner-only, no prose text.

**`GET /api/projects/:id/summary/by-chapter/:chapterOutlineId`**

Returns current summary for chapter or `{ summary: null, items: [] }`.

### Chapter Delta + Proposal Extraction API (Task 6.3)

Extends summary route group. All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + row `project_id` match — cross-user → `404`.

**Delta + proposals — not canon:** `chapter_deltas` and linked `ai_proposals` are review queue artifacts only. Does **not** mutate `facts`, `characters`, `speech_rules`, `open_loops`, `planned_reveals`, or accept proposals. Does **not** approve summary. No OpenRouter, no AI generation.

**Gate (409) for `POST .../summary/:summaryId/delta/extract`:**

| Requirement | `details.missing` |
|---|---|
| Summary status `generated` or `reviewing` | `summary_not_extractable` |
| Summary not `approved` | `summary_approved` |
| ≥1 summary item | `summary_no_items` |
| `regenerate=true` with existing linked proposals | `linked_proposals_exist` |

**`POST /api/projects/:id/summary/:summaryId/delta/extract`**

Body: `{ "regenerate": false }`

- Deterministic stub extractor (`chapter_delta_v1_stub`) from summary + items.
- Creates `chapter_deltas` row (1:1 per summary) + `ai_proposals` (`status=proposed`, `source=chapter_delta_stub`) + `chapter_summary_proposals` (`status=linked`).
- Candidate types: `new_fact_candidate` → `fact`; `character_change` → `character_update`; `relationship_change` → `relationship_update`; open loop items → `open_loop_update`; `reveal_candidate` → `reveal_status_update`.
- Max 5 proposals per extraction. Skips synopsis/emotional_outcome/ending_hook items.
- `regenerate=false` + delta exists → returns existing (`created=false`, `200`).
- `regenerate=true` + linked proposals exist → `409` (no supersede in Task 6.3).
- Returns `{ delta, proposals, created }` — no `proseText`, no `planningTruth`, no `packet_json`.

**`GET /api/projects/:id/summary/:summaryId/delta`**

Returns `{ delta }` — safe `deltaJson` only, owner-only.

**`GET /api/projects/:id/summary/:summaryId/proposals`**

Returns `{ proposals }` — linked proposal excerpts (`linkId`, `type`, `status`, `riskLevel`, `title`, safe `payloadExcerpt`). No auto-promotion.

**Deferred Task 6.3:** summary approval, proposal promotion/canon accept, SummaryPage integration, delta regenerate with proposal supersede.

### Summary Approval + Proposal Promotion API (Task 6.4)

Extends summary route group. All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + linked row `project_id` match — cross-user → `404`.

**Summary approval ≠ canon promotion:** Approving summary marks lifecycle only (`chapter_summaries.approved`, `chapter_writing_states.summarized`, `writing_sessions.completed`). Does **not** accept proposals or mutate `facts`/`characters`/etc.

**`POST /api/projects/:id/summary/:summaryId/approve`**

- Gate: summary `generated` or `reviewing`, ≥1 item. Already `approved` → idempotent `200` (`alreadyApproved=true`).
- Allows approval without delta/proposals (returns `warnings` array).
- Does not accept proposals or promote canon.

**`POST /api/projects/:id/summary/:summaryId/proposals/:proposalId/accept`**

- Gate: summary `approved`, proposal `proposed`, link `linked`.
- Body (optional): `{ "confirmHighRisk": true }` — **required** for `reveal_status_update`.
- Promotes canon by type, then sets `ai_proposals.status=accepted` + `chapter_summary_proposals.status=accepted`.
- Order: preflight → promote canon → `canon_promotion_applied` → mark accepted; on status failure compensate newly created canon + `canon_promotion_failed` (transaction-like, not DB RPC).
- `fact` → creates `facts` row (`source=accepted_proposal`, `canon_status=confirmed`); duplicate exact text returns existing.
- `character_update` → appends safe note to `characters.description` when `targetEntityId` + `changeSummary` present; else `409 unsupported_promotion`.
- `relationship_update` → creates `relationship_speech_rules` only when full payload present; else `409`.
- `open_loop_update` → creates `open_loops` or updates status `paid_off` when `targetEntityId` provided.
- `reveal_status_update` → updates `planned_reveals.status` only with `confirmHighRisk=true` + `targetEntityId`; else `409`.
- Returns `{ proposal, promoted, alreadyAccepted }`.

**`POST /api/projects/:id/summary/:summaryId/proposals/:proposalId/reject`**

- Body (optional): `{ "reason": "..." }`.
- Sets `ai_proposals.status=rejected` + `chapter_summary_proposals.status=rejected`. No canon mutation.
- Accepted proposal → `409 cannot_reject_accepted`. Already rejected → idempotent `200`.

### Publish Package Generation API (Task 7.2)

Route group: `apps/api/src/routes/publish.ts`. All endpoints require Bearer JWT. Ownership via `getOwnedProjectRow` + row `project_id` match — cross-user → `404`.

**Export artifact — not canon:** `publish_packages` are KBM copy-paste assets only. Does **not** mutate `facts`, `characters`, `speech_rules`, `open_loops`, `planned_reveals`, `chapter_summaries`, or create `ai_proposals`. Does **not** auto-post to KBM. No OpenRouter, no AI generation, no credit deduction.

**Gate (409) for `POST .../publish/generate`:**

| Requirement | `details.missing` |
|---|---|
| `chapter_summaries.status = approved` | `summary_approved` |
| `chapter_summaries.is_current = true` | `current_summary_required` |
| `chapter_writing_states.status = summarized` | `chapter_summarized` |

**`POST /api/projects/:id/publish/generate`**

Body: `{ "chapterOutlineId": "uuid", "chapterSummaryId?": "uuid", "regenerate": false }`

- Deterministic stub (`publish_stub_v1`) from approved summary + prose excerpt (≤280 chars) + safe next-chapter hook slice.
- `regenerate=false` + current package exists → returns existing (`created=false`, `200`).
- `regenerate=true` → prior current row `is_current=false`; status `superseded` unless prior was `exported` (exported rows keep `exported` status).
- Unsafe leak markers in generated fields → `400` (`unsafe_content`) — no insert.
- Returns `{ publishPackage, created }` — no raw `proseText`, no `planningTruth`, no `packet_json`, no `delta_json`.

**`GET /api/projects/:id/publish`**

Query: `?chapterOutlineId=`, `?status=`. Default lists `is_current=true` packages ordered by `chapterNumber`.

**`GET /api/projects/:id/publish/:packageId`**

Returns `{ publishPackage }` — owner-only copy fields.

**`GET /api/projects/:id/publish/by-chapter/:chapterOutlineId`**

Returns `{ publishPackage }` or `{ publishPackage: null }` when none exists. Missing chapter outline → `404`.

### Publish Package Update / Export Marker API (Task 7.3)

Extends `apps/api/src/routes/publish.ts` and `publish-package-update.ts`. All endpoints require Bearer JWT. Cross-user → `404`.

**Exported package lock:** `status = exported` packages reject `PATCH .../fields` and `PATCH .../checklist` with `409` (`exported_package_locked`). Regenerate a new version via `POST .../generate?regenerate=true` (Task 7.2).

**`PATCH /api/projects/:id/publish/:packageId/fields`**

Partial update of copy-ready fields: `displayTitle`, `teaser`, `shortSynopsis`, `caption`, `readerQuestion`, `nextChapterTeaser`, `tags`, `genre`, `mobilePreviewExcerpt`.

- Rejects immutable keys (`status`, `packageVersion`, `isCurrent`, `generatorVersion`, `metadata`, `safetyFlags`, etc.).
- Length limits enforced; non-empty required when field is sent.
- Rejects leak markers and overclaim copy (`dijamin viral`, `pasti viral`, `dijamin unlock`, `pasti banyak pembaca`).
- Returns `{ publishPackage }` — no canon mutation.

**`PATCH /api/projects/:id/publish/:packageId/checklist`**

Body: `{ "items": [{ "id": "chk_teaser", "label?": "...", "checked": true, "note?": "..." }, ...] }` — exactly 5 allowed ids.

- Normalizes to fixed MVP checklist array in `checklist_json`.
- Rejects unknown ids, duplicates, leak markers in label/note.
- Exported packages → `409 exported_package_locked`.

**`POST /api/projects/:id/publish/:packageId/mark-exported`**

Body: `{ "exportTarget": "kbm_manual_copy", "note?": "..." }`

- **Manual-copy marker only** — no KBM API call, no external network, no canon mutation.
- Requires `status` `ready` or `draft`; sets `status=exported`, `exported_at=now()`, merges `metadata.exportTarget` / `exportNote`.
- Returns `{ publishPackage, alreadyExported, warnings }` — `warnings` may include `checklist_incomplete` (non-blocking MVP).
- Idempotent when already `exported` → `alreadyExported=true`.

**Deferred Task 7.3:** PublishPage integration, KBM auto-post.

Local smoke: `npm run smoke:api:sprint6` (`scripts/sprint6-smoke-api.ps1`), `npm run smoke:api:sprint7` (`scripts/sprint7-smoke-api.ps1`).

### Safety smoke tests (Task 5.6)

Local verification script: `scripts/sprint5-smoke-api.ps1` (run with `supabase start`, `supabase db reset`, `npm run dev:api`).

| Check | Expectation |
|---|---|
| Context packet POST/GET preview | Preview + safety metadata only — no `packetJson`, `planning_truth`, `full_prompt`, provider/model/token keys |
| `context_packet_logs.packet_json` (DB) | Same leak guard; ch1 packet excludes ch2+ title/summary; forbidden reveals as labels only |
| Prose POST | Rejects `planningTruth` and packet dumps; allows normal fictional secret prose |
| Prose GET responses | No raw context packet JSON |
| `ready_for_summary` | Sets `ready_for_summary` status only — not `summarized`; no fact/outline mutation |

Web E2E leak guard: `npm run smoke:web:write` (mock default); `npm run smoke:web:write -- -IncludeApiMode` for API-mode DOM checks.

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
| `AI_GENERATION_ENABLED` | Optional | Default false — see § AI model router shell |
| `AI_PROVIDER_MOCK` | Optional | Local mock provider |
| `OPENROUTER_API_KEY` | When AI live | Server only — never client |

## Not in Task 2.12

- `POST /api/auth/*` — use Supabase Auth client in browser instead
- Canon auto-promotion on accept (Task 2.11b / Sprint 3)
- OpenRouter / AI generation
- Credit deduction / ledger / top-up / payment
- `PATCH /api/credits/*` or balance auto-create for new users
- Cloudflare deploy
- Frontend wired to real data

See `docs/27-sprint-2-data-model-implementation-plan.md` Task 2.13+.