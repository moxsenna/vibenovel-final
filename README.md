# VibeNovel Core v2 — Unified Blueprint Pack

Monorepo VibeNovel: dokumentasi produk + frontend Sprint 1 + backend scaffold Sprint 2 + database lokal.

VibeNovel adalah **AI Serial Fiction Production OS** — bukan chatbot novel biasa. Blueprint MVP dan Full Version disatukan; pemisahan delivery hanya di roadmap/sprint plan.

---

## Struktur repo

```txt
vibenovel-unified-blueprint/
├── apps/
│   ├── web/          ✅ Frontend React — Sprint 1 UI + API integration (through Sprint 7)
│   └── api/          ✅ Backend API — Hono/Cloudflare Worker (Sprint 2–7)
├── packages/
│   ├── core/         ⏳ Placeholder — story/AI engine (Sprint 4–6+)
│   └── shared/       ✅ Shared domain types & API contracts (Task 2.1, 4.1)
├── supabase/         ✅ Migration + seed — runtime verified (Task 2.3/2.4, 4.1)
├── scripts/          ✅ Smoke tests — API (2.15, 5.6) + web E2E (3.8, 4.8, 5.6)
├── docs/             📘 Unified product & technical blueprint
├── .agents/rules/    🤖 Agent behavior rules
└── stitch-reference/ 🎨 Stitch UI source of truth
```

| Folder | Status | Keterangan |
|---|---|---|
| `apps/web` | **Sprint 7 complete** | UI parity Stitch; foundation + outline + Write Room + Summary + Publish page API integration |
| `apps/api` | **Sprint 7 complete** | Sprint 2–7 APIs + write room + summary/delta + publish package |
| `packages/shared` | **Implemented (Task 2.1–7.1, 8.1)** | Domain types, enums, write room + summary/delta + publish + AI generation contracts |
| `packages/core` | Placeholder | Engine AI/story — nanti |
| `supabase` | **Migration + seed (Task 8.1)** | 30 tabel (+ generation_attempts, credit_ledger), RLS, demo seed — `supabase db reset` verified |
| `scripts` | **Smoke scripts (through 7.5)** | `smoke:api`, `smoke:api:sprint5/6/7`, `smoke:web:summary`, `smoke:web:publish` — see `scripts/README.md` |
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

**Web + API integration (Task 2.13, 3.6, 4.6, 5.5, 6.5, 7.4):** salin `apps/web/.env.example` → `apps/web/.env.local`. Default `VITE_USE_MOCKS=true` (UI tetap mock). Set `VITE_USE_MOCKS=false` + login Supabase untuk API mode: dashboard/settings/foundation (2.13), intake/concepts/foundation flow (3.6), outline cerita generate/edit/approve/lock (4.6), ruang tulis session/beats/prose/context preview (5.5), ringkasan bab generate/delta/approve/proposal review (6.5), serta paket publish load/generate/edit/checklist/mark-exported (7.4).

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

# API smoke — Sprint 2 regression (17 steps; unchanged semantics)
npm run smoke:api
npm run smoke:api:base          # alias

# API smoke — Sprint 5 Write Room safety (49 steps)
npm run smoke:api:sprint5

# API smoke — Sprint 6 summary/delta/approval safety (Task 6.6)
npm run smoke:api:sprint6

# API smoke — Sprint 7 publish package safety (Task 7.5)
npm run smoke:api:sprint7

# Web E2E smoke (Playwright — dev:web required; mock mode default)
npm run smoke:web
npm run smoke:web:outline
npm run smoke:web:write
npm run smoke:web:write-ai    # WritePage AI button (Task 8.5; API mode: VITE_USE_MOCKS=false)
npm run smoke:web:summary
npm run smoke:web:publish

# API smoke — Sprint 8 AI prose beat generation (Task 8.4)
npm run smoke:api:sprint8

# Full local suite — Sprint 2/5/6/7/8 API + Sprint 3–8 web mock (11 phases)
npm run smoke:all:local

