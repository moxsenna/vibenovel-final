# 42 — Audit Action Enum & Coverage Plan

**Status:** Design complete — implementation deferred to Task 7.8.2  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md)  
**Parent plan:** Task 7.8.1

Dokumen ini adalah **desain final** untuk perluasan `audit_action` / `audit_entity_type`, coverage matrix workflow Sprint 2–7, standar payload, strategi korelasi batch, dan rencana migration `00007`. Tidak ada perubahan service, tidak ada audit writer baru di task ini.

---

## 1. Purpose

Task 7.8.1 mengunci inventori enum dan peta coverage sebelum Task 7.8.2 menulis migration + `writeAuditLog` calls. Tujuan:

- Satu sumber kebenaran untuk **37 nilai enum baru** + **16 entity type baru**
- Prioritas P0/P1/P2 jelas per workflow
- Standar payload mencegah leak prose/prompt/packet saat AI production
- Service touch list siap untuk 7.8.2 tanpa mengubah behavior hari ini

---

## 2. Existing Baseline (migration `00001`)

### `audit_action` — retained unchanged

```txt
project_created, project_updated, settings_updated,
foundation_created, foundation_updated, foundation_locked,
character_created, character_updated,
fact_created, fact_updated, fact_deprecated,
speech_rule_created, speech_rule_updated,
ai_proposal_created, ai_proposal_accepted, ai_proposal_rejected, ai_proposal_merged,
credit_balance_seeded
```

### `audit_entity_type` — retained unchanged

```txt
profile, project, project_settings, story_foundation,
character, fact, relationship_speech_rule, ai_proposal, credit_balance
```

### Writer today (`apps/api/src/services/audit.ts`)

- Union types hardcoded di API — **belum** di `packages/shared`
- Services yang sudah menulis audit: `project`, `project-settings`, `foundation`, `foundation-lock`, `character`, `fact`, `speech-rule`, `ai-proposal`, `outline` (phase only), `chapter-summary-approval` (generic), `summary-proposal-linker`, `summary-proposal-review`

---

## 3. Audit Action Inventory (final additions)

**37 nilai baru** untuk migration `00007`. Satu nilai existing dipakai ulang dengan metadata diperkaya.

| # | Action | Group | Notes |
|---|---|---|---|
| — | `foundation_locked` | B | **Existing** — enhance metadata in 7.8.2; do not re-add enum |
| 1 | `intake_session_created` | A | `createOrResetIntakeForOwner` |
| 2 | `intake_message_created` | A | `appendUserMessageForOwner` |
| 3 | `detected_signal_created` | A | `extractDetectedSignalsForOwner` (per signal or batch summary) |
| 4 | `detected_signal_updated` | A | `updateDetectedSignalStatusForOwner` |
| 5 | `story_concepts_generated` | A | `generateConceptsForOwner` |
| 6 | `story_concept_selected` | A | `selectConceptForOwner` |
| 7 | `foundation_proposals_generated` | B | `foundation-proposal` batch generate |
| 8 | `foundation_proposal_accepted` | B | Manual accept via `ai-proposal` accept (foundation flow) |
| 9 | `foundation_lock_started` | B | Start of `lockFoundationForOwner` after validation pass |
| 10 | `foundation_lock_failed` | B | Lock aborted (readiness fail, promotion error) |
| 11 | `outline_generated` | C | `outline.ts` generate |
| 12 | `chapter_outline_updated` | C | `chapter-outline.ts` PATCH |
| 13 | `open_loop_updated` | C | `outline-tracking.ts` open loop edit |
| 14 | `planned_reveal_updated` | C | `outline-tracking.ts` reveal edit |
| 15 | `outline_approved` | C | `outline-lock.ts` approve |
| 16 | `outline_locked` | C | `outline-lock.ts` lock |
| 17 | `writing_session_started` | D | `startOrResumeWritingSessionForOwner` (new session) |
| 18 | `writing_session_updated` | D | `patchWritingSessionForOwner` |
| 19 | `chapter_beats_generated` | D | `chapter-beat.ts` generate |
| 20 | `chapter_beat_updated` | D | `chapter-beat.ts` PATCH |
| 21 | `prose_version_created` | D | `saveProseDraftForOwner` |
| 22 | `prose_version_made_current` | D | `makeProseVersionCurrentForOwner` |
| 23 | `context_packet_built` | D | `context-packet-builder.ts` |
| 24 | `chapter_ready_for_summary` | D | `markWritingSessionReadyForSummaryForOwner` |
| 25 | `chapter_summary_generated` | E | `chapter-summary.ts` / generator |
| 26 | `chapter_delta_extracted` | E | `extractChapterDeltaForOwner` |
| 27 | `chapter_summary_approved` | E | `chapter-summary-approval.ts` — replaces generic `project_updated` |
| 28 | `summary_proposal_linked` | E | `summary-proposal-linker.ts` batch after delta |
| 29 | `summary_proposal_accepted` | E | `summary-proposal-review.ts` accept — dedicated action |
| 30 | `summary_proposal_rejected` | E | `summary-proposal-review.ts` reject — dedicated action |
| 31 | `canon_promotion_applied` | E | `proposal-canon-promotion.ts` success |
| 32 | `canon_promotion_failed` | E | `proposal-canon-promotion.ts` catch/validation fail |
| 33 | `publish_package_generated` | F | `generatePublishPackageForOwner` (first generate) |
| 34 | `publish_package_updated` | F | `updatePublishPackageFieldsForOwner` |
| 35 | `publish_checklist_updated` | F | `updatePublishPackageChecklistForOwner` |
| 36 | `publish_package_exported` | F | `markPublishPackageExportedForOwner` |
| 37 | `publish_package_regenerated` | F | `generatePublishPackageForOwner` with `regenerate=true` |

