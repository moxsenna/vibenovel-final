# Eksekusi — Dashboard Multiproject UX (dari doc 113)

> **Sumber:** `docs/113-dashboard-multiproject-ux-improvement-plan.md`  
> **Status:** Fase A–C diimplementasi di repo (2026-06-18); deploy produksi terpisah.
> **Chore selesai (2026-06-18):** `apps/api/dist-production/` di `.gitignore` + untrack dari git (`dc71c66`).

---

## Koreksi fakta (jangan ulangi kesalahan di doc §2)

| Klaim lama di doc 113 | Keadaan repo saat ini |
|----------------------|------------------------|
| "Backend belum ada archive/update" | **Sudah ada:** `PATCH /api/projects/:id` → `updateProjectForOwner`, `DELETE /api/projects/:id` → `archiveProjectForOwner` (`apps/api/src/routes/projects.ts` L37–50). |
| "Belum ada archive/update **client**" | **Benar untuk web:** `apps/web/src/services/projects.ts` hanya `fetchProjects`, `createProject`, `pickActiveProject`. Tambah `updateProject` / `archiveProject` **opsional** (bukan blocker Fase A). |
| `GET /api/projects` hanya `includeArchived` | **Benar** — perlu **perluasan** query di route + `listProjectsForOwner`, bukan route baru. |

**Implikasi A1:** filter tes bisa di **service** `listProjectsForOwner` (production) tanpa endpoint baru. Cleanup DB fixture = task terpisah (opsional archive via DELETE yang sudah ada).

**Implikasi A2 — bentuk respons `jsonSuccess`:**

- Saat ini: `data: Project[]` (array).
- Dengan pagination: `data: { items: Project[]; total: number; nextCursor: string | null }`.
- **Jangan** mengubah semua pemanggil sekaligus. Strategi:
  1. **Backward-compatible:** jika **tidak** ada `limit`/`cursor` di query → tetap kembalikan `data: Project[]` (perilaku lama).
  2. Jika ada `limit` (atau `cursor`) → kembalikan `data: { items, total, nextCursor }`.
  3. Web client:
     - `fetchProjects(...)` → tetap `Promise<Project[]>` (parse array atau `items` jika server salah kirim — prefer hanya array path).
     - `fetchProjectsPage(options)` → `Promise<ProjectsPage>` baru, `apiRequest<ProjectsPage>` eksplisit.
- Pemanggil array yang ada (**jangan pecah**): `useActiveProject`, `useFoundationData`, `useSettingsData`, `project-context`, `useDashboardData` (untuk `pickActiveProject` — bisa tetap satu fetch penuh atau fetch ringan terpisah nanti).

---

## Definition of Done (ringkas)

1. Produksi: tidak ada kartu `ZZ-TEST-*` / judul `(hapus)` / `(boleh dihapus)`.
2. Browse 100+ proyek: search + filter status + sort + halaman berikutnya dalam ≤2 interaksi.
3. "Lihat Semua" → `/projects` dengan toolbar + pagination.
4. Mock (`shouldUseMocks()`): filter/sort/pagination disimulasikan di client.
5. Setiap task: `npm run typecheck && npm run build && npm run lint` + test terkait.

---

## Urutan & PR kecil (satu task ≈ satu commit)

```text
A1 → A2 → A3 → A4 → B2 → B1 → B3 → C1 → C2 → C3
```

---

## Fase A — P0

### Task A1 — Sembunyikan fixture tes (production)

**File:** `apps/api/src/services/project.ts` — `listProjectsForOwner` (setelah query Supabase, sebelum map ke `Project`).

**Logika (minimal, tanpa migrasi):**

- Jika `bindings` / env menandai production (`NODE_ENV === "production"` atau flag app yang sudah dipakai di API):
  - Exclude `title` match `/^ZZ-TEST/i` ATAU mengandung `(hapus)` / `(boleh dihapus)` (sesuaikan dengan data live di audit).
- Dev/staging: tidak filter (agar QA masih lihat fixture).

**Opsional follow-up:** script admin/archive fixture lama via `DELETE /api/projects/:id` yang sudah ada.

**Test:** unit di `apps/api` untuk `listProjectsForOwner` dengan row fixture mock — tidak muncul saat production flag.

**DoD:** dashboard produksi tanpa kartu tes.

---

### Task A2 — Perluas `GET /api/projects` (query + pagination)

**File:**

- `apps/api/src/routes/projects.ts` — parse query: `q`, `status` (comma), `sort` (`lastEditedAt|createdAt|title`), `order` (`asc|desc`), `limit` (default 12 saat mode page), `cursor` atau `offset`.
- `apps/api/src/services/project.ts` — `ListProjectsOptions` + implementasi filter/sort di Supabase (`ilike` title, `in` status, `order`, `range`/`limit`).

**Kontrak respons (kritis):**

