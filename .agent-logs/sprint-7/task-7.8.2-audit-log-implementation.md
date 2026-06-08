# Task 7.8.2 — Audit Log Implementation (P0 + P1)

**Date:** 2026-06-08  
**Sprint:** sprint-7 (pre-AI hardening)  
**Status:** completed

## Task goal

Implement migration `00007`, shared audit enum mirror, `audit-snapshot` helper, and P0 audit writers for foundation lock, delta extract/link, proposal accept/canon promotion, publish export. Add P1 writers for summary approve and publish generate/update.

## Files read

| Path | Purpose |
|---|---|
| `docs/41`, `docs/42`, `docs/36` | Hardening + coverage plan |
| `supabase/migrations/00001_sprint2_core.sql` | Baseline audit enums |
| `packages/shared/src/enums.ts`, `index.ts` | Shared enum mirror |
| `apps/api/src/services/audit.ts` | Writer baseline |
| `foundation-lock.ts`, `chapter-delta.ts`, `summary-proposal-linker.ts` | P0 paths |
| `summary-proposal-review.ts`, `proposal-canon-promotion.ts` | Canon promotion |
| `publish-package-update.ts`, `publish-package.ts` | Publish audit |
| `chapter-summary-approval.ts` | P1 summary approve |
| `scripts/sprint6-smoke-api.ps1`, `sprint7-smoke-api.ps1` | Smoke audit asserts |
| `.agents/rules/09-agent-work-logs.md` | Log format |

## Files created/changed

| Path | Note |
|---|---|
| `supabase/migrations/00007_audit_enum_extension.sql` | **Created** — 37 actions + 16 entity types |
| `packages/shared/src/enums.ts` | `AUDIT_ACTIONS`, `AUDIT_ENTITY_TYPES` |
| `packages/shared/src/index.ts` | Export audit types |
| `packages/shared/README.md` | 7.8.2 note |
| `apps/api/src/services/audit-snapshot.ts` | **Created** — sanitizer + snapshots |
| `apps/api/src/services/audit.ts` | Import shared types + sanitize on write |
| `apps/api/src/services/foundation-lock.ts` | lock started/locked/failed lifecycle |
| `apps/api/src/services/chapter-delta.ts` | `chapter_delta_extracted` |
| `apps/api/src/services/summary-proposal-linker.ts` | `summary_proposal_linked` batch |
| `apps/api/src/services/summary-proposal-review.ts` | accept/reject + canon promotion audit |
| `apps/api/src/services/chapter-summary-approval.ts` | `chapter_summary_approved` |
| `apps/api/src/services/publish-package-update.ts` | export/update/checklist audit |
| `apps/api/src/services/publish-package.ts` | generate/regenerate audit |
| `scripts/sprint6-smoke-api.ps1` | 5 audit assertion steps |
| `scripts/sprint7-smoke-api.ps1` | 3 audit assertion steps |
| `apps/api/README.md` | Audit coverage section |
| `README.md`, `docs/36` | 7.8.2 ✅ |
| `.agent-logs/sprint-7/task-7.8.2-audit-log-implementation.md` | This log |

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck:shared` | PASS |
| `npm run typecheck:api` | PASS (after fixes) |
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `supabase db reset` | PASS — `00007` applied |
| `npm run smoke:api` | **17/17 PASS** |
| `npm run smoke:api:sprint5` | **49/49 PASS** |
| `npm run smoke:api:sprint6` | **64/64 PASS** (59 + 5 audit) |
| `npm run smoke:api:sprint7` | **53/53 PASS** (50 + 3 audit) |

## Results

- P0 audit coverage implemented with `correlationId` batch metadata.
- Legacy `ai_proposal_*` dual-write retained on summary accept/reject.
- `chapter_summary_approved` replaces `project_updated` on approve path.
- Smoke queries `audit_logs` via Supabase REST (user JWT, RLS) — no service role in smoke.
- No product behavior change except audit writes.

## Decisions

1. **Batch `summary_proposal_linked`** — one row per delta extract + per-proposal `ai_proposal_created` kept.
2. **`canon_promotion_applied` before proposal status update** — after `promoteProposalToCanon` success only.
3. **`foundation_lock_failed`** — only after `foundation_lock_started` (inside try/catch).
4. **Sanitize at write time** in `audit.ts` — all paths protected.
5. **P2 intake/outline/write deferred** — enum ready, no writers yet.

## Limitations

- No transaction wrapper (7.8.3).
- P2 audit writers not implemented.
- No GIN index on `metadata.correlationId`.
- `prose_version_created` / `chapter_summary_generated` not added (optional P1 skipped).

## Next recommended task

**Task 7.8.3** — Transaction wrapper strategy + P0 workflow hardening (foundation lock, delta extract, proposal accept).