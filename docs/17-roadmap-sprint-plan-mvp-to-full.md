# 17 — Roadmap and Sprint Plan: MVP to Full

Dokumen ini adalah pemisah MVP vs Full. Jangan membuat blueprint MVP dan Full terpisah.

## Sprint 0 — Documentation, Rules, and Repo Preparation

Goal:
Menyiapkan blueprint, rule agent, navigation map, dan sprint plan agar vibe coding terarah.

Build:

- `docs/` unified blueprint,
- `.agents/rules/`,
- implementation checklist,
- Stitch UI source of truth,
- sprint acceptance format.

Acceptance criteria:

- agent tahu dokumen mana yang harus dibaca,
- agent tahu Sprint 1 adalah frontend parity,
- tidak ada dokumen `MVP.md` dan `FULL.md` terpisah sebagai sumber arsitektur utama.

---

# Sprint 1 — Stitch Frontend Parity

Risk level: Medium-High because visual parity is easy to drift.

Goal:
Membuat tampilan frontend VibeNovel semirip mungkin dengan desain Stitch menggunakan typed dummy data.

Primary objective:
Saat app dijalankan lokal, produk sudah terasa seperti VibeNovel final secara visual dan UX walau backend belum real.

Source of truth:

- `docs/21-stitch-frontend-parity-plan.md`
- `stitch-reference/STITCH_UI_SOURCE_OF_TRUTH.md`

Scope:

- routing halaman,
- app shell,
- dashboard,
- mulai proyek,
- chat intake,
- concept options,
- fondasi cerita,
- outline,
- ruang tulis desktop/mobile,
- ringkasan bab,
- paket publish,
- pengaturan,
- component system,
- typed dummy data.

Out of scope:

- real Supabase,
- production auth,
- real AI generation,
- OpenRouter integration,
- credit deduction asli,
- validators asli,
- Chapter Delta persistence,
- payment,
- full advanced control.

## Sprint 1 task breakdown

### Task 1.1 — Stitch UI Audit and Parity Checklist

Read:

- `docs/21-stitch-frontend-parity-plan.md`
- `stitch-reference/STITCH_UI_SOURCE_OF_TRUTH.md`

Build:

- route list,
- page list,
- component list,
- final variant decisions,
- parity checklist.

Acceptance:

- no ambiguous Stitch variant remains,
- every page has route target,
- every visual reference has folder name.

### Task 1.2 — Frontend Foundation

Build:

- design tokens,
- global styles,
- reusable components,
- typed mock data,
- route skeleton.

Acceptance:

- no page-level random colors,
- all basic components reusable,
- app runs locally.

### Task 1.3 — App Shell and Navigation

Build:

- desktop sidebar,
- mobile topbar/bottom nav if needed,
- main content area,
- active route state,
- project/credit dummy indicator.

Acceptance:

- shell is shared across workspace pages,
- responsive behavior does not break.

### Task 1.4 — Landing / Selamat Datang

Source: `vibenovel_selamat_datang_polished`

Acceptance:

- hero and CTA match Stitch direction,
- copy does not overpromise,
- CTA goes to dummy project start/dashboard.

### Task 1.5 — Mulai Proyek Baru

Source: `mulai_proyek_baru_polished`

Acceptance:

- entry cards implemented,
- each choice routes to intended dummy flow,
- mobile-first card layout preserved.

### Task 1.6 — Dashboard Penulis

Source: `dashboard_penulis_refined`

Acceptance:

- greeting, active project, recent projects, and CTA implemented,
- empty state exists.

### Task 1.7 — Chat Story Agent Intake

Source: `beri_tahu_ide_ceritamu_refined`

Acceptance:

- chat bubbles,
- input,
- suggested actions,
- progress card,
- CTA to concept options.

### Task 1.8 — Pilihan Konsep Cerita

Source: `pilihan_konsep_cerita_refined`

Acceptance:

- 3 concept cards,
- badges,
- reader promise,
- choose button.

### Task 1.9 — Fondasi Cerita

Source: `fondasi_cerita_refined` with `fondasi_cerita_drama_consistent` content cues.

Acceptance:

