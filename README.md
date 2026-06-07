# VibeNovel Core v2 — Unified Blueprint Pack

Monorepo VibeNovel: dokumentasi produk + frontend Sprint 1 + backend scaffold Sprint 2 + database lokal.

VibeNovel adalah **AI Serial Fiction Production OS** — bukan chatbot novel biasa. Blueprint MVP dan Full Version disatukan; pemisahan delivery hanya di roadmap/sprint plan.

---

## Struktur repo

```txt
vibenovel-unified-blueprint/
├── apps/
│   ├── web/          ✅ Frontend React — Sprint 1 UI + minimal API integration (Task 2.13)
│   └── api/          ✅ Backend API — Hono/Cloudflare Worker (Task 2.5–2.12)
├── packages/
│   ├── core/         ⏳ Placeholder — story/AI engine (Sprint 4–6+)
│   └── shared/       ✅ Shared domain types & API contracts (Task 2.1)
├── supabase/         ✅ Migration + seed — runtime verified (Task 2.3/2.4)
├── scripts/          ⏳ Placeholder — helper scripts (nanti)
├── docs/             📘 Unified product & technical blueprint
├── .agents/rules/    🤖 Agent behavior rules
└── stitch-reference/ 🎨 Stitch UI source of truth
```

| Folder | Status Sprint 2 | Keterangan |
|---|---|---|
| `apps/web` | **Sprint 2 complete** | UI parity Stitch; dashboard/settings/foundation baca API + fallback mock |
| `apps/api` | **Sprint 2 complete** | Auth, projects, settings, foundation, canon APIs, proposals, credits read |
| `packages/shared` | **Implemented (Task 2.1)** | Domain types, enums, API contracts |
| `packages/core` | Placeholder | Engine AI/story — nanti |
| `supabase` | **Migration + seed (Task 2.3/2.4)** | 10 tabel, RLS, demo seed lokal — `supabase db reset` verified |
| `scripts` | Placeholder | Dev/CI scripts — nanti |
| `docs` | Dokumentasi | Sumber arsitektur & sprint plan |
| `stitch-reference` | Referensi desain | HTML + screen.png per halaman |

---

## Menjalankan dari root (disarankan)

Prasyarat: **Node.js 18+** dan **npm**.

```bash
# Dari root repo
npm install
npm run dev:web    # frontend → http://localhost:5173
npm run dev:api    # API lokal → http://127.0.0.1:8787
```

**Web + API integration (Task 2.13):** salin `apps/web/.env.example` → `apps/web/.env.local`. Default `VITE_USE_MOCKS=true` (UI tetap mock). Set `VITE_USE_MOCKS=false` + login Supabase untuk membaca dashboard/settings/foundation dari API.

### Perintah root

```bash
# Development
npm run dev:web
npm run dev:api

# Typecheck (urutan: shared → web → api)
npm run typecheck
npm run typecheck:shared
npm run typecheck:web
npm run typecheck:api

# Build
npm run build:shared
npm run build:web
npm run build:api      # build:shared otomatis dijalankan dulu

# Preview frontend
npm run preview:web

# API smoke test (Windows/PowerShell — local Supabase + dev:api required)
npm run smoke:api
```

See [`scripts/README.md`](scripts/README.md) for prerequisites.

### Database lokal (Supabase CLI)

