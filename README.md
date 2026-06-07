# VibeNovel Core v2 — Unified Blueprint Pack

Monorepo VibeNovel: dokumentasi produk + frontend Sprint 1 + placeholder untuk backend, engine, dan database.

VibeNovel adalah **AI Serial Fiction Production OS** — bukan chatbot novel biasa. Blueprint MVP dan Full Version disatukan; pemisahan delivery hanya di roadmap/sprint plan.

---

## Struktur repo

```txt
vibenovel-unified-blueprint/
├── apps/
│   ├── web/          ✅ Frontend React — Sprint 1 selesai (mock data)
│   └── api/          ⏳ Placeholder — backend API (Sprint 2+)
├── packages/
│   ├── core/         ⏳ Placeholder — story/AI engine (Sprint 4–6+)
│   └── shared/       ⏳ Placeholder — shared types/schema (Sprint 2+)
├── supabase/         ⏳ Placeholder — DB migrations (Sprint 2+)
├── scripts/          ⏳ Placeholder — helper scripts (nanti)
├── docs/             📘 Unified product & technical blueprint
├── .agents/rules/    🤖 Agent behavior rules
└── stitch-reference/ 🎨 Stitch UI source of truth
```

| Folder | Status Sprint 1 | Keterangan |
|---|---|---|
| `apps/web` | **Selesai (Sprint 1)** | UI parity Stitch final, typed dummy data |
| `apps/api` | Placeholder | README saja — jangan bangun API |
| `packages/core` | Placeholder | Engine AI/story — nanti |
| `packages/shared` | Placeholder | Shared types — nanti |
| `supabase` | Placeholder | Migrations — nanti |
| `scripts` | Placeholder | Dev/CI scripts — nanti |
| `docs` | Dokumentasi | Sumber arsitektur & sprint plan |
| `stitch-reference` | Referensi desain | HTML + screen.png per halaman |

---

## Menjalankan dari root (disarankan)

Prasyarat: **Node.js 18+** dan **npm**.

```bash
# Dari root repo
npm install
npm run dev:web
```

Buka **http://localhost:5173**

Perintah root:

```bash
npm run dev:web       # dev server frontend
npm run typecheck     # TypeScript check (web)
npm run typecheck:web # sama dengan typecheck
npm run build:web     # build produksi apps/web → dist/
npm run preview:web   # preview build produksi
```

## Menjalankan langsung dari apps/web

Masih didukung untuk development lokal:

```bash
cd apps/web
npm run dev
npm run typecheck
npm run build
npm run preview
```

Dengan npm workspaces, `npm install` dari **root** sudah cukup — dependensi di-hoist ke root `node_modules`.

---

## Sprint 1 — selesai ✅

**Stitch Frontend Parity** — 12 halaman utama final dengan typed dummy data. Belum ada backend production.

**Laporan penutupan:** [`docs/22-sprint-1-verification-report.md`](docs/22-sprint-1-verification-report.md)

Sudah ada:

- Vite + React 18 + TypeScript + React Router + Tailwind v3
- 12 halaman final (landing + 11 route workspace)
- AppShell, Sidebar, MobileHeader, CreditIndicator
- design tokens Serene/Stitch + komponen reusable per domain
- typed mocks di `apps/web/src/mocks/`
- route QA & polish (Task 1.15)

Belum ada (sengaja — bukan Sprint 1):

- backend API, Supabase, auth, AI generation nyata
- credit ledger, validator production, publish API
- persistence proyek ke database

**Catatan:** Aplikasi masih memakai mock data. Menjalankan `npm run dev:web` menampilkan UI final, bukan produk backend-connected.

**Langkah berikutnya:** Sprint 1.5 — Legacy VibeNovel Audit (bukan Sprint 2).

---

## Cara baca dokumentasi

### Untuk manusia

1. `docs/01-product-vision-and-positioning.md`
2. `docs/02-user-personas-and-entry-flows.md`
3. `docs/03-unified-feature-blueprint.md`
4. `docs/17-roadmap-sprint-plan-mvp-to-full.md`
5. `docs/21-stitch-frontend-parity-plan.md`
6. `docs/22-sprint-1-verification-report.md` — status penutupan Sprint 1

### Untuk AI coding agent

1. `.agents/rules/00-read-first.md`
2. `.agents/rules/01-document-navigation-map.md`
3. `.agents/rules/02-sprint-discipline.md`
4. `docs/17-roadmap-sprint-plan-mvp-to-full.md`
5. `docs/19-implementation-checklist.md`
6. `docs/22-sprint-1-verification-report.md` — baca sebelum Sprint 2+
7. Dokumen domain sesuai task.

---

## Prinsip teknis utama

```txt
Planner boleh tahu masa depan.
Writer tidak boleh menerima masa depan mentah.
Canonical Story State adalah sumber kebenaran.
Context Packet adalah satu-satunya jalur konteks ke AI Writer.
AI output tidak otomatis menjadi canon.
Validator wajib sebelum output dianggap siap.
Chapter Delta wajib setelah chapter selesai.
```

---

## Stack frontend (`apps/web`)

Vite · React 18 · TypeScript · React Router · Tailwind CSS v3 · Material Symbols (Google Fonts)