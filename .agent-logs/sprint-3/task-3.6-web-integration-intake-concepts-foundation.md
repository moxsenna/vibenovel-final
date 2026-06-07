# Task 3.6 — Web Integration Intake, Concepts, Foundation

**Date:** 2026-06-08
**Sprint:** sprint-3
**Status:** completed

## Task goal

Menghubungkan halaman `/intake`, `/concepts`, `/foundation` ke API Sprint 3 dengan fallback mock, tanpa redesign besar, tanpa AI/OpenRouter.

## Files read

- `README.md`
- `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
- `docs/29-sprint-2-verification-report.md`
- `apps/api/README.md`
- `apps/web/src/lib/api.ts`, `env.ts`, `api-mappers.ts`
- `apps/web/src/services/*`, `hooks/useFoundationData.ts`
- `apps/web/src/pages/IntakePage.tsx`, `ConceptsPage.tsx`, `FoundationPage.tsx`
- `apps/web/src/components/intake/`, `concepts/`, `foundation/`
- `apps/web/src/mocks/intake.ts`, `concepts.ts`, `storyFoundation.ts`
- `packages/shared/src/domain.ts`, `enums.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/web/src/services/intake.ts` | Created |
| `apps/web/src/services/concepts.ts` | Created |
| `apps/web/src/services/foundation-flow.ts` | Created |
| `apps/web/src/lib/project-context.ts` | Created — resolve demo UUID → active API project |
| `apps/web/src/lib/api.ts` | Updated — `ApiClientError.details` |
| `apps/web/src/lib/api-mappers.ts` | Updated — intake/concept/readiness/proposal mappers |
| `apps/web/src/hooks/useIntakeData.ts` | Created |
| `apps/web/src/hooks/useConceptsData.ts` | Created |
| `apps/web/src/hooks/useFoundationFlow.ts` | Created |
| `apps/web/src/pages/IntakePage.tsx` | Updated — API mode |
| `apps/web/src/pages/ConceptsPage.tsx` | Updated — API mode |
| `apps/web/src/pages/FoundationPage.tsx` | Updated — API mode + proposals + lock |
| `apps/web/src/components/intake/ChatPanel.tsx` | Updated — `onSendMessage` API path |
| `apps/web/src/components/intake/ChatInput.tsx` | Updated — `disabled`, async send |
| `apps/web/src/components/concepts/ConceptCard.tsx` | Updated — `onSelect`, selected badge |
| `apps/web/src/components/foundation/FoundationLockCta.tsx` | Updated — lock button + outline link |
| `apps/web/src/components/foundation/FoundationProposalsPanel.tsx` | Created |
| `apps/web/src/components/foundation/index.ts` | Updated export |
| `apps/web/src/types/concept.ts` | Updated — optional `status` |
| `apps/web/.env.example` | Updated — Task 3.6 note |
| `README.md` | Updated — web integration scope |
| `.agent-logs/sprint-3/task-3.6-web-integration-intake-concepts-foundation.md` | Created (log ini) |

**Tidak diubah:** route map, mocks (tetap ada), API backend, OpenRouter, outline/chapter/prose.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| Manual web runtime (browser) | tidak dijalankan — API flow diverifikasi via script Task 3.5 pattern |

## Results

### Integration strategy

- `VITE_USE_MOCKS=true` → mock Sprint 1 penuh (unchanged).
- `VITE_USE_MOCKS=false` + login → hooks panggil API dengan Bearer dari Supabase session.
- Error/no login → `IntegrationNotice` + mock fallback (`api-fallback` source).
- `demo-project-001` route → `resolveProjectIdForRoute` map ke active API project (Task 2.13 pattern).

### Runtime verification (API script-level, local Supabase + API)

Task 3.5 lock flow script confirms API endpoints used by web hooks work end-to-end. Web UI wiring verified via typecheck + production build.

## Decisions

1. **`useFoundationFlow`** menggantikan `useFoundationData` di FoundationPage (hook lama tetap untuk referensi).
2. **Extract signals** otomatis setelah kirim pesan di API mode.
3. **Concepts kosong** → tombol "Buat 3 Konsep Cerita" (tidak auto-generate).
4. **Terima Usulan** hanya untuk `proposed` non-rahasia/non-high-risk fact — label user-facing.
5. **Lock CTA** memanggil `POST .../foundation/lock`; 409 menampilkan `missing` + score via `ApiClientError.details`.
6. **System intake messages** dipetakan ke role `agent` di UI.

## Limitations

- Tidak ada UI reject/merge proposal penuh.
- Jadwal rahasia tetap mock di foundation page.
- Browser E2E manual tidak dijalankan di sesi ini.
- `useFoundationData` tidak dihapus (masih bisa dipakai referensi).

## Next recommended task

**Task 3.7 — Sprint 3 verification report** (`docs/31-sprint-3-verification-report.md`, optional `sprint3-smoke-api.ps1`).