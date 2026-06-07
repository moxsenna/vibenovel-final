# 22 — Sprint 1 Verification Report

**Sprint:** Sprint 1 — Stitch Frontend Parity  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**App:** `apps/web` (`@vibenovel/web`)

Dokumen ini adalah laporan penutupan resmi Sprint 1. Dibaca oleh developer manusia dan AI agent sebelum memulai pekerjaan berikutnya.

---

## 1. Sprint 1 Summary

### Tujuan Sprint 1

Membangun frontend VibeNovel agar **semirip mungkin dengan desain Stitch** menggunakan **typed dummy data**, tanpa backend production. Produk harus terasa seperti VibeNovel final secara visual dan UX saat dijalankan lokal.

Sumber kebenaran visual:

- `docs/21-stitch-frontend-parity-plan.md`
- `stitch-reference/STITCH_UI_SOURCE_OF_TRUTH.md`

### Status final

| Aspek | Status |
|---|---|
| 12 halaman utama (11 route + landing) | **Final UI** |
| AppShell & navigasi | **Final** |
| Design tokens & komponen reusable | **Final** |
| Typed mock data | **Final** |
| Backend / auth / AI / credits | **Belum ada (by design)** |
| Task 1.1–1.16 | **Selesai & di-approve** |

### Stack frontend

| Layer | Teknologi |
|---|---|
| Build | Vite 5 |
| UI | React 18 + TypeScript |
| Routing | React Router 6 |
| Styling | Tailwind CSS v3 (Serene/Stitch tokens) |
| Icons | Material Symbols Outlined (Google Fonts) |
| Font | Inter |

### Struktur monorepo ringkas

```txt
vibenovel-unified-blueprint/
├── apps/
│   ├── web/          ✅ Frontend Sprint 1 (aktif & selesai)
│   └── api/          ⏳ Placeholder — belum dibangun
├── packages/
│   ├── core/         ⏳ Placeholder — story/AI engine
│   └── shared/       ⏳ Placeholder — shared types
├── supabase/         ⏳ Placeholder — migrations
├── docs/             📘 Blueprint & sprint docs
├── .agents/rules/    🤖 Agent rules
└── stitch-reference/ 🎨 Stitch HTML + screen.png
```

**Perintah root:**

```bash
npm install
npm run dev:web       # dev server
npm run typecheck     # TypeScript check
npm run build:web     # production build
```

---

## 2. Final Route Map

| Route | Halaman | Page component |
|---|---|---|
| `/` | Landing / Selamat Datang | `LandingPage` |
| `/start` | Mulai Proyek Baru | `StartProjectPage` |
| `/dashboard` | Dashboard Penulis | `DashboardPage` |
| `/projects/demo-project-001/intake` | Ceritakan Ide Ceritamu | `IntakePage` |
| `/projects/demo-project-001/concepts` | Pilihan Konsep Cerita | `ConceptsPage` |
| `/projects/demo-project-001/foundation` | Fondasi Cerita | `FoundationPage` |
| `/projects/demo-project-001/outline` | Outline Cerita | `OutlinePage` |
| `/projects/demo-project-001/write` | Ruang Tulis | `WritePage` |
| `/projects/demo-project-001/summary` | Ringkasan Bab | `SummaryPage` |
| `/projects/demo-project-001/publish` | Paket Publish | `PublishPage` |
| `/settings` | Pengaturan Pemakaian | `SettingsPage` |

**Demo project ID:** `demo-project-001` (`DEMO_PROJECT_ID` di `apps/web/src/mocks/projects.ts`)

Router: `apps/web/src/routes/index.tsx`  
Path constants: `apps/web/src/routes/paths.ts`

---

## 3. UI Status per Route

### `/` — Landing

| Field | Value |
|---|---|
| Status | **Final** (marketing standalone) |
| Stitch source | `vibenovel_selamat_datang_polished` |
| AppShell | **Tidak** |
| CTA utama | Mulai Tulis Cerita → `/start`; Lihat Cara Kerja → `#kenapa-vibenovel` |
| Known limitation | Tidak ada auth; preview editor adalah mock statis |

