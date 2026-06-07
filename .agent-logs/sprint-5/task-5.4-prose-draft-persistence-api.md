# Task 5.4 — Prose Draft Persistence API

## Task goal

Implement Sprint 5 Task 5.4: API untuk menyimpan draft prose per beat dengan versioning di `chapter_prose_versions`. Manual/stub persistence only — no OpenRouter, no AI, no WritePage, no canon/summary update.

## Files read

- README.md
- docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md
- docs/33-sprint-4-verification-report.md
- supabase/migrations/00004_sprint5_write_room.sql
- packages/shared/src/enums.ts
- packages/shared/src/domain.ts
- apps/api/src/services/context-packet-builder.ts
- apps/api/src/services/write-session.ts
- apps/api/src/services/chapter-beat.ts
- apps/api/src/routes/write.ts
- apps/api/src/lib/mappers.ts
- apps/api/src/middleware/auth.ts
- apps/api/README.md
- scripts/sprint5-smoke-api.ps1
- .agents/rules/09-agent-work-logs.md

## Files created/changed

| Path | Note |
|---|---|
| `apps/api/src/services/prose-draft.ts` | **Created** — list/save/get/make-current prose versions |
| `apps/api/src/routes/write.ts` | **Extended** — 4 prose endpoints |
| `apps/api/src/lib/mappers.ts` | **Extended** — `ChapterProseVersionRow` + `mapChapterProseVersionRow` |
| `apps/api/README.md` | **Updated** — Task 5.4 docs |
| `scripts/sprint5-smoke-api.ps1` | **Extended** — 11 prose smoke steps; ready-for-summary moved after prose |

## Commands run

```bash
npm run typecheck:api          # PASS
npm run typecheck              # PASS
npm run build:shared           # PASS
npm run build:web              # PASS
npm run build:api              # PASS
npm run smoke:api              # PASS (17/17)
powershell -File scripts/sprint5-smoke-api.ps1  # PASS (38/38)
```

## Results

| Check | Result |
|---|---|
| typecheck:api | PASS |
| typecheck | PASS |
| build:shared/web/api | PASS |
| smoke:api | PASS 17/17 |
| sprint5-smoke-api.ps1 | PASS 38/38 |

Runtime (sprint5 smoke prose section):

- POST prose no token → 401
- POST prose after session abandoned → 409 Writing session required
- POST prose v1 → version 1 current
- POST prose v2 with contextPacketLogId → version 2 current, v1 non-current
- GET versions → 2 versions
- GET version detail → 200
- ai_generated source → 400
- planningTruth in prose → 400
- context packet JSON dump → 400
- Canon counts unchanged

## Decisions

1. **Session gate:** Require `active` or `paused` writing session for beat's `chapter_outline_id`; else `409` `details.missing: ["writing_session"]`.
2. **Versioning:** `version_number = max + 1`; clear `is_current` on beat before insert; unique partial index enforces one current per beat.
3. **Word count:** Sum of `word_count` on `is_current=true` versions across all beats in chapter; upsert `chapter_writing_states`.
4. **Beat status:** `empty` → `draft` on first save; `draft`/`done` preserved.
5. **Source:** Default `user_edited`; `ai_generated` → `400` reserved message.
6. **Content safety:** Leakage marker substring check + packet dump heuristic (`currentChapter` + `revealGate` + `forbiddenReveals`).
7. **make-current:** Implemented — recomputes chapter word count without canon mutation.
8. **No packet_json exposure:** SELECT excludes `packet_json`; only `contextPacketLogId` on version rows.

## Limitations

- No delete endpoint for prose versions.
- No WritePage integration, OpenRouter, AI generation, full validator.
- No chapter summary / canon update / summarized status.
- Leakage marker check on `model`/`token`/`provider` may false-positive on rare prose (spec-required).
- No DB transaction wrapper across version insert + state updates.
- `ready_for_summary` session blocks further prose saves (by design — session no longer active/paused).

## Next recommended task

**Task 5.5 — WritePage integration** (or next item per sprint plan): wire frontend Write Room to session/beat/prose APIs with mock fallback removal, still no OpenRouter until explicitly scheduled.