### Group summary

| Group | New values | Existing reused |
|---|---|---|
| A — Intake / concept | 6 | — |
| B — Foundation | 4 | `foundation_locked` |
| C — Outline | 6 | — |
| D — Write Room | 8 | — |
| E — Summary / canon | 8 | — |
| F — Publish | 5 | — |
| **Total** | **37** | **1** |

### Deprecation / coexistence policy (7.8.2)

| Legacy action | Replacement | Policy |
|---|---|---|
| `project_updated` on summary approve | `chapter_summary_approved` | Write new action only; stop generic project_updated for this path |
| `project_updated` on outline phase | Keep for phase; add `outline_generated` / `outline_locked` | Dual-write acceptable for one sprint; remove generic in 7.8.6 verify |
| `ai_proposal_created` from delta linker | Add `summary_proposal_linked` + keep `ai_proposal_created` per proposal OR batch parent | **Recommend:** one `chapter_delta_extracted` + N `summary_proposal_linked` with shared `correlationId` |
| `ai_proposal_accepted` from summary review | `summary_proposal_accepted` + `canon_promotion_applied` | Dual-write in 7.8.2 for query compatibility; filter by `metadata.source` |

---

## 4. Audit Entity Type Inventory (final additions)

**16 nilai baru** untuk migration `00007`:

| # | Entity type | Primary table / concept |
|---|---|---|
| 1 | `intake_session` | `intake_sessions` |
| 2 | `intake_message` | `intake_messages` |
| 3 | `detected_signal` | `detected_signals` |
| 4 | `story_concept` | `story_concepts` |
| 5 | `outline_plan` | `outline_plans` |
| 6 | `chapter_outline` | `chapter_outlines` |
| 7 | `open_loop` | `open_loops` |
| 8 | `planned_reveal` | `planned_reveals` |
| 9 | `writing_session` | `writing_sessions` |
| 10 | `chapter_beat` | `chapter_beats` |
| 11 | `chapter_prose_version` | `chapter_prose_versions` |
| 12 | `context_packet_log` | `context_packet_logs` |
| 13 | `chapter_summary` | `chapter_summaries` |
| 14 | `chapter_delta` | `chapter_deltas` |
| 15 | `chapter_summary_proposal` | `chapter_summary_proposals` (junction) |
| 16 | `publish_package` | `publish_packages` |

**Naming note:** `planned_reveal` (not `reveal`) aligns with table `planned_reveals` and shared `PLANNED_REVEAL_STATUSES`.

---

## 5. Coverage Matrix

