# packages/shared — Shared Types & Contracts

Kontrak data bersama antar `apps/web`, `apps/api`, dan migrasi database Sprint 2+.

## Status

**Task 2.1 + 3.1 + 4.1 + 5.1 — implemented.** TypeScript types dan enums domain Sprint 2–5; belum ada Zod schema atau runtime validation.

## Isi package

| File | Isi |
|---|---|
| `src/utils.ts` | `ID`, `ISODateTime`, `JsonValue`, `JsonObject`, `Timestamps` |
| `src/enums.ts` | Const objects + union types (quality tier, proposal status, fact category, dll.) |
| `src/domain.ts` | Entity interfaces: `Project`, `StoryFoundation`, `OutlinePlan`, `ChapterOutline`, `WritingSession`, `ChapterBeat`, `WriterContextPacket`, … |
| `src/api.ts` | `ApiResponse`, `PaginationParams`, `PaginatedResponse` |
| `src/index.ts` | Barrel export |

## Canon guardrails

- `facts` hanya untuk fakta confirmed/sah (`user`, `system`, `accepted_proposal`).
- Output AI harus masuk `ai_proposals` dulu — jangan menulis langsung ke `facts`.
- Sprint 3: `story_concepts`, `detected_signals`, `intake_messages` **bukan canon**.
- Sprint 4: `outline_plans`, `chapter_outlines` **bukan prose**; `planned_reveals.planning_truth` planner-only (writer slice-only nanti).
- Sprint 5: `chapter_prose_versions` **bukan canon**; `ContextPacketLog.packetJson` must not contain `planningTruth`; `WriterContextPacket` slice-only (no full outline dump). `ai_generated` prose source is reserved — not OpenRouter approval.
- Mode kualitas user-facing: `hemat` | `seimbang` | `terbaik` — bukan raw model ID.

## Scripts

```bash
npm run typecheck:shared   # dari root
npm run build:shared       # emit dist/
```

## Konsumen

Sprint 2.13+: `apps/web` dan `apps/api` impor dari `@vibenovel/shared`. Types Sprint 1 di `apps/web/src/types/` tetap ada sampai migrasi bertahap.