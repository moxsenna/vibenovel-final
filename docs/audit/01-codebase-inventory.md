# 01 - Codebase Inventory

Semua path relatif ke root `D:\Coding\vibenovel-unified-blueprint`.

## Struktur folder top-level

| Path | Isi | Catatan audit |
|---|---|---|
| `apps/web` | Vite React app | Produk utama user-facing. |
| `apps/api` | Hono API / Cloudflare Worker / Node adapter | Backend fungsional, bukan placeholder. |
| `apps/homepage` | Static homepage | Dipakai untuk surface marketing/landing. |
| `packages/shared` | Shared TypeScript types, enums, API contracts | Domain model paling lengkap. |
| `packages/core` | `README.md` placeholder | Belum package aktif; engine saat ini ada di `apps/api/src/services`. |
| `supabase` | migrations, seed, config | 10 migration utama plus seed. |
| `scripts` | smoke, deploy, operator scripts | Banyak alur staging/production dan local smoke. |
| `docs` | blueprint, plan, verification reports, production reports | Banyak source of truth; perlu disiplin dokumen. |
| `.agents/rules` | agent rules | Aturan canon, context packet, sprint discipline, UI, testing. |
| `stitch-reference` | referensi UI | Source visual untuk Sprint 1. |
| `test-results` | output Playwright | Artifact. |
| `node_modules` | dependencies installed | Sudah terpasang di workspace. |
| `.env.production`, `.env.staging`, `apps/api/.dev.vars`, `apps/web/.env.local` | env lokal/operator, gitignored | Nilai secret tidak dibaca/dicatat di audit. |

## Workspace/package map

Root `package.json` memakai workspaces `apps/*` dan `packages/*`.

| Package | Path | Status | Evidence |
|---|---|---|---|
| `@vibenovel/web` | `apps/web/package.json` | Aktif | Scripts `dev`, `build`, `typecheck`, `e2e`. |
| `@vibenovel/api` | `apps/api/package.json` | Aktif | Hono, Supabase, Wrangler, Node adapter. |
| `@vibenovel/shared` | `packages/shared/package.json` | Aktif | `build`, `typecheck`. |
| `packages/core` | `packages/core/README.md` | Placeholder | Tidak ada `package.json`; tidak ikut build. |
| `apps/homepage` | `apps/homepage` | Static app | Tidak tampak sebagai workspace package terpisah. |

## Web route map

Evidence: `apps/web/src/routes/index.tsx`.

| Route | Page | Purpose |
|---|---|---|
| `/` | `LandingPage` | Public landing. |
| `/login` | `LoginPage` | Auth entry. |
| `/start` | `StartProjectPage` | Pilih entry path proyek. |
| `/dashboard` | `DashboardPage` | Dashboard penulis. |
| `/projects/:id/intake` | `IntakePage` | Story intake chat. |
| `/projects/:id/concepts` | `ConceptsPage` | 3 konsep cerita. |
| `/projects/:id/foundation` | `FoundationPage` | Fondasi, readiness, lock. |
| `/projects/:id/outline` | `OutlinePage` | Outline 10 bab dan reveal/loop display. |
| `/projects/:id/write` | `WritePage` | Ruang Tulis desktop/mobile. |
| `/projects/:id/summary` | `SummaryPage` | Ringkasan/delta/canon proposal review. |
| `/projects/:id/publish` | `PublishPage` | Publish package KBM. |
| `/settings` | `SettingsPage` | Credit, usage, quality mode. |
| `/credits/topup` | `CreditTopupPage` | Credit topup UI. |
| `/credits/topup/mock-return`, `/credits/topup/return` | `CreditTopupReturnPage` | Return page payment. |

Guard: `apps/web/src/components/layout/AppShell.tsx` redirects signed-out API-mode users to `/login`.

## API route/module map

Evidence: `apps/api/src/routes/index.ts`.

