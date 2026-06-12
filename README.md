# Narraza — Unified Blueprint Pack

> **Brand:** **Narraza** — *Build long fiction without losing the plot.*  
> **Historical:** repo/monorepo masih memakai identifier `vibenovel` (nama kerja lama **VibeNovel** / **Novory**). Itu **bukan** brand product-facing.

Monorepo Narraza: dokumentasi produk + frontend Sprint 1 + backend scaffold Sprint 2 + database lokal.

Narraza adalah **AI Serial Fiction Production OS** — bukan chatbot novel biasa. Blueprint MVP dan Full Version disatukan; pemisahan delivery hanya di roadmap/sprint plan.

**Execution status (agents):** Use this README + [`docs/36`](docs/36-non-blocking-technical-debt-and-deferred-items.md) + sprint closure reports. **Do not** use [`docs/26-current-sprint-plan.md`](docs/26-current-sprint-plan.md) as the live task queue — it is a historical product roadmap. Sprint numbering map: [`docs/61`](docs/61-roadmap-and-sprint-number-reconciliation.md). Updated product roadmap: [`docs/63`](docs/63-updated-product-roadmap-after-sprint-11.md).

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
npm run smoke:web:topup      # Credit topup UI mock + optional API mode (Task 10.4)

# API smoke — Sprint 8 AI prose beat generation (Task 8.4)
npm run smoke:api:sprint8

# Full local suite — Sprint 2/5/6/7/8/9 API + Sprint 3–10 web mock (14 phases)
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
npm run smoke:web:topup      # Credit topup UI mock + optional API mode (Task 10.4)
```

Optional full browser API-mode:

```bash
npm run smoke:web:publish
npm run smoke:web:topup      # Credit topup UI mock + optional API mode (Task 10.4) -- -IncludeApiMode
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
| 7.8.4 Smoke orchestration | ✅ | `smoke:all:local` (extended Task 9.9 → 14 phases Task 10.6) |
| 7.8.6 Hardening verification report | ✅ | `docs/43` |

---

## Sprint 9 — AI Rewrite, Publish Copy & Credit UI ✅