| Workflow | Service / entry | Current audit state | Required new action | Entity type | Before/after? | Metadata | Priority | Target |
|---|---|---|---|---|---|---|---|---|
| Intake session create | `intake.ts` `createOrResetIntakeForOwner` | None | `intake_session_created` | `intake_session` | No | `sessionStatus`, `intakePhase` | P2 | 7.8.2 |
| Intake message | `appendUserMessageForOwner` | None | `intake_message_created` | `intake_message` | No | `role`, `messageLength` (not body) | P2 | 7.8.2 |
| Signal extract | `extractDetectedSignalsForOwner` | None | `detected_signal_created` | `detected_signal` | No | `signalType`, `batchCount`, `correlationId` | P2 | 7.8.2 |
| Signal update | `updateDetectedSignalStatusForOwner` | None | `detected_signal_updated` | `detected_signal` | Yes (status only) | `changedFields` | P2 | 7.8.2 |
| Concepts generate | `generateConceptsForOwner` | None | `story_concepts_generated` | `story_concept` | No | `conceptCount`, `correlationId` | P2 | 7.8.2 |
| Concept select | `selectConceptForOwner` | None | `story_concept_selected` | `story_concept` | Yes (status) | `conceptId`, `workflowPhase` | P2 | 7.8.2 |
| Foundation proposals gen | `foundation-proposal.ts` | None | `foundation_proposals_generated` | `ai_proposal` | No | `proposalCount`, `types[]`, `correlationId` | P2 | 7.8.2 |
| Foundation proposal accept | `ai-proposal.ts` accept (foundation types) | `ai_proposal_accepted` | `foundation_proposal_accepted` | `ai_proposal` | No | `proposalType`, `riskLevel` | P2 | 7.8.2 |
| **Foundation lock** | `foundation-lock.ts` `lockFoundationForOwner` | `foundation_locked` + per-entity `*_created` | `foundation_lock_started`, `foundation_locked`, `foundation_lock_failed` | `story_foundation` | Yes (lock flags) | `correlationId`, `promotedCounts`, `promotedProposalIds[]`, `readinessScore` | **P0** | 7.8.2 |
| Outline generate | `outline.ts` | `project_updated` (phase) | `outline_generated` | `outline_plan` | No | `chapterCount`, `correlationId`, `generatorVersion` | P1 | 7.8.2 |
| Chapter outline edit | `chapter-outline.ts` | None | `chapter_outline_updated` | `chapter_outline` | Yes (compact) | `chapterNumber`, `changedFields` | P1 | 7.8.2 |
| Open loop edit | `outline-tracking.ts` | None | `open_loop_updated` | `open_loop` | Yes (status) | `changedFields` | P1 | 7.8.2 |
| Planned reveal edit | `outline-tracking.ts` | None | `planned_reveal_updated` | `planned_reveal` | Yes (status only) | `changedFields`, **no** `planningTruth` | P1 | 7.8.2 |
| Outline approve | `outline-lock.ts` | None | `outline_approved` | `outline_plan` | Yes (status) | `checksPass`, `score` | P1 | 7.8.2 |
| **Outline lock** | `outline-lock.ts` | None | `outline_locked` | `outline_plan` | Yes (status) | `correlationId`, `chapterCount`, `workflowPhase` | P1 | 7.8.2 |
| Writing session start | `write-session.ts` | None | `writing_session_started` | `writing_session` | No | `chapterOutlineId`, `chapterNumber` | P1 | 7.8.2 |
| Writing session patch | `patchWritingSessionForOwner` | None | `writing_session_updated` | `writing_session` | Yes (status) | `changedFields` | P2 | 7.8.2 |
| Beats generate | `chapter-beat.ts` | None | `chapter_beats_generated` | `chapter_beat` | No | `beatCount`, `correlationId` | P1 | 7.8.2 |
| Beat update | `chapter-beat.ts` | None | `chapter_beat_updated` | `chapter_beat` | Yes (compact) | `beatIndex`, `changedFields` | P2 | 7.8.2 |
| **Prose save** | `prose-draft.ts` `saveProseDraftForOwner` | None | `prose_version_created` | `chapter_prose_version` | No | `versionNumber`, `wordCount`, `beatId`, `source` | **P1** | 7.8.2 |
| Prose make current | `makeProseVersionCurrentForOwner` | None | `prose_version_made_current` | `chapter_prose_version` | No | `versionId`, `previousCurrentId` | P1 | 7.8.2 |
| Context packet | `context-packet-builder.ts` | None | `context_packet_built` | `context_packet_log` | No | `packetLogId`, `packetHash`, `builderVersion` | P1 | 7.8.2 |
| Ready for summary | `markWritingSessionReadyForSummaryForOwner` | None | `chapter_ready_for_summary` | `writing_session` | Yes (status) | `writingState`, `wordCount` | P1 | 7.8.2 |
| Summary generate | `chapter-summary.ts` | None | `chapter_summary_generated` | `chapter_summary` | No | `summaryVersion`, `itemCount`, `wordCount` | P1 | 7.8.2 |
| **Delta extract + link** | `chapter-delta.ts` + linker | `ai_proposal_created` per proposal | `chapter_delta_extracted`, `summary_proposal_linked` | `chapter_delta`, `chapter_summary_proposal` | No | `correlationId`, `proposalCount`, `extractorVersion` | **P0** | 7.8.2 |
| **Summary approve** | `chapter-summary-approval.ts` | `project_updated` | `chapter_summary_approved` | `chapter_summary` | Yes (status) | `chapterNumber`, `linkedProposalCount` | **P1** | 7.8.2 |
| **Proposal accept + canon** | `summary-proposal-review.ts` + `proposal-canon-promotion.ts` | `ai_proposal_accepted` only | `summary_proposal_accepted`, `canon_promotion_applied`, `canon_promotion_failed` | `ai_proposal`, promoted entity type | Yes (entity ids) | `correlationId`, `promotedEntityType`, `promotedEntityId`, `created` | **P0** | 7.8.2 |
| Proposal reject | `summary-proposal-review.ts` | `ai_proposal_rejected` | `summary_proposal_rejected` | `chapter_summary_proposal` | No | `chapterSummaryId`, `reason` (truncated) | P1 | 7.8.2 |
| Publish generate | `publish-package.ts` | None | `publish_package_generated` | `publish_package` | No | `chapterNumber`, `generatorVersion`, `correlationId` | P1 | 7.8.2 |
| Publish regenerate | `publish-package.ts` `regenerate=true` | None | `publish_package_regenerated` | `publish_package` | No | `supersededPackageId`, `newPackageId` | P1 | 7.8.2 |
| Publish fields update | `publish-package-update.ts` | None | `publish_package_updated` | `publish_package` | Yes (field names) | `changedFields[]`, **not** full caption | P1 | 7.8.2 |
| Publish checklist | `updatePublishPackageChecklistForOwner` | None | `publish_checklist_updated` | `publish_package` | Yes (ids) | `checklistItemIds[]`, `allComplete` | P1 | 7.8.2 |
| **Publish export** | `markPublishPackageExportedForOwner` | None | `publish_package_exported` | `publish_package` | Yes (status) | `exportedAt`, `manualCopyConfirmed` | **P0** | 7.8.2 |

