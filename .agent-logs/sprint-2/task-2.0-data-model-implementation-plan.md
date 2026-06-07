# Task 2.0 — Sprint 2 Data Model Implementation Plan

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed (retroactive log — dibuat ulang 2026-06-08 karena log ini terlewat saat task asli)

## Task goal

Membuat rencana implementasi Sprint 2 secara detail sebelum coding: shared types, Supabase schema, API shell, canon guardrails (ai_proposals queue), tanpa AI production atau credit deduction.

## Files read

- `README.md`
- `docs/22-sprint-1-verification-report.md`
- `docs/23-legacy-vibenovel-audit.md` (via sprint refs)
- `docs/24-feature-migration-map.md`
- `docs/25-problem-coverage-matrix.md`
- `docs/26-current-sprint-plan.md`
- `docs/17-roadmap-sprint-plan-mvp-to-full.md`
- `apps/web/src/mocks/` (parity reference)
- `.agents/rules/00-read-first.md`, `01-document-navigation-map.md`, `02-sprint-discipline.md`

## Files created/changed

| File | Action |
|---|---|
| `docs/27-sprint-2-data-model-implementation-plan.md` | Created — Sprint 2 plan (9 tabel, task 2.1–2.15 breakdown) |

**Catatan git:** Dokumen `docs/27` masuk commit `3ac14cb` bersama implementasi Task 2.1 dan rule 2.0b — tidak ada commit terpisah docs-only.

**Tidak diubah saat Task 2.0:** migrations, API, web source, seed.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | tidak dijalankan — docs-only planning task |
| `npm run build:*` | tidak dijalankan — docs-only planning task |
| `supabase db reset` | tidak dijalankan — belum ada migration saat planning |

## Results

- `docs/27` mencakup: Sprint 2 goal, 9 tabel core, enum alignment, RLS draft reference, API task breakdown 2.1–2.15, canon guardrails, out of scope, acceptance criteria.
- Task numbering 2.1–2.15 menjadi acuan implementasi Sprint 2 berikutnya.
- Log formal Task 2.0 **tidak dibuat** pada sesi asli; Task 2.1 log mencatat "handoff awal tanpa log formal".

## Decisions

1. **9 tabel Sprint 2** — profiles, projects, settings, foundations, characters, facts, speech_rules, ai_proposals, credit_balances (+ audit_logs).
2. **Canon rule** — AI output → `ai_proposals` dulu; `facts` tanpa source AI direct.
3. **Defer Sprint 4+** — chapters, prose, ledger, validator production.
4. **Task 2.0b** (agent work logs rule) dibuat bersamaan di sesi yang sama untuk disiplin handoff ke depan.

## Limitations

- Plan tidak include SQL final — mengikuti implementasi per task (2.3 migration).
- Log ini **retroaktif** — command/results diisi dari fakta repo, bukan replay terminal sesi asli.
- Sprint 1 tidak punya folder `.agent-logs/sprint-1/` (rule 2.0b belum ada saat Sprint 1).

## Next recommended task

**Task 2.1 — Shared package foundation** (`@vibenovel/shared` enums + domain types).