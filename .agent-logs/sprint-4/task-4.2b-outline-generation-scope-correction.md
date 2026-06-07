# Task 4.2b — Outline Generation Scope Correction

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Memperbaiki outline stub generator agar default menghasilkan **3 open_loops** dan **3 planned_reveals** (MVP ringkas, parity seed), bukan 24/24. Tetap 10 chapter outlines, hooks, mini victory cadence, planning_truth redaction, dan no canon mutation.

## Files read

- `apps/api/src/services/outline-generator.ts`
- `apps/api/src/services/outline.ts`
- `apps/api/src/services/outline-snapshot.ts`
- `apps/api/src/lib/mappers.ts`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `.agent-logs/sprint-4/task-4.2-outline-generation-stub-api.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/api/src/services/outline-generator.ts` | Updated — default 3/3, MVP + extended pool, clamp max 4 |
| `apps/api/README.md` | Updated — dokumentasi counts 3 (cap 4) |
| `.agent-logs/sprint-4/task-4.2b-outline-generation-scope-correction.md` | Created (log ini) |

**Tidak diubah:** migration, seed, web UI, outline.ts service logic, routes, mappers.

## Commands run

| Command | Result | Notes |
|---|---|---|
| `npm run typecheck:api` | **PASS** | `tsc --noEmit` @vibenovel/api |
| `npm run typecheck` | **PASS** | shared + web + api |
| `npm run build:shared` | **PASS** | `tsc` @vibenovel/shared |
| `npm run build:web` | **PASS** | vite build OK |
| `npm run build:api` | **PASS** | wrangler dry-run OK |
| `npm run smoke:api` | **PASS** | 17/17 (re-run 2026-06-08 approval session) |
| Outline runtime verification | **PASS** | 5/5 (re-run 2026-06-08 approval session) |

**Tidak dijalankan:** `supabase db reset` (tidak diperlukan — tidak ada migration/seed change).

## Results

### Fix summary

- Generator Task 4.2 salah menghasilkan 24 `open_loops` dan 24 `planned_reveals`.
- Task 4.2b memisahkan **MVP templates** (3 each, parity `seed.sql`) dari **extended pool** (internal, slice hingga max 4).
- Konstanta diekspor: `DEFAULT_OPEN_LOOP_COUNT=3`, `DEFAULT_PLANNED_REVEAL_COUNT=3`, `MAX_*_COUNT=4`.
- `generateOutlineDraft` mendukung opsi internal `openLoopCount` / `plannedRevealCount` (capped); API public belum expose.

### New generation counts (default)

| Artifact | Count |
|---|---|
| `chapter_outlines` | 10 |
| `open_loops` | 3 |
| `planned_reveals` | 3 |

### Runtime verification (5/5 PASS — re-run approval session)

Flow: signup → project → intake → concepts/select → foundation proposals/accept → lock → outline generate.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | `POST .../outline/generate` | **PASS** | `chapters=10`, `openLoops=3`, `plannedReveals=3` |
| 2 | `GET .../outline` planningTruth redacted | **PASS** | `bundleRedacted=True`, `hasPlanningTruthField=False` |
| 3 | Canon counts unchanged post-generate | **PASS** | `facts=3→3`, `chars=3→3`, `rules=1→1` |
| 4 | `regenerate=false` | **PASS** | `created=False`, `openLoops=3` |
| 5 | `regenerate=true` | **PASS** | `regenerated=True`, `openLoops=3`, `plannedReveals=3` (not 24/24) |

## Decisions

1. **Extended pool retained** — 21 extra loop + 21 extra reveal templates tetap di file untuk slice future; tidak dipakai default.
2. **MVP templates = seed parity** — 3 open loops + 3 planned reveals sama dengan `supabase/seed.sql`.
3. **Max cap 4** — acceptance criteria; internal override clamped, tidak exposed di POST body Task 4.2b.
4. **Seed/migration tidak diubah** — seed sudah 3/3.

## Limitations

- API POST body belum expose `openLoopCount` / `plannedRevealCount` (internal generator only).
- Task 4.2 work log masih mencatat 24/24 sebagai historical Task 4.2 session.
- Sprint 2 `smoke:api` tidak assert outline counts.

## Next recommended task

**Task 4.3 — Chapter outline CRUD API** (setelah Task 4.2/4.2b di-approve penuh).