### P0 summary (must implement in 7.8.2)

1. Foundation lock lifecycle (`foundation_lock_started` / `foundation_locked` / `foundation_lock_failed`)
2. Delta extract batch (`chapter_delta_extracted` + `summary_proposal_linked`)
3. Canon promotion (`summary_proposal_accepted` + `canon_promotion_applied` / `canon_promotion_failed`)
4. Publish export (`publish_package_exported`)

---

## 6. Audit Payload Standard

### Global rules

| Rule | Detail |
|---|---|
| **Never store** | JWT, service role key, API key, OpenRouter token, full prompt, `packet_json`, `planningTruth`, raw prose `content_text`, user message body verbatim |
| **Always store** | `userId` (column), `projectId` (column), `action`, `entityType`, `entityId` |
| **Size cap** | `metadata` ≤ 4 KB JSON; `before_data` / `after_data` ≤ 2 KB each; truncate with `_truncated: true` |
| **Failure policy** | P0 paths: audit insert failure → HTTP 500 (fail closed). P2 intake: same policy optional — **recommend fail closed for consistency** |

### Field templates

**`metadata` (recommended keys)**

```ts
{
  correlationId?: string;      // UUID v4 per batch operation
  source?: "api" | "smoke" | "stub_generator";
  task?: string;                 // e.g. "foundation_lock", "delta_extract"
  changedFields?: string[];
  counts?: Record<string, number>;
  warningFlags?: string[];
  // workflow-specific ids (never secrets):
  chapterNumber?: number;
  summaryVersion?: number;
  proposalType?: string;
  riskLevel?: string;
}
```

