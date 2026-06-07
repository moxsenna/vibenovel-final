# Task 3.5 — Lock Foundation Workflow

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Membuat workflow penguncian fondasi cerita yang aman: endpoint `POST /api/projects/:id/foundation/lock`, service promotion terbatas dari accepted proposals ke canon, preconditions readiness + ownership, tanpa AI generation / frontend / unlock.

## Files read

- `README.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `docs/29-sprint-2-verification-report.md`
- `supabase/migrations/00001_sprint2_core.sql`
- `supabase/migrations/00002_sprint3_intake_concepts.sql`
- `packages/shared/src/enums.ts`
- `packages/shared/src/domain.ts`
- `apps/api/src/services/foundation.ts`
- `apps/api/src/services/foundation-proposal.ts`
- `apps/api/src/services/foundation-readiness.ts`
- `apps/api/src/services/ai-proposal.ts`
- `apps/api/src/services/character.ts`
- `apps/api/src/services/fact.ts`
- `apps/api/src/services/speech-rule.ts`
- `apps/api/src/services/concept.ts`
- `apps/api/src/services/project.ts`
- `apps/api/src/services/audit.ts`
- `apps/api/src/lib/mappers.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/README.md`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/foundation-lock.ts` | Created — lock workflow + safe promotion |
| `apps/api/src/services/foundation-readiness.ts` | Updated — `getFoundationLockReadinessForOwner` + refactor compute |
| `apps/api/src/routes/foundation.ts` | Updated — `POST .../foundation/lock` |
| `apps/api/README.md` | Updated — lock endpoint, preconditions, promotion rules |
| `.agent-logs/sprint-3/task-3.5-lock-foundation-workflow.md` | Created (log ini) |

**Tidak diubah:** web/frontend, migrations, shared package, OpenRouter, unlock, Task 3.6.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:api` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 (dijalankan 2×) |
| Manual Task 3.5 runtime test | PASS |

## Results

### Runtime verification (local Supabase + API dev)

| Check | Result |
|---|---|
| POST lock tanpa token | 401 |
| Lock tanpa selected concept | 409 `Selected concept is required` |
| Lock dengan proposals masih `proposed` | 409 + `readinessScore`, `missing`, `failedChecks` |
| Accept safe proposals + lock | 200, `isLocked=true`, `workflowPhase=foundation_locked` |
| Promoted canon | chars=3, facts=3, speechRules=1 (secret/high-risk fact skipped) |
| Lock ulang | 409 `Foundation is already locked` |
| Cross-user project | 404 `Project not found` |
| PUT core field setelah lock | 400 `Foundation is locked; unlock before editing core fields` |

## Decisions

1. **Idempotency:** Already locked → `409 CONFLICT` (tidak re-promote).
2. **Lock readiness terpisah:** `getFoundationLockReadinessForOwner` menghitung `proposed` + `accepted` sebagai siap promosi; display readiness tetap `proposed` only.
3. **Promotion order:** validate all → characters → facts → speech rules → foundation merge → lock row → `workflow_phase`.
4. **Forbidden promotion:** `secret`, `reveal`, `chapter_delta`, fact `category=secret`, high-risk fact payloads — tidak masuk `facts`.
5. **Foundation merge:** isi field kosong dari accepted `foundation`/`style`; canon existing tidak ditimpa.
6. **No DB transaction:** semua accepted proposals divalidasi sebelum write; limitation didokumentasikan.
7. **Audit:** `foundation_locked` + per-entity `character_created`/`fact_created`/`speech_rule_created`; tidak menulis `ai_proposal_accepted` saat lock.
8. **`locked_by`:** tidak ada kolom DB — disimpan di audit metadata `lockedBy`.

## Limitations

- Tidak ada RPC/transaction Supabase — partial failure setelah beberapa promote teoretis mungkin tanpa lock (jarang).
- Unlock workflow tidak diimplementasikan (Task 3.5 scope).
- Lock readiness tidak persist ke DB sebelum lock (hanya display readiness yang persist via GET readiness).
- Speech rule promotion tidak update `result_*` di `ai_proposals` (hanya character/fact).
- Validator penuh / Reveal Gate / publish / credit deduction — deferred.

## Next recommended task

**Task 3.6 — Web integration intake / concepts / foundation** — wire `FoundationPage` ke API proposals + readiness + lock CTA; pertahankan `VITE_USE_MOCKS` fallback.