# Task 2.10 — Relationship Speech Rules API

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed

## Task goal

Membuat API persistence untuk aturan panggilan dan gaya bicara (`relationship_speech_rules`) — manual CRUD dengan ownership guard, character ref validation, AI source rejection, soft deactivate.

## Files read

- `README.md`
- `docs/27-sprint-2-data-model-implementation-plan.md`
- `docs/28-supabase-rls-policy-draft.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/seed.sql`
- `apps/api/README.md`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/services/foundation.ts`
- `apps/api/src/services/character.ts`
- `apps/api/src/services/fact.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/lib/mappers.ts`
- `packages/shared/src/domain.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/api.ts`
- `.agents/rules/09-agent-work-logs.md`
- `.agent-logs/sprint-2/task-2.9-foundation-characters-facts-api.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/speech-rule.ts` | Created — list/create/update/deactivate |
| `apps/api/src/routes/speech-rules.ts` | Created — 4 endpoints |
| `apps/api/src/routes/index.ts` | Register speech rule routes |
| `apps/api/src/lib/mappers.ts` | `SpeechRuleRow` mapper + response aliases |
| `apps/api/README.md` | Speech rules documentation |
| `.agent-logs/sprint-2/task-2.10-relationship-speech-rules-api.md` | Created (log ini) |

**Tidak diubah:** migrations, seed, `apps/web`, AI proposals, foundation bundle.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm install` | tidak dijalankan |
| `GET speech-rules` tanpa token | PASS — 401 |
| `GET speech-rules` dengan JWT | PASS — 200 |
| `POST speech-rule` valid | PASS — 201 |
| `PATCH speech-rule` | PASS — 200 |
| `POST source=ai_direct` | PASS — 400 |
| `POST source=openrouter` | PASS — 400 |
| `DELETE speech-rule` | PASS — `status: deprecated` |
| Seed project cross-user | PASS — 404 |
| CharacterId project lain | PASS — 400 |
| `git push` / remote deploy / migration push | tidak dijalankan |

## Results

- 4 endpoint speech-rules protected auth.
- Default list: `status = active`; `?includeInactive=true` includes draft/deprecated.
- POST source hanya `user`; AI/provider ditolak.
- Character IDs divalidasi terhadap `project_id`.
- DELETE soft deactivate (`status: deprecated`), bukan hard delete.
- Audit: `speech_rule_created`, `speech_rule_updated` (deactivate: `reason: deactivate`).

## Decisions

1. **Field mapping:** `fromCharacterId`→`character_a_id`, `speechStyle`/`addressTerm`→`rule_text`, names/IDs→`relationship_label`.
2. **`addressTerm` + `speechStyle`:** Digabung ke `rule_text` dengan format "Panggilan: … Gaya bicara: …".
3. **DELETE:** `status: deprecated` (enum schema `speech_rule_status`).
4. **`accepted_proposal` source:** Ditolak pada POST manual (Task 2.11 workflow).
5. **`metadata` body:** Ditolak — tidak ada kolom di schema.

## Limitations

- `addressTerm` tidak disimpan terpisah; tergabung di `ruleText`.
- AI proposal acceptance belum terhubung.
- Frontend belum wired ke API.
- Tidak ada automated integration test file.

## Next recommended task

**Task 2.11 — AI Proposal Queue API** (manual workflow: list/create/accept/reject/merge proposals).