### `/start` — Mulai Proyek Baru

| Field | Value |
|---|---|
| Status | **Final** |
| Stitch source | `mulai_proyek_baru_polished` |
| AppShell | **Ya** |
| CTA utama | Entry cards → intake / outline / summary (sesuai opsi) |
| Known limitation | Upload draft belum nyata; semua alur pakai mock yang sama |

### `/dashboard` — Dashboard Penulis

| Field | Value |
|---|---|
| Status | **Final** (dummy data) |
| Stitch source | `dashboard_penulis_refined` |
| AppShell | **Ya** |
| CTA utama | Lanjut tulis → write; Proyek Baru → `/start`; recent projects → route mock |
| Known limitation | Recent projects dengan ID lain tetap render mock demo; pemakaian AI dummy |

### `/projects/:id/intake` — Chat Story Agent

| Field | Value |
|---|---|
| Status | **Final** (dummy chat) |
| Stitch source | `beri_tahu_ide_ceritamu_refined` |
| AppShell | **Ya** |
| CTA utama | Buat 3 Konsep Cerita → `/projects/:id/concepts` |
| Known limitation | Balasan agent adalah `INTAKE_DUMMY_REPLY` lokal; tidak ada persistence |

### `/projects/:id/concepts` — Pilihan Konsep

| Field | Value |
|---|---|
| Status | **Final** (dummy) |
| Stitch source | `pilihan_konsep_cerita_refined` |
| AppShell | **Ya** |
| CTA utama | Pilih konsep → `/projects/:id/foundation` |
| Known limitation | Konsep tidak di-generate AI; data statis dari mock |

### `/projects/:id/foundation` — Fondasi Cerita

| Field | Value |
|---|---|
| Status | **Final** (dummy) |
| Stitch source | `fondasi_cerita_refined` (+ konten `fondasi_cerita_drama_consistent`) |
| AppShell | **Ya** |
| CTA utama | Kunci fondasi → `/projects/:id/outline` |
| Known limitation | Edit section disabled; lock tidak persist ke DB |

### `/projects/:id/outline` — Outline

| Field | Value |
|---|---|
| Status | **Final** (dummy) |
| Stitch source | `outline_cerita_natural_terms` |
| AppShell | **Ya** |
| CTA utama | Mulai menulis → `/projects/:id/write` |
| Known limitation | Load more disabled; outline statis 10 bab demo |

### `/projects/:id/write` — Ruang Tulis

| Field | Value |
|---|---|
| Status | **Final** (dummy) |
| Stitch source | Desktop: `tulis_bab` · Mobile: `tulis_bab_mobile_polished` |
| AppShell | **Ya** (MobileHeader disembunyikan di route write) |
| CTA utama | Selesai & Lihat Ringkasan Bab → summary; mobile: Ringkasan link |
| Known limitation | Tombol Tulis/Perbaiki/Cek **disabled**; prose statis; tidak ada AI generation |

**Responsive:** Desktop `lg+` = 3 panel (beat list + editor + assistant). Mobile `< lg` = `WriterMobileLayout` + check sheet.

### `/projects/:id/summary` — Ringkasan Bab

| Field | Value |
|---|---|
| Status | **Final** (dummy) |
| Stitch source | `ringkasan_bab_drama_consistent` |
| AppShell | **Ya** |
| CTA utama | Setujui & Buat Paket Publish → publish; kembali ke write |
| Known limitation | Ringkasan statis Bab 1; tidak ada Chapter Delta extractor nyata |

### `/projects/:id/publish` — Paket Publish

| Field | Value |
|---|---|
| Status | **Final** (dummy) |
| Stitch source | `paket_publish_bab_kbm_optimized` |
| AppShell | **Ya** |
| CTA utama | Copy fields; navigasi ke dashboard / summary / outline |
| Known limitation | CopyButton berfungsi lokal; tidak ada publish API / platform integration |