Prasyarat: Docker Desktop + [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start
supabase db reset      # migrasi + seed demo
```

Detail: [`supabase/README.md`](supabase/README.md)

---

## Sprint 1 — selesai ✅

**Stitch Frontend Parity** — 12 halaman utama final dengan typed dummy data.

**Laporan penutupan:** [`docs/22-sprint-1-verification-report.md`](docs/22-sprint-1-verification-report.md)

Sudah ada:

- Vite + React 18 + TypeScript + React Router + Tailwind v3
- 12 halaman final (landing + 11 route workspace)
- AppShell, Sidebar, MobileHeader, CreditIndicator
- design tokens Serene/Stitch + komponen reusable per domain
- typed mocks di `apps/web/src/mocks/`
- route QA & polish (Task 1.15)

---

## Sprint 2 — selesai ✅

**Data model, API shell, canon infrastructure, minimal web integration.**

**Rencana:** [`docs/27-sprint-2-data-model-implementation-plan.md`](docs/27-sprint-2-data-model-implementation-plan.md)  
**Laporan penutupan:** [`docs/29-sprint-2-verification-report.md`](docs/29-sprint-2-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 2.1 Shared package | ✅ | `@vibenovel/shared` — domain types, enums |
| 2.2 Supabase setup | ✅ | `config.toml`, RLS policy draft |
| 2.3 Core migration | ✅ | `00001_sprint2_core.sql` — 10 tabel + RLS |
| 2.4 Seed demo | ✅ | `seed.sql` — "Istri yang Mereka Buang" |
| 2.5 API scaffold | ✅ | Hono Worker: health, CORS, error format |
| 2.6 Auth shell | ✅ | JWT auth, profiles sync, `GET /api/me` |
| 2.7 Projects API | ✅ | CRUD + soft archive |
| 2.8 Settings API | ✅ | GET/PUT project settings |
| 2.9 Foundation API | ✅ | Foundation + characters + facts |
| 2.10 Speech rules API | ✅ | CRUD + soft deactivate |
| 2.11 AI proposals API | ✅ | Queue lifecycle (accept status-only) |
| 2.12 Credit balance read | ✅ | `GET /api/credits/balance` |
| 2.13 Web integration | ✅ | Dashboard/settings/foundation + mock fallback |
| 2.14 Verification report | ✅ | `docs/29` + smoke tests |
| 2.15 Smoke test & CI hygiene | ✅ | `npm run smoke:api`, `.github/workflows/ci.yml` |

Belum ada (sengaja — defer Sprint 3+):

- AI generation / OpenRouter
- Credit ledger / deduction
- Outline / chapter / prose persistence
- Publish API, validator, reveal gate
- Remote Cloudflare deploy

---

## Sprint 3 — planning (belum coding)

**Rencana:** [`docs/30-sprint-3-story-foundation-flow-implementation-plan.md`](docs/30-sprint-3-story-foundation-flow-implementation-plan.md)

Intake → concepts → foundation proposal → readiness → lock. Stub backend dulu; OpenRouter/AI production setelah flow data jelas.

**Task berikutnya:** 3.1 — Intake & concept data model migration.

---

## Cara baca dokumentasi

### Untuk manusia

1. `docs/01-product-vision-and-positioning.md`
2. `docs/02-user-personas-and-entry-flows.md`
3. `docs/03-unified-feature-blueprint.md`
4. `docs/17-roadmap-sprint-plan-mvp-to-full.md`
5. `docs/21-stitch-frontend-parity-plan.md`
6. `docs/22-sprint-1-verification-report.md` — status penutupan Sprint 1
7. `docs/29-sprint-2-verification-report.md` — status penutupan Sprint 2
8. `docs/30-sprint-3-story-foundation-flow-implementation-plan.md` — rencana Sprint 3 (aktif)
9. `docs/27-sprint-2-data-model-implementation-plan.md` — rencana Sprint 2

### Untuk AI coding agent

1. `.agents/rules/00-read-first.md`
2. `.agents/rules/01-document-navigation-map.md`
3. `.agents/rules/02-sprint-discipline.md`
4. `docs/17-roadmap-sprint-plan-mvp-to-full.md`
5. `docs/19-implementation-checklist.md`
6. `docs/22-sprint-1-verification-report.md`
7. `docs/29-sprint-2-verification-report.md`
8. `docs/27-sprint-2-data-model-implementation-plan.md`
9. Dokumen domain sesuai task.

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

## Stack

| Layer | Teknologi |
|---|---|
| Frontend (`apps/web`) | Vite · React 18 · TypeScript · React Router · Tailwind CSS v3 |
| API (`apps/api`) | Hono · Cloudflare Workers · Wrangler · TypeScript |
| Shared (`packages/shared`) | TypeScript — domain types & API contracts |
| Database (`supabase`) | Postgres · Supabase CLI · RLS |

Material Symbols (Google Fonts) untuk ikon UI.