| Area | Files |
|---|---|
| Health/auth/profile | `routes/health.ts`, `routes/me.ts`, `middleware/auth.ts` |
| Projects/settings | `routes/projects.ts`, `routes/project-settings.ts`, `services/project*.ts` |
| Foundation/canon | `routes/foundation.ts`, `routes/characters.ts`, `routes/facts.ts`, `routes/speech-rules.ts`, `routes/ai-proposals.ts` |
| Intake/concepts | `routes/intake.ts`, `routes/concepts.ts`, `services/intake.ts`, `services/concept.ts` |
| Outline/planning | `routes/outline.ts`, `services/outline*.ts`, `services/chapter-outline.ts` |
| Write room | `routes/write.ts`, `routes/ai.ts`, `services/write-session.ts`, `chapter-beat.ts`, `prose-*.ts`, `context-packet-*` |
| Summary/delta | `routes/summary.ts`, `services/chapter-summary*.ts`, `chapter-delta*.ts`, `summary-*` |
| Publish | `routes/publish.ts`, `services/publish-*` |
| Credit/payment | `routes/credits.ts`, `routes/payment-webhooks.ts`, `services/credit-*`, `duitku-*`, `mayar-*`, `payment-*` |
| Cross-cutting | `services/audit.ts`, `transaction.ts`, `model-router.ts`, `openrouter-client.ts`, `ai-credit-policy.ts`, `model-cost-map.ts` |

## Docs map

| Doc | Role saat ini |
|---|---|
| `README.md` | Execution status utama. |
| `docs/63-updated-product-roadmap-after-sprint-11.md` | Roadmap aktif pasca Sprint 11. |
| `docs/61-roadmap-and-sprint-number-reconciliation.md` | Peta old roadmap vs actual implementation. |
| `docs/36-non-blocking-technical-debt-and-deferred-items.md` | Debt/deferred register. |
| `docs/26-current-sprint-plan.md` | Historis, bukan task queue. |
| `docs/92-structural-repo-audit-mock-real-boundary.md` | Audit mock-vs-real sebelumnya. |
| `docs/93`, `docs/94`, `docs/95` | Laporan fix/hotfix terbaru untuk mock boundary dan real intake/concept pipeline. |

## Config/env map

| File | Catatan |
|---|---|
| `apps/web/.env.example` | `VITE_USE_MOCKS=true` default dev; API mode perlu `false`. |
| `apps/api/.dev.vars.example` | Supabase service role, AI, payment vars sebagai placeholder. |
| `.env.production.example` | Production template: payment off, AI off by default unless operator enables. |
| `.env.staging.example` | Staging Mode A safe defaults. |
| `apps/api/wrangler.toml` | Staging vars default: `CREDIT_TOPUP_ENABLED=false`, `PAYMENT_PROVIDER_MOCK=true`, `AI_GENERATION_ENABLED=false`, `AI_PROVIDER_MOCK=true`. |
| `.gitignore` | Mengabaikan `.env.*`, `.env.staging`, `**/.dev.vars`, `*.local`. |

## Placeholder/mock map

| Item | Status |
|---|---|
| `apps/web/src/mocks/*` | Mock Sprint 1 tetap ada dan dipakai ketika `shouldUseMocks()` true. |
| `DEMO_PROJECT_ID` | Ada di `apps/web/src/mocks/projects.ts`; seharusnya hanya demo/mock. |
| `apps/api/src/services/mock-ai-provider.ts` | Mock provider server untuk smoke/local. |
| `apps/api/src/services/mock-payment-provider.ts` | Mock payment provider untuk local safe mode. |
| `packages/core/README.md` | Placeholder terdokumentasi; bukan package aktif. |
| `apps/web/src/pages/PlaceholderPage.tsx` | Ada, tetapi tidak dipasang di route map aktual. |

## Maintainability risks

- Engine domain tersebar di `apps/api/src/services`, sementara `packages/core` hanya placeholder. Ini perlu keputusan arsitektur: pindahkan core logic atau dokumentasikan bahwa API services adalah engine.
- Banyak docs historis; agent baru bisa salah membaca `docs/26` sebagai task queue.
- Banyak operator/deploy artifacts lokal; pastikan hanya file yang disengaja masuk git.
