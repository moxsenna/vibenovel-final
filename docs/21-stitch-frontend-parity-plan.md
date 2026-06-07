# 21 — Stitch Frontend Parity Plan

## Purpose

Sprint 1 builds VibeNovel frontend to match Stitch as closely as possible. This is a visual/UX sprint, not a backend sprint.

## Final Stitch source of truth

Use these variants as primary reference:

| Page | Primary Stitch Folder | Notes |
|---|---|---|
| Landing / Selamat Datang | `vibenovel_selamat_datang_polished` | Best polished landing reference |
| Mulai Proyek Baru | `mulai_proyek_baru_polished` | Primary new project entry |
| Dashboard Penulis | `dashboard_penulis_refined` | Best dashboard reference |
| Intake / Beri Tahu Ide | `beri_tahu_ide_ceritamu_refined` | Primary chat intake |
| Pilihan Konsep | `pilihan_konsep_cerita_refined` | 3 concept cards |
| Fondasi Cerita | `fondasi_cerita_refined` | Primary foundation UI |
| Fondasi content fallback | `fondasi_cerita_drama_consistent` | Use for drama-consistent sample content |
| Outline | `outline_cerita_natural_terms` | More natural user-facing terms |
| Tulis Bab Desktop | `tulis_bab` | Desktop writing room |
| Tulis Bab Mobile | `tulis_bab_mobile_polished` | Mobile-specific writing UI |
| Ringkasan Bab | `ringkasan_bab_drama_consistent` | Chapter delta preview direction |
| Paket Publish | `paket_publish_bab_kbm_optimized` | Best KBM-oriented publish UI |
| Pengaturan | `pengaturan_pemakaian` | Usage/credits/settings |

## Design references

Read from Stitch when available:

- `brand_guidelines.md`
- `design_system.md`
- `ui_ux_full.md`
- `serene_creative_studio/DESIGN.md`

## Route map suggestion

```txt
/                         Landing
/start                    Mulai Proyek Baru
/dashboard                Dashboard Penulis
/projects/:id/intake      Chat Story Agent
/projects/:id/concepts    Pilihan Konsep
/projects/:id/foundation  Fondasi Cerita
/projects/:id/outline     Outline
/projects/:id/write       Ruang Tulis
/projects/:id/summary     Ringkasan Bab
/projects/:id/publish     Paket Publish
/settings                 Pengaturan
```

## Shared components

- AppShell
- Sidebar
- MobileHeader
- PageHeader
- Card
- Button
- Badge
- ProgressCard
- ProjectCard
- ConceptCard
- ChatBubble
- ChatInput
- CharacterCard
- LockedFactCard
- ChapterCard
- BeatList
- EditorPanel
- AssistantPanel
- ValidationStatusCard
- CopyButton
- EmptyState

## Dummy data rules

Use typed mock data. Do not hardcode random values inside components.

Suggested mock files:

```txt
src/mocks/projects.ts
src/mocks/storyFoundation.ts
src/mocks/concepts.ts
src/mocks/outline.ts
src/mocks/chapter.ts
src/mocks/publishPackage.ts
src/mocks/settings.ts
```

## Sprint 1 visual parity checklist

- [ ] Colors match Stitch direction.
- [ ] Font and typography hierarchy consistent.
- [ ] Cards use consistent radius/shadow.
- [ ] Buttons match primary/secondary/ghost style.
- [ ] Badges match soft editorial style.
- [ ] Layout spacing consistent.
- [ ] Desktop shell works.
- [ ] Mobile layout is intentionally designed.
- [ ] Writing editor readable.
- [ ] No page feels like unrelated template.

## Strict out-of-scope

Do not implement:

- real AI,
- real auth,
- real payment,
- real Supabase schema,
- real credit deduction,
- real validator,
- real publish API.

If a page needs dynamic data, use typed mock data and write the integration seam clearly.