### `/settings` — Pengaturan Pemakaian

| Field | Value |
|---|---|
| Status | **Final** (dummy lokal) |
| Stitch source | `pengaturan_pemakaian` |
| AppShell | **Ya** |
| CTA utama | Mode kualitas (state lokal); Simpan/Batal UI-only |
| Known limitation | Kredit & preferensi dummy; Edit Profil / Lihat Paket disabled; tidak ada billing |

---

## 4. Component Map

### `components/layout/`

- `AppShell` — shell workspace (sidebar + header + main)
- `Sidebar` — navigasi desktop + proyek aktif dummy
- `MobileHeader` — top bar mobile + credit indicator
- `NavItem` — item sidebar dengan active state
- `CreditIndicator` — tampilan kredit dummy

### `components/ui/`

- `Button`, `Card`, `Badge`, `Icon`, `CopyButton` — design system dasar

### `components/landing/`

- `LandingHeader`, `LandingHero`, `AmbientBackground`, `EditorPreviewMock`, `ValuePropsSection`

### `components/start-project/`

- `StartProjectHeader`, `EntryOptionCard`

### `components/dashboard/`

- `DashboardGreeting`, `ActiveProjectCard`, `NewProjectCta`, `RecentProjectsSection`, `RecentProjectCard`, `DashboardEmptyState`

### `components/intake/`

- `IntakePageHeader`, `ChatPanel`, `ChatBubble`, `ChatInput`, `SuggestedActionChips`, `DetectedSignalsPanel`, `IntakeProgressCard`

### `components/concepts/`

- `ConceptsPageHeader`, `ConceptCard`

### `components/foundation/`

- `FoundationPageHeader`, `FoundationSectionCard`, `FoundationCharacterList`, `FoundationWarningPanel`, `FoundationLockCta`

### `components/outline/`

- `OutlinePageHeader`, `OutlineProgressCard`, `OutlineChapterCard`, `OutlineChapterBadge`, `OutlineLoadMoreButton`

### `components/writer/`

- `WriterBeatList`, `WriterEditorPanel`, `WriterAssistantPanel`, `WriterMobileLayout`, `WriterMobileCheckSheet`

### `components/summary/`

- `SummaryPageHeader`, `SummarySynopsisCard`, `SummaryMiniVictoryBanner`, `SummarySectionCard`, `SummaryBulletList`, `SummaryCharacterChanges`, `SummaryOpenLoopsSection`, `SummaryStoryCheckNotes`, `SummaryActionFooter`

### `components/publish/`

- `PublishPageHeader`, `PublishCopyFieldCard`, `PublishTagsCard`, `PublishChecklistCard`, `PublishMobilePreview`, `PublishActionSection`

### `components/settings/`

- `SettingsPageHeader`, `SettingsCreditCard`, `SettingsUsageSection`, `SettingsQualityModeSection`, `SettingsAccountSection`, `SettingsWriterPreferencesSection`, `SettingsSprintNote`, `SettingsActionSection`

### Utilitas navigasi

- `apps/web/src/utils/navigation.ts` — `SIDEBAR_NAV_ITEMS`, `isNavItemActive`, `SPRINT1_UI_ONLY_HINT`

---

## 5. Mock Data Map

