# Narraza Dashboard — Multiproject UX Improvement Plan

> Status dokumen: execution plan untuk agent IDE. **Belum dieksekusi** — ini rencana, bukan implementasi.
>
> Sumber temuan: audit UI/UX live pada `https://app.narraza.web.id/dashboard` (login `moxsenna`, ±37 link proyek / ~25+ kartu ter-render sekaligus), 2026-06-18.
>
> Target: mengubah dashboard dari "flat dump semua proyek" menjadi dashboard multiproject yang scalable, mudah di-skim, dan user-friendly.

---

## 0. Ringkasan Masalah (dari audit live)

Dashboard saat ini me-render **seluruh** proyek milik user dalam satu grid panjang (~7 layar ke bawah) tanpa kontrol apa pun. Begitu user punya 50+ proyek, halaman ini tidak terpakai.

| # | Masalah | Severity | Bukti |
|---|---------|----------|-------|
| 1 | Tidak ada **search / filter / sort / pagination** untuk daftar proyek | P0 | `RecentProjectsSection.tsx` map semua proyek tanpa kontrol; backend `GET /api/projects` hanya dukung `includeArchived` |
| 2 | Judul proyek **generik & tak terbedakan** ("Cerita Baru", "Ide Kasar", "Draft Saya" berulang puluhan kali) | P0 | Banyak kartu judul identik + excerpt placeholder sama |
| 3 | **Data tes bocor ke produksi** (`ZZ-TEST-readiness (hapus)`, `ZZ-TEST-s13-foundation (hapus)`, `(boleh dihapus)`) | P0 | Tampil di dashboard live |
| 4 | Tombol **"Lihat Semua" mati** (tidak ada handler / route tujuan) | P1 | `RecentProjectsSection.tsx` — `<button>` tanpa `onClick`; tidak ada route `/projects` |
| 5 | Kartu **kurang informatif untuk skimming** (tanpa progress bab, jumlah kata, badge status warna; tanggal tidak konsisten) | P1 | `RecentProjectCard.tsx` hanya genre + excerpt + 1 status text |
| 6 | Konsep **"1 proyek aktif"** ambigu untuk multiproject | P1 | `pickActiveProject()` ambil `isActive` pertama / fallback `[0]` |
| 7 | **Empty-state & returning-state bercampur** ("Inspirasi sedang menunggumu" muncul bareng grid penuh) | P2 | `DashboardGreeting.tsx` + grid selalu tampil |
| 8 | **Istilah internal tanpa penjelasan** ("Fondasi dikunci", "Gerbang Misteri", "Outline belum dikunci") | P2 | Label status dari `workflow-truth.ts` |
| 9 | Layar lebar (~1900px) — grid mentok 3 kolom, banyak ruang kosong di tepi padahal list sangat panjang | P2 | container `lg:grid-cols-3` |

---

## 1. Aturan Eksekusi untuk Agent IDE

```text
Working rules:
1. Jangan rewrite besar-besaran; satu task = satu commit kecil.
2. Backend dulu (kontrak query), baru UI.
3. Tidak menambah dependency baru kecuali wajib (search/filter cukup native + state lokal).
4. Reuse UI primitives yang ada: Badge, Button, Card, Icon (apps/web/src/components/ui).
   Buat primitive baru (Input/Select/SearchField) hanya bila belum ada.
5. Setelah tiap task: npm run typecheck && npm run build && npm run lint, plus test terkait.
6. Mock parity: setiap perubahan data shape harus tetap jalan di mode mock (shouldUseMocks()).
```

---

## 2. File Map (anchor implementasi)

