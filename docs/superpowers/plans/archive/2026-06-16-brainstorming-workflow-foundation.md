> ⛔ **SUPERSEDED / DO NOT EXECUTE** — archived 2026-06-17
>
> This was the early **separate "Foundation Coach" surface** direction (own
> `foundation_refinement` sessions+messages tables, `/foundation/refinement/*`
> routes, migration `00019_foundation_refinement.sql`).
>
> It was **rejected** in favour of the unified **Asisten Narra** design, which
> reuses `intake_sessions`/`intake_messages` and is proposal-first.
>
> - Authoritative spec: [`../../specs/2026-06-16-foundation-coach-design.md`](../../specs/2026-06-16-foundation-coach-design.md)
> - Implemented plan: [`../2026-06-16-asisten-narra-unified-agent-plan.md`](../2026-06-16-asisten-narra-unified-agent-plan.md)
>
> ⚠️ Its migration name `00019_foundation_refinement.sql` **collides** with the
> shipped `supabase/migrations/00019_asisten_narra_phase_readiness.sql`. Do not
> create that migration. Kept only for historical context.

---

# Foundation Coach / Brainstorming Workflow — Implementation Plan

**Date:** 2026-06-16  
**Spec:** [`docs/superpowers/specs/2026-06-16-foundation-coach-design.md`](../specs/2026-06-16-foundation-coach-design.md)  
**Note:** User-referenced plan filename; scope is **Foundation Coach (Matangkan Fondasi)**, not Sprint 4 outline engine.

## Goal

After structural foundation readiness (~75%), guide writers through **Matangkan Fondasi** before lock. Hard lock at **85%** with maturity checks. Coach output → `ai_proposals` only (proposal-first).

## Tasks

| # | Task | Deliverable |
|---|------|-------------|
| 1 | Readiness maturity model | `computeFoundationReadiness`: 70 core + 30 maturity; `canLock` ≥85; UI bands |
| 2 | Schema | `00019_foundation_refinement.sql` — sessions + messages + enum `siap_dimatangkan` |
| 3 | Refinement API | `foundation-refinement.ts` + routes under `/foundation/refinement/*` |
| 4 | Deterministic coach | Question bank from failed maturity checks; stub patch when AI off |
| 5 | AI patch | Reuse `GENERATION_TYPES.foundation_proposal`, `generator: foundation_coach_patch` |
| 6 | Web | Coach panel, CTA `Matangkan Fondasi`, lock disabled <85 |
| 7 | Tests | `sprint19-foundation-coach-contracts.test.mts` |

## Acceptance

- 75% + core complete → `canLock=false`, `canRefine=true`
- ≥85% + maturity → `canLock=true`
- Patch creates proposals, not canon
- Locked foundation → refinement start 409