**`before_data` / `after_data` — compact snapshots**

| Entity | Allowed fields |
|---|---|
| `story_foundation` | `status`, `isLocked`, `readinessPercent`, `readinessStatus` |
| `chapter_outline` | `status`, `chapterNumber`, `title` (max 120 chars) |
| `planned_reveal` | `status`, `riskLevel`, `title` — **exclude** `planning_truth` |
| `chapter_prose_version` | `id`, `versionNumber`, `wordCount`, `isCurrent`, `source` |
| `chapter_summary` | `status`, `summaryVersion`, `wordCount`, `chapterNumber` |
| `publish_package` | `status`, `chapterNumber`, `changedFieldNames[]`, `checklistComplete` |
| `detected_signal` | `signalType`, `status` |
| `story_concept` | `status`, `title` (max 120) |

**Prose-specific**

```txt
prose_version_created / prose_version_made_current:
  metadata: { versionId, versionNumber, wordCount, beatId, source }
  before_data / after_data: NOT USED (no text)
```

**Context packet-specific**

```txt
context_packet_built:
  entityId = context_packet_logs.id
  metadata: { packetLogId, packetHash: sha256(hex), builderVersion, beatId?, sessionId? }
  never: packet_json, planningTruth, reveal spoilers
```

**Publish-specific**

```txt
publish_package_updated:
  metadata: { changedFields: ["teaser", "caption_short"] }
  after_data: { status, chapterNumber } only
  if caption > 200 chars: store length only { captionLength: N }
```

### Hash helper (7.8.2 implementation note)

```txt
packetHash = SHA-256( canonical JSON of packet_json with secrets stripped )
```

Implement in `audit-snapshot.ts` (new helper, 7.8.2) — not in 7.8.1.

---

## 7. Correlation / Batch Strategy

### Batch operations needing `metadata.correlationId`

| Batch | Parent action | Child actions | Service |
|---|---|---|---|
| Foundation lock | `foundation_lock_started` | `character_created`, `fact_created`, `speech_rule_created`, `foundation_locked` | `foundation-lock.ts` |
| Outline generate | `outline_generated` | optional per-chapter logs deferred | `outline.ts` |
| Delta extract | `chapter_delta_extracted` | `summary_proposal_linked` (×N) | `chapter-delta.ts`, linker |
| Proposal accept | `summary_proposal_accepted` | `canon_promotion_applied` | `summary-proposal-review.ts` |
| Publish generate/regenerate | `publish_package_generated` / `_regenerated` | — | `publish-package.ts` |

### MVP decision: `metadata.correlationId` is sufficient

- Generate UUID v4 at start of batch; pass through all `writeAuditLog` calls in same request.
- No new DB column on `audit_logs` for MVP.
- Query pattern: `metadata->>'correlationId' = $1` (GIN index deferred).
- Future (post-AI): optional `batch_id` column if query volume requires it.

### `foundation_lock_failed` / `canon_promotion_failed`

Write with same `correlationId` as parent attempt; include `metadata.errorCode` (AppError code, not stack trace).

---

## 8. Migration Strategy (`00007` — plan only)

**File (future):** `supabase/migrations/00007_audit_enum_extension.sql`  
**Task:** 7.8.2 — not created in 7.8.1.

### Shape

- `ALTER TYPE ... ADD VALUE IF NOT EXISTS` for each new enum member
- **No** table shape change to `audit_logs` (columns already support `metadata`, `before_data`, `after_data`)
- Order: add all `audit_entity_type` values first, then `audit_action` values (grouped A→F)
- Idempotent: safe re-run on fresh and existing local DB

### Draft SQL skeleton (reference — do not apply in 7.8.1)

```sql
-- 00007_audit_enum_extension.sql (DRAFT — Task 7.8.2)

ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'intake_session';
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'intake_message';
-- ... (14 more entity types)

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'intake_session_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'intake_message_created';
-- ... (35 more actions; skip foundation_locked — already exists)
```

### Rollout

1. Local `supabase db reset` / migrate
2. Update `apps/api/src/services/audit.ts` unions (or import from shared)
3. Implement writers per coverage matrix P0 → P1 → P2
4. Smoke regression Sprint 2/5/6/7 unchanged behavior

**No remote migration push** until hardening verification (Task 7.8.6).

---

## 9. Shared Types Strategy

