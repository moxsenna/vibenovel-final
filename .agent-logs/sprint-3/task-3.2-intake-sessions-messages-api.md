# Task 3.2 — API Intake Sessions & Messages

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Membuat API persistence untuk intake sessions, intake messages, detected signals, dan agent-reply stub deterministik. Tanpa concept API, OpenRouter, AI production, atau web integration.

## Files read

- `README.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `docs/29-sprint-2-verification-report.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/migrations/00002_sprint3_intake_concepts.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/intake.ts` | Created — intake/session/message/signal services + stub extractor |
| `apps/api/src/routes/intake.ts` | Created — 7 endpoints |
| `apps/api/src/routes/index.ts` | Updated — register intake routes |
| `apps/api/src/lib/mappers.ts` | Updated — IntakeSession/Message/DetectedSignal mappers |
| `apps/api/README.md` | Updated — intake endpoints + guardrails |
| `.agent-logs/sprint-3/task-3.2-intake-sessions-messages-api.md` | Created (log ini) |

**Tidak diubah:** web, migrations, shared package, smoke script, credit/proposal/foundation services.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| Manual intake API runtime test (PowerShell) | PASS — see Results |

## Results

### Build / smoke

- All typecheck and build commands PASS.
- `smoke:api` Sprint 2 regression: 17 PASS, 0 FAIL.

### Runtime intake verification (local API + Supabase)

| Check | Result |
|---|---|
| GET intake tanpa token | 401 |
| POST intake (owner) | 201, session `active` / `idea_collection` |
| GET intake (owner) | 200, auto session |
| POST message | 201, `user` + `agent` stub, progress updated |
| GET messages | 200, count includes both messages |
| POST extract-signals | 200, 5 signals (genre, relationship_dynamic, tone, reader_promise, target_reader) |
| GET signals | 200, 5 signals |
| Seed project cross-user | 404 |

## Decisions

1. **Single service file** `intake.ts` — tidak dipecah ke 3 file (cukup ~500 baris, masih terbaca).
2. **Agent reply** dibuat otomatis di `POST .../messages` — tidak ada endpoint `agent-reply` terpisah (sesuai scope Task 3.2 user).
3. **PATCH signals** disertakan — kecil, owner-only, update status saja.
4. **POST intake reset** — update session aktif in-place (progress 0, phase reset); tidak hapus messages lama.
5. **workflow_phase** hanya di-set ke `intake` jika aman (tidak turun dari `foundation` / `foundation_locked`).
6. **No audit_logs** — `audit_action` enum belum punya intake actions; deferred 3.2/3.3.
7. **Extract dedupe** — upsert by `type` + normalized `value` per session.

## Limitations

- Tidak ada audit log untuk intake events.
- Tidak ada endpoint terpisah `POST .../agent-reply` (agent hanya via POST messages).
- `GET intake` auto-create session bisa membuat session kosong tanpa explicit POST intake.
- Heuristic extractor sederhana — bukan NLP/AI.
- `ProjectRow` mapper belum expose `workflowPhase` / `selectedConceptId` (Task 3.3+).
- Sprint 2 smoke script belum mencakup intake endpoints (manual test saja).

## Next recommended task

**Task 3.3 — Concept Options API** (generate 3 concepts, list, select).