**Frontend (`apps/web/src`)**
- `pages/DashboardPage.tsx` — komposisi halaman (41 baris).
- `hooks/useDashboardData.ts` — fetch + map data; saat ini `fetchProjects(token, { includeArchived: true })` lalu pisah active vs others.
- `services/projects.ts` — `fetchProjects`, `createProject`, `pickActiveProject`. **Belum ada** archive/update client.
- `components/dashboard/RecentProjectsSection.tsx` — grid + tombol "Lihat Semua" (mati).
- `components/dashboard/RecentProjectCard.tsx` — kartu proyek (genre, excerpt, 1 status, waktu relatif).
- `components/dashboard/ActiveProjectCard.tsx`, `NoActiveProjectCard.tsx`, `NewProjectCta.tsx`, `DashboardGreeting.tsx`, `DashboardEmptyState.tsx`.
- `lib/api-mappers.ts` — `mapProjectToRecentCard`, `formatRelativeTime`, badge classes.
- `routes/paths.ts` — daftar route (belum ada index `/projects`).
- `components/ui/` — Badge, Button, Card, CopyButton, Icon (tidak ada Input/Select).

**Backend (`apps/api/src`)**
- `routes/projects.ts` — `GET /api/projects` hanya baca `includeArchived`.
- `services/project.ts` — `listProjectsForOwner(env, ownerId, includeArchived)`.

**Shared (`packages/shared/src/domain.ts`)**
- `Project`: `id, ownerId, title, genre, status (draft|in_progress|published), currentChapter, entryPath, isActive, lastEditedAt, workflowPhase, createdAt, updatedAt`. Field yang tersedia ini cukup untuk filter/sort tanpa migrasi DB.

---

## 3. Tujuan & Definition of Done

Dashboard dianggap "multiproject yang baik" bila:
1. User dengan 100+ proyek tetap bisa menemukan proyek dalam ≤2 interaksi (search/filter).
2. Tidak ada data tes/internal yang tampil di produksi.
3. Setiap kartu cukup informatif untuk dikenali tanpa membuka (judul bermakna, status, progres, waktu).
4. Daftar tidak me-render ribuan node sekaligus (pagination/limit).
5. Empty-state (user baru) dan returning-state (user lama) dibedakan jelas.

---

## 4. Backlog Berprioritas

### Fase A — P0 (scalability & kebersihan data)

**A1. Sembunyikan proyek tes/internal dari produksi**
- Backend: di `listProjectsForOwner` (atau filter di route), exclude proyek bertanda tes saat `NODE_ENV=production`. Opsi:
  - Pendekatan bersih: tandai via field/flag (mis. konvensi prefix `ZZ-TEST-` → filter), atau lebih baik beri kolom `isTestFixture`/gunakan tag.
  - Pendekatan minimal sekarang: filter judul match `^ZZ-TEST` dan suffix `(hapus)`/`(boleh dihapus)` di production build, lalu jadwalkan cleanup data nyata.
- Tambah task data-cleanup terpisah untuk meng-archive/hapus fixture lama di DB.
- DoD: dashboard produksi tidak menampilkan kartu `ZZ-TEST-*`.

**A2. Kontrak query backend: filter + sort + pagination**
- Perluas `GET /api/projects` menerima query opsional (backward-compatible):
  - `q` (search judul, case-insensitive)
  - `status` (`draft|in_progress|published`, multi via comma)
  - `sort` (`lastEditedAt|createdAt|title`, default `lastEditedAt`)
  - `order` (`asc|desc`, default `desc`)
  - `limit` (default 12) + `cursor`/`offset` (pagination)
- Update `listProjectsForOwner` agar terima opsi ini; query Supabase sudah punya kolom yang dibutuhkan (`lastEditedAt`, `createdAt`, `status`, `title`).
- Kembalikan metadata pagination (`total`/`nextCursor`) — bungkus tanpa merusak `jsonSuccess` shape (mis. `{ items, total, nextCursor }`).
- DoD: endpoint terdokumentasi + test unit untuk tiap param; default call lama tetap jalan.

**A3. Client: search + filter + sort bar di dashboard**
- `services/projects.ts`: `fetchProjects` terima `FetchProjectsOptions` baru (`q, status, sort, order, limit, cursor`).
- `useDashboardData.ts`: pisahkan "active project" (tetap dari `pickActiveProject`) dari "browse list" yang reaktif terhadap kontrol filter (debounce search 300ms).
- UI baru `ProjectToolbar` (search field + status filter chips + sort dropdown). Buat primitive `Input`/`Select` minimal di `components/ui` bila perlu.
- DoD: ketik di search → list ter-filter; ganti sort → urutan berubah; mode mock tetap jalan (filter di sisi client untuk mock).