### Current state

- `packages/shared/src/enums.ts` — **no** `AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES`
- Web app does not read or display `audit_logs` today
- API `audit.ts` uses local string union types

### Recommendation

| Option | When | Verdict |
|---|---|---|
| Add `AUDIT_ACTIONS` + `AUDIT_ENTITY_TYPES` to shared in **7.8.2** | Same PR as migration `00007` | **Recommended** |
| Keep API-local only | If web never needs audit enums | Acceptable fallback |

**7.8.1:** no shared package change.  
**7.8.2:** add const objects to `packages/shared/src/enums.ts`; export types; API `audit.ts` imports from `@vibenovel/shared` to prevent drift.

```ts
// Planned shape (7.8.2) — not committed in 7.8.1
export const AUDIT_ACTIONS = { intake_session_created: "intake_session_created", ... } as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
```

---

## 10. Service Touch List (7.8.2 implementation map)

| Service file | New audit calls | Priority |
|---|---|---|
| `intake.ts` | 4 actions (session, message, signal create/update) | P2 |
| `concept.ts` | 2 actions | P2 |
| `foundation-proposal.ts` | 1 action | P2 |
| `ai-proposal.ts` | `foundation_proposal_accepted` branch | P2 |
| `foundation-lock.ts` | `foundation_lock_started`, enhance `foundation_locked`, `foundation_lock_failed` | **P0** |
| `outline.ts` | `outline_generated` | P1 |
| `chapter-outline.ts` | `chapter_outline_updated` | P1 |
| `outline-tracking.ts` | `open_loop_updated`, `planned_reveal_updated` | P1 |
| `outline-lock.ts` | `outline_approved`, `outline_locked` | P1 |
| `write-session.ts` | `writing_session_started`, `writing_session_updated`, `chapter_ready_for_summary` | P1 |
| `chapter-beat.ts` | `chapter_beats_generated`, `chapter_beat_updated` | P1/P2 |
| `prose-draft.ts` | `prose_version_created`, `prose_version_made_current` | P1 |
| `context-packet-builder.ts` | `context_packet_built` | P1 |
| `chapter-summary.ts` | `chapter_summary_generated` | P1 |
| `chapter-delta.ts` | `chapter_delta_extracted` | **P0** |
| `summary-proposal-linker.ts` | `summary_proposal_linked` | **P0** |
| `chapter-summary-approval.ts` | `chapter_summary_approved` (replace `project_updated`) | P1 |
| `summary-proposal-review.ts` | `summary_proposal_accepted`, `summary_proposal_rejected` | **P0** |
| `proposal-canon-promotion.ts` | `canon_promotion_applied`, `canon_promotion_failed` | **P0** |
| `publish-package.ts` | `publish_package_generated`, `publish_package_regenerated` | P1 |
| `publish-package-update.ts` | `publish_package_updated`, `publish_checklist_updated`, `publish_package_exported` | P0 export / P1 update |

**Helper to add in 7.8.2:** `apps/api/src/services/audit-snapshot.ts` — compact snapshot builders + `hashPacket()`.

---

## 11. Acceptance Criteria (Task 7.8.1)

| Criterion | Status |
|---|---|
| `docs/42` created | ✅ |
| 37 new `audit_action` values listed | ✅ |
| 16 new `audit_entity_type` values listed | ✅ |
| Coverage matrix with P0/P1/P2 | ✅ |
| Migration `00007` strategy documented | ✅ |
| Payload + correlation standards | ✅ |
| No audit writer implementation | ✅ |
| No service behavior change | ✅ |
| Work log created | ✅ |

---

## 12. Next Task

**Task 7.8.2 — Implement audit logs for canon-changing and export actions**

Deliverables:

1. Migration `00007_audit_enum_extension.sql`
2. `AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES` in shared
3. P0 writers first (foundation lock, delta, canon promotion, publish export)
4. P1 writers second
5. P2 intake/concept deferred acceptable if timeboxed

**Note:** Hardening verification report moves to **`docs/43`** (7.8.6) — `docs/42` reserved for this enum plan.

---

## Related documents

- [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](41-pre-ai-hardening-audit-transactions-ci-plan.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`apps/api/README.md`](../apps/api/README.md)
- `.agent-logs/sprint-7/task-7.8.1-audit-action-enum-coverage-plan.md`