# Full local + web API-mode E2E incl. summary/publish (VITE_USE_MOCKS=false + restart dev:web)
npm run smoke:all:local:full
```

See [`scripts/README.md`](scripts/README.md) for prerequisites. **Debt register:** [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](docs/36-non-blocking-technical-debt-and-deferred-items.md).

### Local verification (Sprint 7 closure)

See [`docs/40-sprint-7-verification-report.md`](docs/40-sprint-7-verification-report.md).

### Local verification (Sprint 6 closure)

Recommended order (local machine with Docker + Supabase + `dev:api` + `dev:web`):

```bash
npm run typecheck
npm run build:shared
npm run build:web
npm run build:api
supabase db reset
npm run smoke:api
npm run smoke:api:sprint5
npm run smoke:api:sprint6
npm run smoke:api:sprint7
npm run smoke:web
npm run smoke:web:outline
npm run smoke:web:write
npm run smoke:web:summary
npm run smoke:web:publish
```

Optional full browser API-mode:

```bash
npm run smoke:web:publish -- -IncludeApiMode
npm run smoke:all:local:full   # or per-page -- -IncludeApiMode
```

**Do not commit** `apps/web/.env.local` or `apps/api/.dev.vars`.

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

- OpenRouter / AI generation
- Web E2E in GitHub Actions CI

---

## Sprint 5 — selesai ✅

**Safe Write Room & Context Packet — session, beats, prose draft, preview-only context.**

**Rencana:** [`docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`](docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md)  
**Laporan penutupan:** [`docs/35-sprint-5-verification-report.md`](docs/35-sprint-5-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 5.0 Flow plan | ✅ | `docs/34` |
| 5.1 Data model migration | ✅ | `00004_sprint5_write_room.sql` + shared types + seed beats |
| 5.2 Context Packet Builder API | ✅ | Preview-only POST/GET; safety assertion |
| 5.3 Writing session & beat API | ✅ | Session, beats/generate, PATCH |
| 5.4 Prose draft persistence API | ✅ | Versioned save, make-current |
| 5.5 WritePage web integration | ✅ | `useWriteRoomData` + mock fallback |
| 5.6 Safety tests & leak guards | ✅ | `sprint5-smoke-api.ps1`, `smoke:web:write` |
| 5.7 Verification report | ✅ | `docs/35` + full smoke verification |
| 5.8 Stabilization & debt register | ✅ | `docs/36`, smoke aliases, `smoke:all:local` |

Belum ada (sengaja — defer Sprint 7+):

- Publish package / KBM export
- OpenRouter / AI prose generation
- Credit deduction
- Web E2E in GitHub Actions CI

---

## Sprint 6 — selesai ✅

**Chapter Summary, Chapter Delta & Canon Proposal Flow — summary persistence, proposal queue, explicit promotion.**

**Rencana:** [`docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`](docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md)  
**Laporan penutupan:** [`docs/38-sprint-6-verification-report.md`](docs/38-sprint-6-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 6.0 Flow plan | ✅ | `docs/37` |
| 6.1 Data model migration | ✅ | `00005_sprint6_chapter_summary_delta.sql` + shared types |
| 6.2 Summary generation stub API | ✅ | POST generate + GET list/detail/by-chapter |
| 6.3 Delta + proposal extraction API | ✅ | POST extract + GET delta/proposals |
| 6.4 Summary approval + promotion API | ✅ | approve / accept / reject linked proposals |
| 6.5 SummaryPage web integration | ✅ | `useSummaryData` + mock fallback |
| 6.6 Safety & regression tests | ✅ | `sprint6-smoke-api.ps1` (59), `smoke:web:summary` |
| 6.7 Verification report | ✅ | `docs/38` + full smoke verification |

Belum ada (sengaja — defer Sprint 7+):

- Publish package / KBM export
- OpenRouter / AI generation production
- UI `confirmHighRisk` untuk reveal berisiko tinggi
- Credit deduction
- Web E2E in GitHub Actions CI

---

## Sprint 7 — selesai ✅

**Publish Package / KBM Export Flow — copy-ready artifact setelah summary approved; manual copy only.**

**Rencana:** [`docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md`](docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md)  
**Laporan penutupan:** [`docs/40-sprint-7-verification-report.md`](docs/40-sprint-7-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 7.0 Flow plan | ✅ | `docs/39` |
| 7.1 Data model migration | ✅ | `00006_sprint7_publish_package.sql` + shared types |
| 7.2 Publish package generation API | ✅ | POST generate + GET list/detail/by-chapter |
| 7.3 Field/checklist/mark-exported API | ✅ | PATCH fields/checklist + POST mark-exported |
| 7.4 PublishPage web integration | ✅ | `usePublishData` + mock fallback |
| 7.5 Safety & E2E regression tests | ✅ | `sprint7-smoke-api.ps1` (50), `smoke:web:publish` |
| 7.6 Verification report | ✅ | `docs/40` + full smoke verification |

Belum ada (sengaja — defer setelah hardening / Sprint 8):

- KBM auto-post / platform OAuth
- OpenRouter / AI generation production
- Credit deduction / ledger
- UI regenerate publish package / chapter picker
- Export audit log table
- Web E2E in GitHub Actions CI

---

## Sprint 7.8 — Pre-AI Hardening ✅

**Audit logs, transaction-like P0 guards, smoke consolidation — closed.**

**Rencana:** [`docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`](docs/41-pre-ai-hardening-audit-transactions-ci-plan.md)  
**Audit enum:** [`docs/42-audit-action-enum-and-coverage-plan.md`](docs/42-audit-action-enum-and-coverage-plan.md)  
**Verifikasi penutupan:** [`docs/43-pre-ai-hardening-verification-report.md`](docs/43-pre-ai-hardening-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 7.8 Pre-AI hardening plan | ✅ | `docs/41` |
| 7.8.1 Audit enum + coverage plan | ✅ | `docs/42` |
| 7.8.2 Audit log implementation (P0+P1) | ✅ | `00007` + audit writers |
| 7.8.3 Transaction-like P0 hardening | ✅ | `transaction.ts` + P0 services |
| 7.8.4 Smoke orchestration | ✅ | `smoke:all:local` 9 phases |
| 7.8.6 Hardening verification report | ✅ | `docs/43` |

---

## Sprint 9 — AI Rewrite, Publish Copy & Credit UI (planning)

**Rencana:** [`docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`](docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md)  
**Prerequisite:** Live OpenRouter staging **GO** — [`docs/47`](docs/47-live-openrouter-staging-smoke-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 9.0 Implementation plan | ✅ | `docs/48` |
| 9.1 Cost estimation | ✅ | `model-cost-map.ts`, `estimated_cost_usd` on success |
| 9.2 Credit UI minimal | ✅ | WritePage saldo/biaya kredit, `smoke:web:credit-ui` |
| 9.3 Prose rewrite API | ✅ | `POST /ai/rewrite-prose`, `smoke:api:sprint9` |
| 9.4 WritePage rewrite UI | ✅ | `POST /ai/rewrite-prose` UI, `smoke:web:rewrite` (API-mode E2E verified 9.4b) |
| 9.5 Publish copy AI API | ✅ | `POST /ai/improve-publish-copy`, suggestion-first, `smoke:api:sprint9` |
| 9.6 PublishPage AI UI | ⏳ | Improve copy + apply via PATCH |
| 9.7 Safety regression | ⏳ | Sprint 9 smokes |
| 9.8 Verification report | ⏳ | `docs/49` |

**Task berikutnya (disarankan):** **Task 9.6** — PublishPage AI UI (apply suggestions via existing PATCH).

**Rewrite UI (Task 9.4):** Tersedia di mode API pada WritePage — mode perbaikan (emosi/pacing/dialog/panjang/custom), biaya rewrite 3/6/12 kredit (hemat/seimbang/terbaik), hasil disimpan sebagai versi prose baru. Mock/fallback tidak memalsukan rewrite. Top up belum tersedia.

**Publish copy AI (Task 9.5):** `POST /ai/improve-publish-copy` mengembalikan saran teaser/caption/reader question/sinopsis singkat/next chapter teaser — **tidak** auto-patch paket publish. Biaya 3/6/12 kredit (hemat/seimbang/terbaik). Tidak auto-post KBM, tidak mutasi canon. User apply nanti di Task 9.6.

---

## Sprint 8 — AI/OpenRouter & Credit-Gated Generation ✅

**Rencana:** [`docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`](docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md)  
**Verifikasi penutupan:** [`docs/45-sprint-8-verification-report.md`](docs/45-sprint-8-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 8.0 Implementation plan | ✅ | `docs/44` |
| 8.1 Data model + credit ledger | ✅ | Migration `00008` + shared types + audit enum extend |
| 8.2 Model router + OpenRouter shell | ✅ | `model-router`, `openrouter-client`, `mock-ai-provider` — disabled by default |
| 8.3 Credit debit/refund service | ✅ | `ai-credit-policy`, `credit-ledger` — internal only |
| 8.4 Prose beat generation API | ✅ | `POST /ai/generate-prose` + orchestration |
| 8.5 WritePage AI button | ✅ | `Tulis Beat dengan AI` → `POST /ai/generate-prose` (API mode only) |
| 8.6 Safety + verification | ✅ | API mock success/fail/unsafe + WritePage AI E2E success/disabled |
| 8.7 Verification report | ✅ | `docs/45` |
| 8.8 Live OpenRouter staging plan | ✅ | `docs/46` |
| 8.9 Live OpenRouter staging smoke | ✅ | `docs/47` — Task 8.9 NO-GO (no key) |
| 8.9b Live OpenRouter with local key | ✅ | `docs/47` — **GO** (`google/gemini-2.5-flash`) |

Sprint 8 MVP: **prose beat generation** verified mock + **live OpenRouter staging GO** (`docs/47`). AI **disabled by default** (`AI_GENERATION_ENABLED=false`).

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
10. `docs/35-sprint-5-verification-report.md` — status penutupan Sprint 5
11. `docs/38-sprint-6-verification-report.md` — status penutupan Sprint 6
12. `docs/40-sprint-7-verification-report.md` — status penutupan Sprint 7
13. `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md` — rencana hardening pre-AI (Task 7.8)
14. `docs/42-audit-action-enum-and-coverage-plan.md` — audit enum + coverage (Task 7.8.1)
15. `docs/43-pre-ai-hardening-verification-report.md` — penutupan hardening pre-AI (Task 7.8.6)
16. `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md` — rencana Sprint 8 AI (Task 8.0)
17. `docs/45-sprint-8-verification-report.md` — penutupan Sprint 8 AI (Task 8.7)
18. `docs/46-live-openrouter-staging-verification-plan.md` — rencana staging OpenRouter live (Task 8.8)
19. `docs/47-live-openrouter-staging-smoke-report.md` — hasil smoke staging OpenRouter (Task 8.9)
20. `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md` — rencana Sprint 9 AI (Task 9.0)
21. `docs/36-non-blocking-technical-debt-and-deferred-items.md` — debt register (Task 5.8)
22. `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md` — rencana Sprint 7
23. `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md` — rencana Sprint 6
24. `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md` — rencana Sprint 5
25. `docs/32-sprint-4-outline-planning-engine-implementation-plan.md` — rencana Sprint 4
26. `docs/30-sprint-3-story-foundation-flow-implementation-plan.md` — rencana Sprint 3
27. `docs/27-sprint-2-data-model-implementation-plan.md` — rencana Sprint 2

### Untuk AI coding agent

1. `.agents/rules/00-read-first.md`
2. `.agents/rules/01-document-navigation-map.md`
3. `.agents/rules/02-sprint-discipline.md`
4. `docs/17-roadmap-sprint-plan-mvp-to-full.md`
5. `docs/19-implementation-checklist.md`
6. `docs/22-sprint-1-verification-report.md`
7. `docs/29-sprint-2-verification-report.md`
8. `docs/31-sprint-3-verification-report.md`
9. `docs/33-sprint-4-verification-report.md`
10. `docs/35-sprint-5-verification-report.md`
11. `docs/38-sprint-6-verification-report.md`
12. `docs/40-sprint-7-verification-report.md`
13. `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md`
14. `docs/42-audit-action-enum-and-coverage-plan.md`
15. `docs/43-pre-ai-hardening-verification-report.md`
16. `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md`
17. `docs/45-sprint-8-verification-report.md`
18. `docs/46-live-openrouter-staging-verification-plan.md`
19. `docs/47-live-openrouter-staging-smoke-report.md`
20. `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`
21. `docs/36-non-blocking-technical-debt-and-deferred-items.md`
22. `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md`
23. `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md`
24. `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md`
25. `docs/30-sprint-3-story-foundation-flow-implementation-plan.md`
26. `docs/27-sprint-2-data-model-implementation-plan.md`
27. Dokumen domain sesuai task.

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