| File | Isi | Digunakan di |
|---|---|---|
| `mocks/projects.ts` | `DEMO_PROJECT_ID`, daftar proyek dummy | Navigasi, referensi ID |
| `mocks/shell.ts` | Kredit, judul proyek aktif, user, plan | Sidebar, CreditIndicator |
| `mocks/startProject.ts` | Opsi entry Mulai Proyek + route target | `/start` |
| `mocks/dashboard.ts` | Greeting, proyek aktif, recent, pemakaian AI | `/dashboard` |
| `mocks/intake.ts` | Sesi chat, progress fondasi, signals, dummy reply | `/intake` |
| `mocks/concepts.ts` | 3 konsep cerita + copy halaman | `/concepts` |
| `mocks/storyFoundation.ts` | Fondasi cerita lengkap (tokoh, fakta, rahasia) | `/foundation` |
| `mocks/outline.ts` | Outline 10 bab + progress | `/outline` |
| `mocks/chapter.ts` | Draft Bab 1, beats, story checks, page copy | `/write` |
| `mocks/summary.ts` | Ringkasan Bab 1, delta preview fields | `/summary` |
| `mocks/publishPackage.ts` | Paket publish Bab 1 (teaser, blurb, tags, checklist) | `/publish` |
| `mocks/settings.ts` | Kredit, pemakaian, mode kualitas, preferensi, copy | `/settings` |

**Aturan:** Mock diekspor lewat `mocks/index.ts`. Komponen tidak hardcode nilai acak. Integrasi API ditandai `TODO: Sprint N+`.

**Types:** `apps/web/src/types/` — typed interfaces untuk semua domain di atas.

---

## 6. Dummy / Not Production Areas

Area berikut **belum ada** dan **sengaja tidak diimplementasi** di Sprint 1:

| Area | Status Sprint 1 |
|---|---|
| Backend API (`apps/api`) | Placeholder saja |
| Database / Supabase | Tidak ada schema production |
| Auth / profil nyata | Tidak ada |
| AI generation (intake, prose, konsep) | Dummy reply / data statis |
| Credit deduction / ledger | UI dummy saja |
| Validator asli (Cek Cerita production) | Mock status cards |
| Upload draft | Badge "Upload nyata — nanti"; tidak berfungsi |
| Publish integration (platform eksternal) | Copy lokal saja |
| Payment / billing | Tombol disabled + catatan Sprint 1 |
| Model routing / OpenRouter | Tidak ada; UI hanya Hemat/Seimbang/Terbaik |
| Persistence antar sesi | State lokal peramban (kecuali mock statis) |

Tombol yang terlihat actionable tetapi **belum production** umumnya:

- `disabled` + `title` Sprint 1 hint, atau
- dijelaskan di `SettingsSprintNote` / `intake` input tip / komentar `TODO` di mock.

---

## 7. Guardrails Confirmed

Audit Task 1.15 mengonfirmasi:

| Guardrail | Hasil |
|---|---|
| Tidak ada raw model ID di UI user | ✅ Pass |
| Tidak ada OpenRouter di UI user | ✅ Pass |
| Tidak ada Canonical State, Context Packet, Reveal Gate, Validator, Chapter Delta di UI utama | ✅ Pass (hanya di komentar dev/TODO internal) |
| Tidak ada klaim overpromise (sekali klik jadi novel, tanpa edit, 100% konsisten, pasti viral) | ✅ Pass |
| Istilah user-facing konsisten (Fondasi Cerita, Cek Cerita, Ringkasan Bab, Paket Publish, Mode Kualitas, dll.) | ✅ Pass |
| Mode kualitas hanya Hemat / Seimbang / Terbaik | ✅ Pass |

---

## 8. Verification Results

Dijalankan dari root repo pada penutupan Sprint 1:

### `npm run typecheck`

```
✅ PASS — tsc --noEmit (apps/web), exit code 0
```

### `npm run build:web`

```
✅ PASS — tsc + vite build
   dist/index.html                   0.83 kB
   dist/assets/index-CRCnP0jp.css   41.90 kB
   dist/assets/index-CbfYi53F.js   326.67 kB
   built in ~2s
```

### `npm run dev:web`

```
✅ PASS — Vite dev server starts (port dinamis jika 5173 sibuk)
   Contoh: http://localhost:5173/ atau http://localhost:5184/
```

Tidak ada console error besar yang diketahui pada alur utama setelah Task 1.15 polish.

---

## 9. Manual QA Checklist