**A4. Pagination / "Lihat Semua" yang berfungsi**
- Dua opsi (pilih satu, rekomendasi: opsi 1):
  1. **Halaman index `/projects`** penuh dengan toolbar + pagination; dashboard hanya tampilkan ringkasan (mis. 6 terakhir) + "Lihat Semua" → route ini. Tambah `ROUTES.projects` di `paths.ts` + route entry.
  2. Infinite scroll / "Muat lebih banyak" inline di dashboard.
- Hapus tombol mati di `RecentProjectsSection.tsx`, ganti dengan navigasi/handler nyata.
- DoD: tombol "Lihat Semua" mengarah ke daftar lengkap yang ter-paginate.

### Fase B — P1 (keterbacaan & identifikasi)

**B1. Auto-naming proyek bermakna**
- Saat membuat proyek (`createProject` / intake), turunkan judul default dari konsep cerita (genre + premis ringkas), bukan "Cerita Baru".
- Untuk proyek lama bernama generik: tampilkan secondary line (genre + bab + tanggal) agar tetap terbedakan walau judul sama.
- DoD: proyek baru tidak lagi default "Cerita Baru" identik; kartu lama tetap dapat dibedakan.

**B2. Kartu proyek lebih informatif (`RecentProjectCard.tsx`)**
- Tambah: progress bab (`currentChapter` / target bila ada) sebagai progress bar, badge status berwarna (map `workflowPhase`/`status` → warna konsisten), tanggal relatif dengan `title` tanggal absolut (hover).
- Pertimbangkan placeholder cover/thumbnail (opsional, low-cost: inisial + warna genre).
- DoD: tiap kartu menampilkan judul, badge status berwarna, progres, dan waktu konsisten.

**B3. Perjelas "proyek aktif" vs daftar**
- Ubah label jadi "Lanjutkan" / "Terakhir dikerjakan" dengan quick-resume; jangan klaim eksklusif "1 aktif".
- DoD: tidak ada ambiguitas antara hero card dan kartu di grid.

### Fase C — P2 (polish)

**C1. Pisahkan empty-state vs returning-state**
- User tanpa proyek → hanya onboarding (`NoActiveProjectCard` + CTA). User dengan proyek → greeting + toolbar + list, tanpa copy "inspirasi menunggu" yang menyiratkan kosong.

**C2. Tooltip istilah internal**
- Tambah tooltip/penjelasan singkat untuk "Fondasi dikunci", "Outline belum dikunci", "Gerbang Misteri".

**C3. Layout layar lebar**
- Naikkan grid ke `xl:grid-cols-4` dan/atau lebarkan container untuk viewport besar.

---

## 5. Urutan Eksekusi yang Disarankan

```text
A1  (cepat, hilangkan data tes — quick win, low risk)
A2 → A3 → A4  (backbone scalability)
B2 → B1 → B3  (keterbacaan)
C1 → C2 → C3  (polish)
```

Catatan: A1 bisa didahulukan sebagai PR kecil terpisah karena dampak visual besar dengan risiko rendah.

---

## 6. Risiko & Catatan

- **A2 mengubah response shape** bila menambah metadata pagination — bungkus hati-hati agar konsumer lama (`useDashboardData`) tidak pecah; atau pertahankan array untuk default call dan pakai shape baru hanya saat param pagination dikirim.
- **Mock parity**: `shouldUseMocks()` path harus tetap mendemokan filter/sort (lakukan di client untuk mock).
- **Tidak perlu migrasi DB** untuk Fase A–C kecuali A1 memilih kolom `isTestFixture` (opsional). Semua filter/sort pakai kolom `Project` yang sudah ada.
- **Auto-naming (B1)** menyentuh alur intake/create — koordinasikan dengan pipeline konsep agar tidak menimpa judul yang sudah diisi user.

---

## 7. Out of Scope (rencana ini)

- Kolaborasi multi-user / sharing proyek.
- Folder/tag/koleksi proyek (bisa jadi follow-up setelah filter dasar stabil).
- Redesign visual menyeluruh (rencana ini fokus fungsionalitas multiproject + keterbacaan kartu).
