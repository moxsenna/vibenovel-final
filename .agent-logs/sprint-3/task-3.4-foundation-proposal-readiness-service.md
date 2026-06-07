# Task 3.4 — Foundation Proposal + Readiness Service

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Membuat API/service untuk foundation proposal batch deterministik dari selected concept + signals, menyimpan ke `ai_proposals`, menghitung readiness server-side. Tanpa lock foundation, tanpa canon promotion, tanpa OpenRouter/AI.

## Files read

- `README.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `docs/29-sprint-2-verification-report.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/migrations/00002_sprint3_intake_concepts.sql`
- `supabase/seed.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/api/src/services/ai-proposal.ts`
- `apps/api/src/services/foundation.ts`
- `apps/api/src/services/concept.ts`
- `apps/api/src/services/intake.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/foundation-proposal.ts` | Created — stub batch generator + list |
| `apps/api/src/services/foundation-readiness.ts` | Created — readiness calculator |
| `apps/api/src/routes/foundation.ts` | Updated — 3 new endpoints |
| `apps/api/README.md` | Updated — Task 3.4 docs |
| `.agent-logs/sprint-3/task-3.4-foundation-proposal-readiness-service.md` | Created (log ini) |

**Tidak diubah:** web, migrations, shared package, accept/promotion logic, lock workflow.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| Manual Task 3.4 runtime test | PASS |

## Results

### Runtime verification

| Check | Result |
|---|---|
| GET readiness tanpa token | 401 |
| POST generate tanpa selected concept | 400 |
| POST generate (after select) | 201, 11 proposals, `created=true` |
| GET foundation/proposals | 11 proposed |
| GET readiness | score=74, `canLock=false`, level=`bisa_lanjut` |
| Canon characters/facts | 0→0 (tidak bertambah) |
| regenerate=false second call | `created=false` |
| Cross-user seed project | 404 |

## Decisions

1. **Batch marker** `payload.generator=foundation_stub_batch` untuk dedupe/regenerate.
2. **Source** `system_seed` untuk stub proposals (bukan `ai_foundation`).
3. **11 proposals** per batch: foundation + protagonist + 2–3 facts + style + optional supporting chars + speech rule + secret (jika sinyal).
4. **regenerate=true** reject proposed stub batch dengan `review_note=regenerated`.
5. **Readiness** update `story_foundations.readiness_percent/status` only — tidak copy proposal ke canon fields.
6. **canLock** score ≥75 + core checks complete; lock endpoint deferred 3.5.
7. **No batch audit** — hindari spam audit_logs; manual `POST /proposals` tetap audit via `ai-proposal.ts`.

## Limitations

- Tidak ada canon promotion pada accept (masih status-only dari 2.11).
- Lock foundation endpoint belum ada (Task 3.5).
- Readiness weights heuristic — bukan formula final produk.
- Batch generator tidak membaca `intake_messages` verbatim (signals + concept cukup untuk stub).
- `audit_action` enum tidak diperluas.
- Sprint 2 smoke tidak cover foundation proposal endpoints.

## Next recommended task

**Task 3.5 — Lock foundation workflow** (`POST /foundation/lock`, `canLock` gate enforcement, core field guards).