| Check | Status | Catatan |
|---|---|---|
| Desktop 1280px+ — semua route terbuka | ✅ | AppShell + sidebar + write 3-panel |
| Desktop 1024px — layout tidak pecah | ✅ | Grid responsif di dashboard, foundation, summary |
| Mobile 375px — tidak horizontal overflow | ✅ | `overflow-x-hidden` di AppShell; footer summary diperbaiki |
| Mobile 430px — spacing & CTA readable | ✅ | Tombol min-h 44px di pola utama |
| Write desktop (`lg+`) | ✅ | Beat list + editor + assistant panel |
| Write mobile (`< lg`) | ✅ | Header sendiri; MobileHeader AppShell hidden |
| CTA flow landing → publish | ✅ | Lihat tabel di bawah |

### CTA flow end-to-end (demo)

```txt
/  →  /start  →  /projects/demo-project-001/intake
              →  /projects/demo-project-001/concepts
              →  /projects/demo-project-001/foundation
              →  /projects/demo-project-001/outline
              →  /projects/demo-project-001/write
              →  /projects/demo-project-001/summary
              →  /projects/demo-project-001/publish
/settings  (independen, via sidebar)
```

Alternatif dari `/start`:

- Ide kasar / belum punya ide → intake
- Sudah punya outline → outline langsung
- Hanya mau cek cerita → summary langsung

---

## 10. Known Limitations (Global Sprint 1)

1. **Satu cerita demo utama** — `demo-project-001` / "Istri yang Mereka Buang" / Bab 1 "Makan Malam yang Dingin". Project ID lain di dashboard mengarah ke halaman yang sama secara fungsional.
2. **Tidak ada persistence** — refresh halaman mengembalikan state mock (kecuali state UI sementara seperti mode kualitas sebelum refresh).
3. **AI actions disabled** di Ruang Tulis — tulis/perbaiki/cek adalah UI preview.
4. **Intake chat** membalas template dummy, bukan agent nyata.
5. **Kredit & settings** tidak terhubung ke ledger atau billing.
6. **`PlaceholderPage.tsx`** masih ada di codebase tetapi tidak dipakai di router.
7. **Tidak ada mobile bottom nav** global seperti beberapa referensi Stitch settings — AppShell memakai top header mobile.
8. **Backend packages** (`api`, `core`, `shared`, `supabase`) masih placeholder.

---

## 11. Recommended Next Step

**Jangan langsung Sprint 2.**

Rekomendasi berikutnya sesuai arah produk:

### Sprint 1.5 — Legacy VibeNovel Audit

Tujuan: audit kodebase / aset VibeNovel lama sebelum membangun persistence dan engine di sprint berikutnya. Identifikasi apa yang bisa dipindahkan, diadaptasi, atau dibuang — tanpa mengubah frontend Sprint 1 yang sudah final.

Setelah audit, barulah lanjut ke **Sprint 2 — Data Model and Project Persistence** (`docs/17-roadmap-sprint-plan-mvp-to-full.md`).

---

## 12. Sprint 1 Closure Decision

| Pertanyaan | Jawaban |
|---|---|
| **Sprint 1 ready to close?** | **Yes** |
| **Blockers** | **None** |
| **Tasks completed** | 1.1 – 1.16 (audit, foundation, 12 halaman, polish QA, verification report) |
| **Recommended next prompt** | Lihat di bawah |

### Recommended next prompt (copy-paste untuk agent/human)

```txt
Lanjut Sprint 1.5 — Legacy VibeNovel Audit.

Baca dulu:
- docs/22-sprint-1-verification-report.md
- docs/17-roadmap-sprint-plan-mvp-to-full.md
- .agents/rules/00-read-first.md

Jangan mulai Sprint 2.
Jangan ubah UI Sprint 1 kecuali bug kecil.
Tujuan: audit legacy VibeNovel dan dokumentasikan temuan + rekomendasi migrasi.
```

---

*Dokumen ini menutup Sprint 1 Stitch Frontend Parity. Perubahan frontend berikutnya harus merujuk laporan ini dan tidak mengasumsikan backend sudah tersedia.*