| Query | `jsonSuccess` → `data` |
|-------|-------------------------|
| Tanpa `limit` dan tanpa `cursor` | `Project[]` (**unchanged**) |
| Dengan `limit` atau `cursor` | `{ items: Project[]; total: number; nextCursor: string \| null }` |

**Test:** route/service tests untuk default array, search `q`, sort, page metadata.

**DoD:** dokumentasi query di komentar route atau README API singkat; default call lama tetap array.

---

### Task A3 — Toolbar + hook browse

**File baru / ubah:**

- `apps/web/src/services/projects.ts` — `FetchProjectsOptions` perluas; tambah `fetchProjectsPage`, type `ProjectsPage`.
- `apps/web/src/hooks/useProjectBrowse.ts` (baru) — state `q`, `status`, `sort`, `order`, `cursor`; debounce search 300ms; mock path filter di client dari `mockProjects`.
- `apps/web/src/components/dashboard/ProjectToolbar.tsx` (baru) — search + chip status + sort.
- `apps/web/src/components/ui/Input.tsx` (minimal) bila belum ada — reuse `Button`, `Badge`, `Icon`.

**`useDashboardData.ts`:**

- Pisah: (1) active hero — tetap `pickActiveProject` dari fetch array atau proyek aktif; (2) daftar "Proyek Lainnya" — **limit 6** via `fetchProjectsPage` / filter exclude active id.
- Jangan render seluruh `others` dari satu array panjang.

**DoD:** ketik search → list berubah; mock mode sama.

---

### Task A4 — `/projects` + "Lihat Semua"

**File:**

- `apps/web/src/routes/paths.ts` — `ROUTES.projects: "/projects"`.
- `apps/web/src/routes/index.tsx` — route `ProjectsIndexPage`.
- `apps/web/src/pages/ProjectsIndexPage.tsx` — `ProjectToolbar` + grid + pagination ("Muat lebih" / next cursor).
- `apps/web/src/components/dashboard/RecentProjectsSection.tsx` — ganti `<button>` mati → `<Link to={ROUTES.projects}>`.

**DoD:** klik "Lihat Semua" membuka daftar lengkap ter-paginate.

---

## Fase B — P1

### Task B2 — Kartu lebih informatif

**File:** `RecentProjectCard.tsx`, `api-mappers.ts` (`mapProjectToRecentCard`).

- Badge warna dari `workflowPhase` / `status` (reuse mapping di `workflow-truth` bila ada).
- Progress: `currentChapter` (+ label bab).
- Waktu relatif + `title` absolut (ISO) on hover.

### Task B1 — Auto-naming

**File:** `createProjectForOwner` / intake default title — judul dari genre + premis ringkas, bukan "Cerita Baru" identik.

**Kartu lama:** secondary line (genre · bab · tanggal) jika judul generik.

**Hati-hati:** jangan timpa judul yang user sudah edit.

### Task B3 — Label "Lanjutkan" / "Terakhir dikerjakan"

**File:** `ActiveProjectCard.tsx`, copy di `mapProjectToActiveCard`.

---

## Fase C — P2

| Task | File utama | Perubahan |
|------|------------|-----------|
| C1 | `DashboardPage.tsx`, `DashboardGreeting.tsx` | Tanpa proyek → onboarding saja; ada proyek → tanpa copy "inspirasi kosong". |
| C2 | `RecentProjectCard` / tooltip komponen kecil | Penjelasan "Fondasi dikunci", dll. |
| C3 | `RecentProjectsSection`, container dashboard | `xl:grid-cols-4`, lebar container layar besar. |

---

## Checklist verifikasi per fase

**Setelah A:**

- [ ] `GET /api/projects` tanpa param → masih `Project[]` di `data`.
- [ ] `GET /api/projects?limit=12` → `data.items` + `total`.
- [ ] `useActiveProject` / settings masih compile tanpa ubah signature `fetchProjects`.
- [ ] Dashboard: ≤6 kartu "lainnya" + link ke `/projects`.
- [ ] Live/staging smoke: login akun banyak proyek — scroll pendek, search bekerja.

**Setelah B+C:**

- [ ] Proyek baru judul tidak duplikat generik semua.
- [ ] Empty vs returning state jelas di UI.

---

## Out of scope (tetap)

Kolaborasi, folder/tag, redesign visual penuh — sama seperti doc 113 §7.

---

## Referensi anchor (quick)

| Area | Path |
|------|------|
| Dashboard compose | `apps/web/src/pages/DashboardPage.tsx` |
| Data dashboard | `apps/web/src/hooks/useDashboardData.ts` |
| Grid mati | `apps/web/src/components/dashboard/RecentProjectsSection.tsx` L19–25 |
| API list | `apps/api/src/routes/projects.ts` L15–20 |
| List service | `apps/api/src/services/project.ts` `listProjectsForOwner` |
| Shared type | `packages/shared/src/domain.ts` `Project` |
| Pemanggil `fetchProjects` | `useDashboardData`, `useActiveProject`, `useFoundationData`, `useSettingsData`, `lib/project-context.ts` |