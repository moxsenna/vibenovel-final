# VibeNovel Core v2 — Unified Blueprint Pack

Monorepo VibeNovel: dokumentasi produk + frontend Sprint 1 + backend scaffold Sprint 2 + database lokal.

VibeNovel adalah **AI Serial Fiction Production OS** — bukan chatbot novel biasa. Blueprint MVP dan Full Version disatukan; pemisahan delivery hanya di roadmap/sprint plan.

---

## Struktur repo

```txt
vibenovel-unified-blueprint/
├── apps/
│   ├── web/          ✅ Frontend React — Sprint 1 UI + API integration (Task 2.13, 3.6, 4.6)
│   └── api/          ✅ Backend API — Hono/Cloudflare Worker (Task 2.5–4.5)
├── packages/
│   ├── core/         ⏳ Placeholder — story/AI engine (Sprint 4–6+)
│   └── shared/       ✅ Shared domain types & API contracts (Task 2.1, 4.1)
├── supabase/         ✅ Migration + seed — runtime verified (Task 2.3/2.4, 4.1)
├── scripts/          ✅ Smoke tests — API (2.15, 4.7) + web E2E (3.8)
├── docs/             📘 Unified product & technical blueprint
├── .agents/rules/    🤖 Agent behavior rules
└── stitch-reference/ 🎨 Stitch UI source of truth
```

| Folder | Status Sprint 2 | Keterangan |
|---|---|---|
| `apps/web` | **Sprint 4 complete** | UI parity Stitch; foundation flow + outline cerita API integration |
| `apps/api` | **Sprint 4 complete** | Sprint 2–3 APIs + outline planning engine (generate, CRUD, approve/lock) |
| `packages/shared` | **Implemented (Task 2.1, 4.1)** | Domain types, enums, outline planning contracts |
| `packages/core` | Placeholder | Engine AI/story — nanti |
| `supabase` | **Migration + seed (Task 4.1)** | 18 tabel (+ outline planning), RLS, demo seed — `supabase db reset` verified |
| `scripts` | **Smoke scripts (2.15, 3.8, 4.7–4.8)** | `smoke:api`, `smoke:web`, `smoke:web:outline` — see `scripts/README.md` |
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

**Web + API integration (Task 2.13, 3.6, 4.6, 5.5):** salin `apps/web/.env.example` → `apps/web/.env.local`. Default `VITE_USE_MOCKS=true` (UI tetap mock). Set `VITE_USE_MOCKS=false` + login Supabase untuk API mode: dashboard/settings/foundation (2.13), intake/concepts/foundation flow (3.6), outline cerita generate/edit/approve/lock (4.6), serta ruang tulis session/beats/prose/context preview (5.5).

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

# Web E2E smoke (Playwright — dev:web required; mock mode default)
npm run smoke:web

# Outline page E2E (Task 4.8 — mock default; add -- -IncludeApiMode for API flow)
npm run smoke:web:outline
```

See [`scripts/README.md`](scripts/README.md) for prerequisites (env: `VITE_USE_MOCKS`, `VITE_API_URL`, `VITE_SUPABASE_*`).

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

## Sprint 3 — selesai ✅

**Story foundation flow — intake → concepts → foundation proposal → readiness → lock.**

**Rencana:** [`docs/30-sprint-3-story-foundation-flow-implementation-plan.md`](docs/30-sprint-3-story-foundation-flow-implementation-plan.md)  
**Laporan penutupan:** [`docs/31-sprint-3-verification-report.md`](docs/31-sprint-3-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 3.0 Flow plan | ✅ | `docs/30` |
| 3.1 Data model migration | ✅ | `00002_sprint3_intake_concepts.sql` + shared types |
| 3.2 Intake API | ✅ | Sessions, messages, signals, agent stub |
| 3.3 Concept options API | ✅ | Generate/list/select 3 concepts |
| 3.4 Foundation proposal + readiness | ✅ | Stub batch → `ai_proposals`, readiness score |
| 3.5 Lock foundation workflow | ✅ | Safe promotion + `foundation_locked` |
| 3.6 Web integration | ✅ | Intake/concepts/foundation + mock fallback |
| 3.7 Verification report | ✅ | `docs/31` + smoke tests |
| 3.8 Web E2E smoke automation | ✅ | `npm run smoke:web`, Playwright + manual checklist |

Belum ada (sengaja — defer Sprint 4+):

- OpenRouter / AI generation production
- Outline / chapter / prose persistence
- Web E2E in GitHub Actions CI (deferred — local smoke only)
- Full proposal reject/merge UI

---

## Sprint 4 — selesai ✅

**Outline Planning Engine — rencana 10 bab, tracking, approve/lock.**

**Rencana:** [`docs/32-sprint-4-outline-planning-engine-implementation-plan.md`](docs/32-sprint-4-outline-planning-engine-implementation-plan.md)  
**Laporan penutupan:** [`docs/33-sprint-4-verification-report.md`](docs/33-sprint-4-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 4.0 Flow plan | ✅ | `docs/32` |
| 4.1 Data model migration | ✅ | `00003_sprint4_outline_planning.sql` + shared types |
| 4.2 Outline generation stub API | ✅ | GET/POST outline bundle + generate |
| 4.2b Generation scope fix | ✅ | 3 loops / 3 reveals (MVP) |
| 4.3 Chapter outline CRUD API | ✅ | GET/PATCH chapters |
| 4.4 Open loop / reveal tracking API | ✅ | CRUD + `planningTruth` redaction |
| 4.5 Approve/lock workflow API | ✅ | `reviewing` → `outline_locked` |
| 4.6 Web OutlinePage integration | ✅ | API mode + mock fallback |
| 4.7 Verification report | ✅ | `docs/33` + `sprint4-smoke-api.ps1` |
| 4.8 Outline web E2E smoke | ✅ | `smoke:web:outline`, `sprint4-outline-flow.spec.ts` |

Belum ada (sengaja — defer Sprint 5+):

- Write Room persistence / prose generation
- Writer Context Packet
- OpenRouter / AI generation
- Outline web E2E (`npm run smoke:web:outline`) — Task 4.8 ✅
- Web E2E in GitHub Actions CI

**Task berikutnya (disarankan):** Sprint 5 — Safe Write Room & Context Packet.

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
8. `docs/31-sprint-3-verification-report.md` — status penutupan Sprint 3
9. `docs/33-sprint-4-verification-report.md` — status penutupan Sprint 4
10. `docs/32-sprint-4-outline-planning-engine-implementation-plan.md` — rencana Sprint 4
11. `docs/30-sprint-3-story-foundation-flow-implementation-plan.md` — rencana Sprint 3
10. `docs/27-sprint-2-data-model-implementation-plan.md` — rencana Sprint 2

### Untuk AI coding agent

1. `.agents/rules/00-read-first.md`
2. `.agents/rules/01-document-navigation-map.md`
3. `.agents/rules/02-sprint-discipline.md`
4. `docs/17-roadmap-sprint-plan-mvp-to-full.md`
5. `docs/19-implementation-checklist.md`
6. `docs/22-sprint-1-verification-report.md`
7. `docs/29-sprint-2-verification-report.md`
8. `docs/31-sprint-3-verification-report.md`
9. `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
10. `docs/27-sprint-2-data-model-implementation-plan.md`
11. Dokumen domain sesuai task.

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