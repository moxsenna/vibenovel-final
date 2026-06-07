# Task 4.6 — Web OutlinePage Integration

**Date:** 2026-06-08
**Sprint:** sprint-4
**Status:** completed

## Task goal

Menghubungkan halaman `/projects/:id/outline` ke API Sprint 4 secara minimal dan aman: fetch/generate outline, edit chapter outline, tampilkan open loops/reveals (tanpa planningTruth), approve/lock workflow, dengan fallback mock tetap tersedia dan tanpa redesign total UI.

## Files read

- `README.md`
- `docs/32-sprint-4-outline-planning-engine-implementation-plan.md`
- `docs/31-sprint-3-verification-report.md`
- `apps/api/README.md`
- `apps/web/src/lib/api.ts`, `env.ts`, `project-context.ts`
- `apps/web/src/pages/OutlinePage.tsx`
- `apps/web/src/pages/FoundationPage.tsx` (pola integrasi Sprint 3)
- `apps/web/src/components/outline/*`
- `apps/web/src/mocks/outline.ts`
- `apps/web/src/hooks/useFoundationFlow.ts` (pola hook)
- `packages/shared/src/domain.ts`, `enums.ts`
- `.agents/rules/09-agent-work-logs.md`

## Files created/changed

| File | Action |
|---|---|
| `apps/web/src/services/outline.ts` | Created — fetch/generate/patch/approve/lock API client |
| `apps/web/src/hooks/useOutlineData.ts` | Created — mock/API/fallback hook dengan workflow actions |
| `apps/web/src/lib/api-mappers.ts` | Updated — outline bundle/chapter/loop/reveal mappers + workflow error labels |
| `apps/web/src/components/outline/OutlineWorkflowActions.tsx` | Created — generate / approve / lock CTA |
| `apps/web/src/components/outline/OutlineTrackingPanels.tsx` | Created — Yang Masih Menggantung + Jadwal Rahasia |
| `apps/web/src/components/outline/OutlineChapterEditor.tsx` | Created — edit title/summary/hook/miniVictory |
| `apps/web/src/components/outline/OutlineChapterCard.tsx` | Updated — optional `expandedFooter` untuk editor |
| `apps/web/src/components/outline/index.ts` | Updated — export komponen baru |
| `apps/web/src/pages/OutlinePage.tsx` | Updated — wire hook + notices + workflow + panels |
| `README.md` | Updated — sebut outline API mode (Task 4.6) |
| `.agent-logs/sprint-4/task-4.6-web-outline-page-integration.md` | Created (log ini) |

**Tidak diubah:** route map, API backend, migration, Write Room, OpenRouter, prose writer, credit deduction.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:shared` | PASS |
| `npm run build:web` | PASS |
| `npm run build:api` | PASS |
| `npm run smoke:api` | PASS — 17/17 |
| `npm run smoke:web` | PASS — 3 mock Playwright, 1 API skipped (NOT RUN) |
| Runtime outline browser flow (API mode) | tidak dijalankan — smoke:web belum cover `/outline`; API lokal verified via smoke:api |

## Results

### Integration strategy

- Pola mengikuti Sprint 3 (`useFoundationFlow` / `FoundationPage`): `shouldUseMocks()`, `resolveProjectIdForRoute`, `IntegrationNotice`, `api-fallback` → mock.
- `VITE_USE_MOCKS=true` → mock penuh Sprint 1.
- `VITE_USE_MOCKS=false` + login → API mode via Bearer token Supabase session (tanpa log token).
- API error / no project → fallback mock + notice; UI tidak blank.

### OutlinePage API behavior

- GET `/api/projects/:id/outline` via `useOutlineData` + `fetchOutlineBundle`.
- Empty outline (`source=api`, chapters=0) → CTA "Buat Rencana 10 Bab" → POST generate.
- Outline ada → arc summary, chapter list, status badge (draft/reviewing/locked), open loops/reveals panels.
- `demo-project-001` → resolve active API project seperti Task 2.13/3.6.

### Chapter edit

- Editor ringan di accordion expanded: judul, ringkasan, hook akhir bab, kemenangan kecil.
- PATCH `/outline/chapters/:chapterId` via "Simpan Perubahan".
- Locked → editor disabled; save guard di hook.

### Approve / lock UI

- "Setujui Outline" → POST approve.
- "Kunci Outline" → POST lock (manual click, tidak auto).
- 409 → `formatOutlineWorkflowError` dengan label user-facing (hook, mini victory, open loop, dll.).
- Lock sukses → badge "Outline Terkunci" + notice hijau.

### Open loop / reveal display

- Panel "Yang Masih Menggantung" dan "Jadwal Rahasia" read-only.
- Hanya title, hint, planned chapter, risk/status — `planningTruth` tidak di-fetch ke UI types.

### Fallback behavior

- No login + `VITE_USE_MOCKS=false` → mock + notice login.
- API down → mock + IntegrationNotice.
- `api-fallback` tetap tampilkan mock chapters; generate CTA hanya saat `source=api` + empty (bukan fallback).

## Decisions

- `needsGenerate` vs `hasApiOutline` dipisah agar fallback mock tidak menampilkan CTA generate palsu.
- Editor sebagai `expandedFooter` di `OutlineChapterCard` — reuse accordion tanpa redesign layout.
- `OutlineWorkflowActions` hidden saat `api-fallback` atau mock mode.
- `planBadge` dari API status (`PLAN_STATUS_LABELS`) termasuk reviewing.

## Limitations

- Tidak ada Playwright E2E khusus `/outline` di smoke:web (masih Sprint 3 scope).
- Tidak ada UI CRUD penuh open loops/reveals (display only).
- Write Room tetap Sprint 1 mock / Sprint 5 nanti.
- Runtime browser API-mode outline flow belum diautomasi di CI.

## Next recommended task

**Task 4.7** — sesuai `docs/32-sprint-4-outline-planning-engine-implementation-plan.md` (verifikasi/closure Sprint 4 atau item berikutnya di plan; bukan Write Room / Sprint 5).