**Rencana:** [`docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md`](docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md)  
**Verifikasi penutupan:** [`docs/49-sprint-9-verification-report.md`](docs/49-sprint-9-verification-report.md)  
**Prerequisite:** Live OpenRouter staging **GO** — [`docs/47`](docs/47-live-openrouter-staging-smoke-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 9.0 Implementation plan | ✅ | `docs/48` |
| 9.1 Cost estimation | ✅ | `model-cost-map.ts`, `estimated_cost_usd` on success |
| 9.2 Credit UI minimal | ✅ | WritePage saldo/biaya kredit, `smoke:web:credit-ui` |
| 9.3 Prose rewrite API | ✅ | `POST /ai/rewrite-prose`, `smoke:api:sprint9` |
| 9.4 WritePage rewrite UI | ✅ | `POST /ai/rewrite-prose` UI, `smoke:web:rewrite` (API-mode E2E verified 9.4b) |
| 9.5 Publish copy AI API | ✅ | `POST /ai/improve-publish-copy`, suggestion-first, `smoke:api:sprint9` |
| 9.6 PublishPage AI UI | ✅ | Perbaiki Copy dengan AI, apply via PATCH, `smoke:web:publish-ai` |
| 9.7 Safety regression | ✅ | Full API/web smoke matrix; mock modes; API-mode E2E |
| 9.8 Verification report | ✅ | `docs/49` |
| 9.9 Smoke orchestrator + optional live hook | ✅ | `smoke:all:local` extended to 14 phases (Task 10.6); `-LiveSpotCheck` in sprint9 API smoke |

## Sprint 10 — Production Readiness & Mayar Monetization (closed)

**Rencana:** [`docs/50-sprint-10-production-readiness-mayar-monetization-plan.md`](docs/50-sprint-10-production-readiness-mayar-monetization-plan.md)  
**Laporan penutupan:** [`docs/53-sprint-10-verification-report.md`](docs/53-sprint-10-verification-report.md)

| Task | Status | Deliverable |
|---|---|---|
| 10.0 Monetization plan | ✅ | `docs/50` |
| 10.1 Payment data model | ✅ | `00009` migration, shared types, seed packages |
| 10.2 Checkout shell | ✅ | Provider abstraction, Mayar client, mock provider, `GET/POST topup` |
| 10.3 Webhook + grant | ✅ | `POST /api/payments/mayar/webhook`, idempotent grant, mock `payment.received` |
| 10.3b Router compatibility audit | ✅ | Siklusio webhook audit + multi-app routing gate (`app`/`flow`); no Mayar dashboard change |
| 10.3c Siklusio forwarder | ✅ | Option B router in Siklusio repo; `MAYAR_MULTI_APP_ROUTER_ENABLED` default off |
| 10.3d Dual-app local smoke | ✅ | Siklusio → VibeNovel grant once + duplicate idempotent (`npm run smoke:api:sprint10:dual-app`) |
| 10.4 Credit topup UI | ✅ | `/credits/topup`, checkout redirect, mock return pending, `smoke:web:topup` |
| 10.5 Mayar sandbox live smoke | ✅ **PARTIAL GO** | [`docs/51`](docs/51-mayar-sandbox-live-smoke-report.md), parser hardening, `smoke:api:sprint10:mayar-live` |
| 10.6 Ops + safety regression | ✅ | [`docs/52`](docs/52-sprint-10-payment-ops-and-safety-regression.md), runbook, `smoke:all:local` 14 phases |
| 10.7 Verification report | ✅ | [`docs/53`](docs/53-sprint-10-verification-report.md) |
| 10.8 Mayar staging live execution | ✅ **BLOCKED** | [`docs/54`](docs/54-mayar-staging-live-execution-report.md) — no `MAYAR_API_KEY`; live invoice/webhook **NOT RUN** |
| 10.9 Duitku provider spike | ✅ | [`docs/55`](docs/55-duitku-provider-spike-and-migration-feasibility.md) — POP recommended; Mayar retained |
| 10.10 Duitku POP adapter shell | ✅ | [`docs/56`](docs/56-duitku-pop-provider-adapter-shell.md), `duitku-pop-client.ts`, `smoke:api:sprint10:duitku` |
| 10.11 Duitku checkout integration | ✅ | [`docs/57`](docs/57-duitku-checkout-integration-report.md) — checkout E2E verified |
| 10.12 Duitku callback + grant | ✅ | [`docs/58`](docs/58-duitku-callback-idempotent-grant-report.md) — `POST /api/payments/duitku/callback`, fixture smoke PASS |
| 10.13 Duitku sandbox live smoke (local) | ✅ **BLOCKED** | [`docs/59`](docs/59-duitku-sandbox-live-smoke-report.md) — local preflight; fixture regression PASS |
| 10.13b Duitku Mode B AWS live sandbox | ✅ **GO** | [`docs/70`](docs/70-duitku-mode-b-live-sandbox-callback-report.md) — LiveCreate + callback grant PASS; BCA VA verified in 10.13c |
| 10.13c Duitku real callback signature debug | ✅ **GO** | [`docs/71`](docs/71-duitku-real-callback-signature-debug-report.md) — HMAC-SHA256 root cause; BCA VA real callback + grant |
| 10.14 Payment provider decision report | ✅ **GO** | [`docs/72`](docs/72-payment-provider-decision-report.md) — **Duitku POP BCA VA-first** for MVP; Mayar backlog |
| 10.15 Duitku production payment enable plan | ✅ **GO** | [`docs/73`](docs/73-duitku-production-payment-enable-plan.md) — gated plan only; production **NOT ENABLED** |
| 10.16 Atomic grant DB RPC | ✅ **GO** | [`docs/74`](docs/74-atomic-grant-db-rpc-report.md) — `grant_paid_credit_topup_atomic` migration `00010` |
| 10.17 Apply migration 00010 hosted staging | ✅ **GO** | [`docs/75`](docs/75-apply-migration-00010-hosted-staging-report.md) — `jdxyhrnibmmwlbtbokqo` RPC verified |
| 10.18 Redeploy staging API + RPC grant E2E | ✅ **GO** | [`docs/76`](docs/76-redeploy-staging-api-rpc-grant-integration-report.md) — AWS API redeploy; fixture callback RPC path PASS |
| 10.19 Production preflight + migration 00010 gate | ⛔ **BLOCKED** | [`docs/77`](docs/77-production-payment-preflight-migration-approval-gate.md) — preflight done; prod target not identified; migration **not applied** |
| 10.20 Production environment foundation plan | ✅ **GO** | [`docs/78`](docs/78-production-environment-foundation-plan.md) — topology, Supabase/DNS checklists, env matrix; **no prod deploy** |
| 10.21 Production Supabase baseline setup | ✅ **GO** | [`docs/79`](docs/79-production-supabase-baseline-setup-report.md) — prod `qjmb…njct`; migrations `00001`–`00009` applied; `00010` excluded |
| 10.22 Production API/web/DNS Mode A plan + preflight | ✅ **GO** | [`docs/80`](docs/80-production-api-web-dns-mode-a-preflight-report.md) — plan + preflight; **no prod deploy** |
| 10.23 Production API/web Mode A deploy | ✅ **GO** | [`docs/81`](docs/81-production-api-web-mode-a-deploy-report.md) — superseded by 10.23b/10.23c |
| 10.23a Production infra unblock (homepage/app/API split) | ✅ **GO** | [`docs/82`](docs/82-production-infra-unblock-report.md) — domain model; completed 10.23b/10.23c |
| 10.23b Production EC2/API Mode A deploy | ✅ **GO** | [`docs/83`](docs/83-production-ec2-api-mode-a-deploy-report.md) — `https://api.narraza.web.id` Mode A live |
| 10.23c Production app custom domain verify | ✅ **GO** | [`docs/84`](docs/84-production-app-custom-domain-verify-report.md) — `https://app.narraza.web.id` live; Mode A path closed |
| 10.24 Production homepage on narraza.web.id | ✅ **GO** | [`docs/85`](docs/85-production-homepage-placeholder-report.md) — `https://narraza.web.id` static landing live |
| 10.25 Private beta launch readiness audit | ✅ **GO** | [`docs/86`](docs/86-private-beta-launch-readiness-audit.md) — payment-off beta path; `/login` added |
| 10.26 Real private-beta story flow | ✅ **GO** | [`docs/87`](docs/87-real-private-beta-story-flow-report.md) — founder verified create/intake persist |
| 10.26b Founder story smoke | ✅ **GO** | [`docs/88`](docs/88-founder-private-beta-story-smoke-report.md) — founder verified full flow incl. Keluar |
| 10.27 Full repo audit vs sprint plan | ✅ **GO** | [`docs/89`](docs/89-full-repo-audit-vs-sprint-plan.md) — audit-only; no code/deploy changes |
| 10.28 AI founder test mode | ✅ **GO** | [`docs/90`](docs/90-ai-founder-test-mode-report.md) — production AI ON (founder test); payment OFF |
| 10.29 Founder browser E2E | ✅ **GO** | [`docs/91-founder-browser-e2e`](docs/91-founder-browser-e2e-story-workflow-report.md) — Write Room AI from UI; prose persists; credit UI in assistant panel |
| 10.29 Remove misleading mock flow | ✅ **GO** | [`docs/91-mock-flow`](docs/91-remove-misleading-mock-flow-report.md) — production authed flow no longer falls back to Sprint 1 mock; honest locked states |
| 10.30a Remove initial mock hook states + CreditIndicator + routing | ✅ **GO** | [`docs/93`](docs/93-remove-initial-mock-hook-states-credit-route-report.md) — Phase 0 audit fix; real credits wired; CTA routes aligned |
| 10.31a Real Intake Assistant and Concept Generator Pipeline | ✅ **GO** | [`docs/94`](docs/94-real-intake-assistant-concept-generator-report.md) — OpenRouter intake & concept generator; credit balance debited; 7 signals tracked |
| 10.31a-hotfix Fix Failed to Create Generation Attempt in Intake Assistant | ✅ **GO** | [`docs/95`](docs/95-hotfix-generation-attempt-intake-assistant.md) — Fixed foreign key constraint failure by allowing chapter_outline_id to be nullable |


## Sprint 11 — staging readiness (COMPLETE)

| Task | Status | Deliverable |
|---|---|---|
| 11.0 Staging deploy + public callback plan | ✅ | [`docs/60`](docs/60-sprint-11-staging-deploy-and-public-callback-plan.md) — architecture, env checklist, deploy/smoke/rollback plan |
| 11.0b Roadmap & sprint reconciliation | ✅ | [`docs/61`](docs/61-roadmap-and-sprint-number-reconciliation.md) — old `docs/26` vs actual sprint map |
| 11.1 Execute staging deploy Mode A | ✅ **GO** | [`docs/62`](docs/62-staging-deploy-mode-a-report.md) — API `vibenovel-api-staging`, Pages `vibenovel-web-staging` |
| 11.1c Updated product roadmap | ✅ | [`docs/63`](docs/63-updated-product-roadmap-after-sprint-11.md) — vision + actual state + execution phases after Sprint 11 |
| 11.2 Hosted Supabase + portable smoke harness | ✅ **GO** | [`docs/64`](docs/64-staging-smoke-harness-and-supabase-report.md) — `smoke:staging` |
| 11.3 AWS staging readiness + EC2 plan | ✅ **Closed** | [`docs/65`](docs/65-aws-staging-readiness-and-ec2-plan.md) — separate EC2 from Hermes; Docker+Caddy recommended |
| 11.4 AWS API adapter + Docker prep | ✅ **GO** | [`docs/66`](docs/66-aws-api-staging-adapter-and-docker-prep-report.md) — Node server + Dockerfile + compose; CF Worker intact |
| 11.2b Hosted Supabase operator gate | ✅ **GO FULL** | Hosted Supabase `jdxyhrnibmmwlbtbokqo`; `smoke:staging -IncludeApiMode` PASS |
| 11.5 AWS EC2 provision + deploy API staging | ✅ **GO** | [`docs/68`](docs/68-aws-ec2-api-staging-deploy-report.md) — EC2 `13.212.245.32` Docker API live |
| 11.6 AWS HTTPS domain + web-to-AWS API | ✅ **COMPLETE / GO FULL** | [`docs/69`](docs/69-aws-https-domain-and-web-to-aws-api-report.md) — `api-staging.narraza.web.id` |

**Staging URLs (current — post 11.6):**

| Surface | URL |
|---|---|
| **API (primary)** | `https://api-staging.narraza.web.id` |
| **Web** | `https://vibenovel-web-staging.pages.dev` (→ AWS API) |
| **API fallback** | `https://vibenovel-api-staging.moxsenna.workers.dev` |

**Domain note:** Staging API `api-staging.narraza.web.id` + web `vibenovel-web-staging.pages.dev`. **Production launch (10.23a):** homepage `narraza.web.id`, app `app.narraza.web.id`, API `api.narraza.web.id`. **`narraza.id`** reserved for future migration.

**Production (Mode A — live):**

| Surface | URL | Status |
|---|---|---|
| **App** | `https://app.narraza.web.id` | **GO** ([`docs/84`](docs/84-production-app-custom-domain-verify-report.md)) |
| **API** | `https://api.narraza.web.id` | **GO** ([`docs/83`](docs/83-production-ec2-api-mode-a-deploy-report.md)) |
| **Homepage** | `https://narraza.web.id` | **GO** — [`docs/85`](docs/85-production-homepage-placeholder-report.md) |

**Private beta:** Story onboarding **GO** ([`docs/87`](docs/87-real-private-beta-story-flow-report.md), [`docs/88`](docs/88-founder-private-beta-story-smoke-report.md)). **AI founder test GO** ([`docs/90`](docs/90-ai-founder-test-mode-report.md), [`docs/91`](docs/91-founder-browser-e2e-story-workflow-report.md)) — API + Write Room UI prose generation verified on production app; founder credits via assistant panel; shell header credit still mock — payment off ([`docs/86`](docs/86-private-beta-launch-readiness-audit.md)).

Payment ([`docs/73`](docs/73-duitku-production-payment-enable-plan.md) §7) remains **blocked**.

**Sprint 12 — Production Story-Flow Stabilization ✅ CLOSED** ([`docs/96`](docs/96-sprint-12-stabilization-report.md)): auth/session prod alignment verified live (login → `/api/me` 200); mock boundary locked for prod builds (`env.ts` PROD guard); ESLint + CI gate (lint + e2e regression, CI back to green); full pipeline `intake → 3 AI concepts → foundation lock → outline lock → write room → accept AI prose` verified **end-to-end in production**. Two P0 prod bugs found & hotfixed live: **concept-gen 500** (800-token cap truncated the 3-concept JSON) and **foundation readiness/lock inconsistency** (`secret_guard` penalised accepted proposals). **Deferred to Sprint 13:** real foundation/outline generators (still deterministic stub), mobile write-room visual check, AI per-user cost cap.

**Node API local:** `npm run dev:api:node` · **Docker:** `docker compose -f docker-compose.staging.yml up --build`

**Payment provider decision (10.14):** **Duitku POP, BCA VA-first** for MVP. Mayar secondary/backlog. See [`docs/72`](docs/72-payment-provider-decision-report.md).

**Production payment plan (10.15):** Gated enable sequence — [`docs/73`](docs/73-duitku-production-payment-enable-plan.md). **Atomic grant RPC (10.16):** [`docs/74`](docs/74-atomic-grant-db-rpc-report.md). **Do not enable** without founder Go.

**Production payment:** **NOT PRODUCTION READY** — production migration `00010` **BLOCKED** ([`docs/77`](docs/77-production-payment-preflight-migration-approval-gate.md): no prod Supabase linked, no approval). Staging RPC E2E verified ([`docs/76`](docs/76-redeploy-staging-api-rpc-grant-integration-report.md)). Staging Mode A safe.

**Ops runbook (10.6):** Local safe mode (`PAYMENT_PROVIDER_MOCK=true`), sandbox live procedure, rollback, paid-but-no-credit SQL checklist. `smoke:all:local` now includes Sprint 10 web topup mock (phase 14). Dual-app + live Mayar remain separate commands.

**Sprint 10 webhook (10.3–10.3d):** Mayar dashboard tetap Siklusio. Dengan router enabled, Siklusio forwards `app=vibenovel` + `flow=credit_topup` ke VibeNovel `POST /api/payments/mayar/webhook`. VibeNovel grant idempotent via `payload_hash` / order match. Rollback: `MAYAR_MULTI_APP_ROUTER_ENABLED=false`.

**Credit topup UI (Task 10.4):** Halaman `/credits/topup` menampilkan paket kredit (Starter/Creator/Pro/Studio), saldo saat ini, dan tombol **Beli Paket** → redirect ke `paymentUrl` Mayar atau mock return (`/credits/topup/mock-return`). Kredit **hanya** masuk via webhook server — UI tidak grant, tidak memalsukan status paid. Topup default **nonaktif** (`CREDIT_TOPUP_ENABLED=false`). Mock mode (`VITE_USE_MOCKS=true`) menampilkan penjelasan saja; checkout dinonaktifkan. Production prerequisite: replay dual-app smoke di staging Siklusio + VibeNovel sebelum `MAYAR_MULTI_APP_ROUTER_ENABLED=true`.

Sprint 9 MVP: **prose rewrite**, **publish copy AI** (suggestion-first), **credit UI** — verified mock + API-mode E2E. AI **disabled by default** (`AI_GENERATION_ENABLED=false`). Live rewrite/publish copy not run (non-blocking).

**Rewrite UI (Task 9.4):** Tersedia di mode API pada WritePage — mode perbaikan (emosi/pacing/dialog/panjang/custom), biaya rewrite 3/6/12 kredit (hemat/seimbang/terbaik), hasil disimpan sebagai versi prose baru. Mock/fallback tidak memalsukan rewrite. Top up belum tersedia.

**Publish copy AI (Task 9.5):** `POST /ai/improve-publish-copy` mengembalikan saran teaser/caption/reader question/sinopsis singkat/next chapter teaser — **tidak** auto-patch paket publish. Biaya 3/6/12 kredit (hemat/seimbang/terbaik). Tidak auto-post KBM, tidak mutasi canon.

**Publish copy UI (Task 9.6):** PublishPage panel **Perbaiki Copy dengan AI** — suggestion-first; user **Terapkan** via PATCH publish fields yang sudah ada. Mock/fallback tidak memalsukan saran AI.

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
4. `docs/63-updated-product-roadmap-after-sprint-11.md` — updated product + execution roadmap (after Sprint 11)
5. `docs/17-roadmap-sprint-plan-mvp-to-full.md` — historical MVP outline
6. `docs/21-stitch-frontend-parity-plan.md`
7. `docs/22-sprint-1-verification-report.md` — status penutupan Sprint 1
8. `docs/29-sprint-2-verification-report.md` — status penutupan Sprint 2
9. `docs/31-sprint-3-verification-report.md` — status penutupan Sprint 3
10. `docs/33-sprint-4-verification-report.md` — status penutupan Sprint 4
11. `docs/35-sprint-5-verification-report.md` — status penutupan Sprint 5
12. `docs/38-sprint-6-verification-report.md` — status penutupan Sprint 6
13. `docs/40-sprint-7-verification-report.md` — status penutupan Sprint 7
14. `docs/41-pre-ai-hardening-audit-transactions-ci-plan.md` — rencana hardening pre-AI (Task 7.8)
15. `docs/42-audit-action-enum-and-coverage-plan.md` — audit enum + coverage (Task 7.8.1)
16. `docs/43-pre-ai-hardening-verification-report.md` — penutupan hardening pre-AI (Task 7.8.6)
17. `docs/44-sprint-8-ai-openrouter-credit-generation-implementation-plan.md` — rencana Sprint 8 AI (Task 8.0)
18. `docs/45-sprint-8-verification-report.md` — penutupan Sprint 8 AI (Task 8.7)
19. `docs/46-live-openrouter-staging-verification-plan.md` — rencana staging OpenRouter live (Task 8.8)
20. `docs/47-live-openrouter-staging-smoke-report.md` — hasil smoke staging OpenRouter (Task 8.9)
21. `docs/48-sprint-9-ai-rewrite-publish-credit-ui-implementation-plan.md` — rencana Sprint 9 AI (Task 9.0)
22. `docs/49-sprint-9-verification-report.md` — penutupan Sprint 9 AI (Task 9.8)
23. `docs/36-non-blocking-technical-debt-and-deferred-items.md` — debt register (Task 5.8)
24. `docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md` — rencana Sprint 7
25. `docs/37-sprint-6-chapter-summary-delta-canon-proposal-implementation-plan.md` — rencana Sprint 6
26. `docs/34-sprint-5-safe-write-room-context-packet-implementation-plan.md` — rencana Sprint 5
27. `docs/32-sprint-4-outline-planning-engine-implementation-plan.md` — rencana Sprint 4
28. `docs/30-sprint-3-story-foundation-flow-implementation-plan.md` — rencana Sprint 3
29. `docs/27-sprint-2-data-model-implementation-plan.md` — rencana Sprint 2

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