- premise,
- characters,
- locked facts,
- conflict,
- reader promise,
- lock button dummy.

### Task 1.10 — Outline Cerita

Source: `outline_cerita_natural_terms`

Acceptance:

- chapter 1–10 list,
- badges for reveal/mini victory/conflict,
- CTA to write chapter.

### Task 1.11 — Ruang Tulis Desktop

Source: `tulis_bab`

Acceptance:

- 3-pane layout,
- scene list,
- editor,
- AI assistant panel,
- validation status dummy.

### Task 1.12 — Ruang Tulis Mobile

Source: `tulis_bab_mobile_polished`

Acceptance:

- mobile-specific layout,
- bottom actions,
- readable editor,
- no desktop squeeze.

### Task 1.13 — Ringkasan Bab

Source: `ringkasan_bab_drama_consistent`

Acceptance:

- intisari,
- fakta baru,
- kemenangan kecil,
- open loop,
- approve/edit dummy actions.

### Task 1.14 — Paket Publish

Source: `paket_publish_bab_kbm_optimized`

Acceptance:

- title,
- teaser,
- caption,
- tags,
- comment bait,
- copy buttons dummy.

### Task 1.15 — Pengaturan Pemakaian

Source: `pengaturan_pemakaian`

Acceptance:

- dummy credits,
- model tier Hemat/Seimbang/Terbaik,
- profile/preference placeholders.

### Task 1.16 — Final Parity and Verification

Acceptance:

- all pages open,
- no major console errors,
- typecheck passes,
- responsive desktop/mobile reviewed,
- visual system feels cohesive.

---

## Sprint 2 — Data Model and Project Persistence

Risk level: High. Split carefully.

Goal:
Replace dummy project data with real persistence.

Tasks:

1. Define schema for projects/story_foundation/characters/facts.
2. Create migrations.
3. Build typed data access layer.
4. Connect dashboard/project CRUD.
5. Keep AI generation mocked.
6. Add tests.

Out of scope:

- real AI generation,
- validators,
- credits.

---

## Sprint 3 — Story Foundation Flow

Risk level: High.

Goal:
Chat intake → concept options → locked Fondasi Cerita stored in database.

Split tasks:

1. Story intake message persistence.
2. Concept generation mock/service boundary.
3. Story Foundation schema completion.
4. Lock Foundation workflow.
5. AI proposal status handling.
6. Tests.

---

## Sprint 4 — Outline and Beat Planning MVP

Goal:
Generate/store 10-chapter outline and beat contracts.

Split tasks:

1. Chapter outline schema.
2. Beat contract schema.
3. Outline generation service boundary.
4. UI connect.
5. Tests.

---

## Sprint 5 — AI Writing Pipeline MVP

Risk level: Critical. Do not implement in one pass.

Goal:
Generate prose for one beat using Context Packet + Reveal Gate + Validator.

Tasks:

1. Context Packet schema.
2. Reveal Gate basic resolver.
3. Prose Writer service.
4. Instruction Compliance Validator.
5. Spoiler Validator basic.
6. Prose Version save.
7. Accept/reject flow.
8. Integration test with future reveal blocked.

---

## Sprint 6 — Chapter Delta and Canon Update

Risk level: Critical.

Goal:
Close chapter and update canonical state.

Tasks:

1. Chapter Delta schema.
2. Delta extraction service.
3. User approval UI.
4. Fact proposal handling.
5. Timeline/character state update.
6. Tests.

---

## Sprint 7 — Publish Package MVP

Goal:
Generate publish package from accepted chapter and summary.

Tasks:

1. Publish package schema.
2. Generate title/teaser/caption/tags/comment bait.
3. Copy UI.
4. Tests.

---

## Full Version Phases

### Full Phase 1 — Advanced Control

- reveal editor,
- context inspector,
- validator override,
- version history,
- style editor.

### Full Phase 2 — Long-form Memory

- RAG retrieval,
- arc summaries,
- long timeline,
- advanced character knowledge,
- voice learning.

### Full Phase 3 — Growth and Analytics

- unlock analytics,
- content performance feedback,
- publish optimization,
- monetization support.
