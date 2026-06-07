# Task 2.1 — Shared Package Foundation

**Date:** 2026-06-08
**Sprint:** sprint-2
**Status:** completed (retroactive log)

## Task goal

Membuat package shared resmi di `packages/shared` untuk types, enums, dan kontrak API dasar Sprint 2 agar frontend, backend, dan database migration nanti memakai definisi domain yang sama. Tanpa Supabase migration, auth, `apps/api`, OpenRouter, AI generation, credit ledger real, refactor UI besar, atau penghapusan typed mocks frontend.

## Files read

- `README.md`
- `docs/22-sprint-1-verification-report.md` (referensi status Sprint 1)
- `docs/23-legacy-vibenovel-audit.md` (guardrail legacy)
- `docs/24-feature-migration-map.md` (mapping fitur)
- `docs/25-problem-coverage-matrix.md` (coverage matrix)
- `docs/26-current-sprint-plan.md` (urutan task Sprint 2)
- `docs/27-sprint-2-data-model-implementation-plan.md` (schema & enum canon)
- `.agents/rules/00-read-first.md`
- `.agents/rules/01-document-navigation-map.md`
- `.agents/rules/02-sprint-discipline.md`
- `apps/web/src/types/project.ts` (alignment mock Sprint 1)
- `apps/web/src/types/storyFoundation.ts`
- `apps/web/src/types/settings.ts`
- `apps/web/package.json`
- `package.json` (root)
- `packages/shared/README.md` (placeholder sebelum implementasi)

## Files created/changed

| File | Action |
|---|---|
| `packages/shared/package.json` | Created — `@vibenovel/shared`, scripts typecheck/build |
| `packages/shared/tsconfig.json` | Created — strict TS, emit `dist/` |
| `packages/shared/src/utils.ts` | Created — `ID`, `ISODateTime`, `JsonValue`, `JsonObject`, `Timestamps` |
| `packages/shared/src/enums.ts` | Created — const objects + union types Sprint 2 |
| `packages/shared/src/domain.ts` | Created — entity interfaces |
| `packages/shared/src/api.ts` | Created — `ApiResponse`, pagination types |
| `packages/shared/src/index.ts` | Created — barrel export |
| `packages/shared/README.md` | Updated — placeholder → implemented |
| `package.json` (root) | Updated — `typecheck:shared`, `build:shared`, `typecheck` includes shared |
| `package-lock.json` | Updated — workspace link `@vibenovel/shared` |

**Tidak diubah:** `apps/web` source, routes, mocks, `supabase/`, `apps/api`.

## Commands run

| Command | Result |
|---|---|
| `npm install` (root) | PASS — workspace mengenali `@vibenovel/shared` |
| `npm run typecheck:shared` | PASS |
| `npm run typecheck` | PASS — shared + web |
| `npm run build:shared` | PASS — emit `packages/shared/dist/` |
| `npm run build:web` | PASS |

## Verification results

| Acceptance criterion | Result |
|---|---|
| `packages/shared` punya package.json, tsconfig, src exports | ✅ |
| Semua type/enums Sprint 2 diexport dari `index.ts` | ✅ |
| Root workspace mengenali `packages/shared` | ✅ |
| `npm run typecheck:shared` lulus | ✅ |
| `npm run typecheck` dari root lulus | ✅ |
| `npm run build:web` lulus | ✅ |
| Tidak ada UI route berubah | ✅ |
| Tidak ada Supabase migration | ✅ |
| Tidak ada `apps/api` production | ✅ |
| Tidak ada AI generation | ✅ |

## Decisions made

- **TypeScript-only** untuk Sprint 2 Task 2.1 — belum Zod/runtime schema (menghindari dependency baru tanpa keputusan eksplisit).
- **Const objects + inferred unions** untuk enum agar mudah dipakai frontend/backend tanpa enum TS runtime.
- **`WriterQualityMode`** hanya `hemat | seimbang | terbaik` — tidak ada raw model ID di shared types.
- **`facts` canon-only** — `FACT_SOURCES` tanpa jalur AI langsung; AI harus lewat `AiProposal`.
- **`AiProposalType`** mencakup `reveal` dan `chapter_delta` sebagai reserved enum; entity Sprint 4+ belum didefinisikan.
- **`CharacterImportance`** sebagai inline union (`main | supporting | minor`) di `domain.ts`, bukan const object terpisah.
- **Tidak memaksa migrasi web** — `apps/web/src/types/` tetap utuh; konsumen shared ditunda ke Task 2.13.
- **Package exports** mengarah ke `src/index.ts` untuk dev dan `dist/` setelah build; `dist/` di-`.gitignore`.

## Known limitations

- Belum ada Zod schema atau runtime validation.
- `apps/web` belum mengimpor `@vibenovel/shared` — types Sprint 1 masih terpisah.
- `dist/` tidak di-commit (gitignored); konsumen perlu `npm run build:shared` atau resolve via `src/` exports.
- Tidak ada unit test untuk shared package.
- Task 2.0b (agent work logs rule) dibuat bersamaan; log Task 2.0 (`task-2.0-data-model-implementation-plan.md`) ditambahkan retroaktif.

## Next recommended task

**Task 2.2 — Supabase project setup & RLS policy draft**

Scope: `supabase/config.toml`, draft migration `00001_sprint2_core.sql` (review only di 2.2), dokumentasi RLS (`owner_id = auth.uid()`, child tables via project ownership). Apply migration = Task 2.3.