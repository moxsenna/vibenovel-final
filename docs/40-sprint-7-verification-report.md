# 40 — Sprint 7 Verification Report

**Sprint:** Sprint 7 — Publish Package / KBM Export Flow  
**Status:** Closed (verified)  
**Date:** 8 Juni 2026  
**Repo:** `vibenovel-unified-blueprint`  
**Prerequisite:** [`docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md`](39-sprint-7-publish-package-kbm-export-implementation-plan.md)

Dokumen ini adalah laporan penutupan resmi Sprint 7. Dibaca oleh developer manusia dan AI agent sebelum memulai hardening pre-AI atau Sprint 8.

**Work logs:** `.agent-logs/sprint-7/task-7.0` … `task-7.6`

---

## 1. Sprint 7 Summary

### Tujuan Sprint 7

Mengubah **halaman Paket Publish** (`/projects/:id/publish`) dari mock Sprint 1 menjadi **workflow persistence nyata** yang menghasilkan aset copy-ready untuk platform serial mobile (KBM-oriented) — tanpa auto-post, tanpa OpenRouter, tanpa mutasi canon:

```txt
approved chapter_summary + summarized chapter (Sprint 6)
  → Generate publish package (stub publish_stub_v1)
  → User edit copy-ready fields + checklist
  → User copy manual via browser clipboard
  → Optional mark-exported (local marker only — bukan platform publish)
```

### Status akhir

| Aspek | Status |
|---|---|
| Migration `00006` + shared Sprint 7 types | **Selesai (Task 7.1)** |
| Publish package generation API | **Selesai (Task 7.2)** |
| Field update / checklist / mark-exported API | **Selesai (Task 7.3)** |
| PublishPage web integration | **Selesai (Task 7.4)** |
| Safety & E2E regression tests | **Selesai (Task 7.5)** |
| Sprint 7 verification report | **Selesai (Task 7.6)** |
| KBM auto-post / platform OAuth | **Tidak ada (by design)** |
| OpenRouter / AI generation production | **Tidak ada (by design)** |
| Remote deploy / remote migration push | **Tidak dilakukan** |

### Fitur yang selesai

- Tabel baru: `publish_packages` + enum `publish_package_status`
- Shared types: `PublishPackage`, checklist ids, generator version, safety flags
- Deterministic stub generator dari approved summary + prose excerpt + safe next-chapter slice (`publish_stub_v1`)
- API: list, by-chapter, detail, generate, PATCH fields, PATCH checklist, POST mark-exported
- Web: `PublishPage` + `usePublishData` + `services/publish.ts` + `publish-mappers.ts` + workflow components
- Mock fallback `VITE_USE_MOCKS=true` tetap parity `mockPublishPackage`
- Safety smoke: API 50/50 + Sprint 5/6 regression + publish E2E mock + API-mode 11/11
- Sprint 2 regression smoke tetap PASS (`npm run smoke:api` 17/17)

### Fitur yang masih deferred

- KBM auto-post / platform login / OAuth platform
- OpenRouter / model routing / AI generation production
- Credit deduction / ledger (Sprint 8)
- Publish analytics / A/B caption testing
- UI regenerate publish package (`regenerate=true` API ada; UI belum)
- Chapter picker multi-bab (default Bab 1 only)
- Export audit log table / `audit_action` extension
- Clipboard content assertion in E2E (button presence only)
- API-mode web E2E di GitHub Actions CI
- `smoke:all:local` belum include `sprint7-smoke-api` / `sprint7-smoke-web`
- Remote Cloudflare deploy / remote Supabase migration push
- Full LLM viral caption optimizer

---

## 2. Architecture Added

### Migration `00006` (Task 7.1)

- File: `supabase/migrations/00006_sprint7_publish_package.sql`
- 1 tabel + 1 enum PostgreSQL (`publish_package_status`)
- RLS owner-only via `is_project_owner(project_id)`
- No triggers writing to `facts` / `characters` / `open_loops` / `reveals` / `chapter_summaries`

### Shared Sprint 7 types (Task 7.1)

- `packages/shared/src/enums.ts` — `PUBLISH_PACKAGE_STATUSES`, `PUBLISH_CHECKLIST_ITEM_IDS`, `PUBLISH_PACKAGE_GENERATOR_VERSIONS`
- `packages/shared/src/domain.ts` — `PublishPackage`, `PublishChecklistItem`, `PublishPackageMetadata`, snapshot helper types

### Publish package generation API (Task 7.2)

| Layer | Files |
|---|---|
| Generator | `apps/api/src/services/publish-package-generator.ts` |
| Snapshot | `apps/api/src/services/publish-snapshot.ts` |
| Service | `apps/api/src/services/publish-package.ts` |
| Safety | `apps/api/src/services/publish-safety.ts` |
| Routes | `apps/api/src/routes/publish.ts` |

### Field update / checklist / export API (Task 7.3)

| Layer | Files |
|---|---|
| Update | `apps/api/src/services/publish-package-update.ts` |
| Routes | `apps/api/src/routes/publish.ts` (PATCH fields, PATCH checklist, POST mark-exported) |

### PublishPage web integration (Task 7.4)

| Layer | Files |
|---|---|
| Page | `apps/web/src/pages/PublishPage.tsx` |
| Hook | `apps/web/src/hooks/usePublishData.ts` |
| Service | `apps/web/src/services/publish.ts` |
| Mapper | `apps/web/src/lib/publish-mappers.ts` |
| Components | `PublishWorkflowActions`, `PublishEditableField`, `PublishChecklistPanel`, `PublishIntegrationNotice` |

### Sprint 7 safety / E2E tests (Task 7.5)

- `scripts/sprint7-smoke-api.ps1` — 50 steps
- `scripts/sprint7-smoke-web.ps1` + `apps/web/e2e/sprint7-publish-flow.spec.ts`
- `npm run smoke:api:sprint7`, `npm run smoke:web:publish`

---

## 3. Database Verification

### Migration `00006`

| Check | Status |
|---|---|
| `supabase db reset` applies 00001–00006 | **PASS** (8 Juni 2026, Task 7.1) |
| No schema change in Tasks 7.2–7.6 | **Confirmed** — not re-run in 7.6 |
| Seed applies without publish package rows | **Confirmed** — comment in `seed.sql` |
| RLS owner-only on `publish_packages` | **Confirmed** |

### Tabel baru

| Table | Purpose |
|---|---|
| `publish_packages` | KBM-oriented export artifact per bab; copy-ready fields; checklist JSON; versioning (`package_version`, `is_current`) |

### Enum

- `publish_package_status`: `draft`, `ready`, `exported`, `superseded`

### No Sprint 7 seed publish package

Demo seed (`seed.sql`) tidak memasukkan `publish_packages` — package hanya via API generate setelah summary `approved` + chapter `summarized`.

### Publish package bukan canon

- Tabel terpisah dari `facts`, `characters`, `relationship_speech_rules`, `open_loops`, `reveals`
- Tidak ada trigger atau FK yang menulis ke canon tables
- Smoke confirms no mutation on generate / mark-exported

---

## 4. API Endpoint Map

Semua endpoint Sprint 7 memerlukan **Bearer JWT**. Ownership via `getOwnedProjectRow` + row `project_id` match — cross-user → **404**.

### Publish package read / generate

| Endpoint | Purpose | Tested | Limitation |
|---|---|---|---|
| `GET /api/projects/:id/publish` | List current packages (`is_current=true` default) | **PASS** | Filter `chapterOutlineId` / `status` optional |
| `POST /api/projects/:id/publish/generate` | Stub generate setelah summary approved + summarized | **PASS** | Gate 409 pre-approve; `regenerate=true` optional |
| `GET /api/projects/:id/publish/:packageId` | Detail package | **PASS** | No prose/packet_json in response |
| `GET /api/projects/:id/publish/by-chapter/:chapterOutlineId` | Current package or null | **PASS** | Used by PublishPage load |

### Update / export

| Endpoint | Purpose | Tested | Limitation |
|---|---|---|---|
| `PATCH .../publish/:packageId/fields` | Edit copy-ready text fields + tags + genre | **PASS** | Rejects leak markers + overclaim; 409 if `exported` |
| `PATCH .../publish/:packageId/checklist` | Update exactly 5 checklist items | **PASS** | Rejects unknown/duplicate ids |
| `POST .../publish/:packageId/mark-exported` | Local manual-copy marker (`kbm_manual_copy`) | **PASS** | Idempotent; warns `checklist_incomplete`; no external call |

---

## 5. Web Integration Status

| Area | Status |
|---|---|
| **PublishPage** | Sprint 1 layout preserved; API workflow actions + editable fields added |
| **usePublishData** | `mock` / `api` / `api-fallback`; project resolve via `resolveProjectIdForRoute` |
| **services/publish.ts** | All Sprint 7 endpoints via `apiRequest` + Bearer token |
| **publish-mappers.ts** | API → UI field map + `safeText` leak guard |
| **PublishWorkflowActions** | Buat Paket Publish / Tandai Sudah Disalin ke KBM CTAs |
| **PublishEditableField** | Per-field Simpan when editable |
| **PublishChecklistPanel** | Interactive toggle when not exported |
| **PublishIntegrationNotice** | Thin wrapper over `IntegrationNotice` |
| **VITE_USE_MOCKS=true** | Full `mockPublishPackage` (unchanged Sprint 1 path) |
| **API error / no login** | Mock fallback + notice; UI tidak blank |
| **Generate package** | POST generate when summary approved + no current package |
| **Edit fields** | PATCH fields (teaser, caption, tags, dll.) |
| **Checklist update** | PATCH checklist on toggle |
| **Mark exported** | POST mark-exported; copy: manual marker only |
| **Exported readonly** | Client lock + API 409 `exported_package_locked` |
| **Copy buttons** | `CopyButton` → browser clipboard; no backend call for copy |
| **DOM leak guard** | Playwright regex: no planningTruth/packet_json/prose_text/delta_json/provider/model/token |

---

## 6. Publish Boundary Confirmed

| Rule | Status |
|---|---|
| Publish package bukan canon | **Confirmed** — separate table; no canon triggers |
| Publish generation tidak mutate facts | **Confirmed** — smoke baseline unchanged |
| Publish generation tidak mutate characters | **Confirmed** |
| Publish generation tidak mutate speech rules | **Confirmed** |
| Publish generation tidak mutate open loops / reveals | **Confirmed** |
| Publish generation tidak mutate summaries / proposals | **Confirmed** — summary count unchanged post-approve |
| Publish generation tidak membuat ai_proposals | **Confirmed** — proposal count unchanged |
| mark-exported hanya manual-copy marker | **Confirmed** — `exportTarget=kbm_manual_copy`; metadata only |
| Tidak ada auto-post KBM | **Confirmed** — no autopost route in `publish.ts`; static smoke check |
| No external network call | **Confirmed** — mark-exported local API only |
| No OpenRouter / AI generation | **Confirmed** — `publish_stub_v1` deterministic only |
| No credit deduction | **Confirmed** — no ledger touch |

---

## 7. Safety / Leak Guard Confirmed

| Guard | Status |
|---|---|
| No `planningTruth` / `planning_truth` in API response | **Confirmed** — regex smoke 50/50 |
| No `packet_json` / `packetJson` in API response | **Confirmed** |
| No `prose_text` / `proseText` in API response | **Confirmed** |
| No `delta_json` in API response | **Confirmed** |
| No raw proposal payload in publish response | **Confirmed** |
| No leak markers in DOM | **Confirmed** — mock + API-mode Playwright |
| `nextChapterTeaser` uses safe next-chapter hook only | **Confirmed** — no full ch2 summary leak |
| Overclaim copy rejected (`dijamin viral`, `pasti viral`, `dijamin unlock`, `pasti banyak pembaca`) | **Confirmed** — API 400 + UI message mapping |
| PublishPage copy avoids auto-post / guaranteed unlock claims | **Confirmed** — E2E forbidden patterns + manual-copy messaging |

---

## 8. Smoke Test Checklist

### Build & typecheck (8 Juni 2026, Task 7.5–7.6)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build:shared` | **PASS** |
| `npm run build:web` | **PASS** |
| `npm run build:api` | **PASS** |
| `supabase db reset` | **PASS** (Task 7.1); not re-run in 7.6 — no migration change |
| `npm run smoke:api` | **PASS** — 17/17 (Sprint 2 regression) |
| `npm run smoke:api:sprint5` | **PASS** — 49/49 |
| `npm run smoke:api:sprint6` | **PASS** — 59/59 |
| `npm run smoke:api:sprint7` | **PASS** — 50/50 |
| `npm run smoke:web` | **PASS** — 3 mock; API NOT RUN |
| `npm run smoke:web:summary` | **PASS** — 3 mock; API NOT RUN default |
| `npm run smoke:web:publish` | **PASS** — mock |
| `npm run smoke:web:publish -- -IncludeApiMode` | **PASS** — 11/11 (mock + API full flow) |

### Sprint 7 API runtime smoke (8 Juni 2026)

Script: `scripts/sprint7-smoke-api.ps1` — **50/50 PASS**

| Area | Key tests |
|---|---|
| Generation gate | 401 no token; 409 pre-approve; 201 after approve+summarized |
| Leak guard | No planningTruth/packet_json/prose_text/delta_json/provider/model/token |
| Canon | facts/characters/speech/openLoops/reveals/summaries/proposals unchanged |
| Fields | PATCH valid; reject leak + 4 overclaim patterns |
| Checklist | PATCH valid; reject unknown + duplicate ids |
| Export | mark-exported; idempotent; 409 lock; manual marker metadata |
| Cross-user | 404 on all publish endpoints |
| No autopost | Static `publish.ts` scan |

---

## 9. Runtime Verification Summary

| Check | Result |
|---|---|
| API smoke Sprint 7 | **50/50 PASS** |
| Sprint 6 smoke | **59/59 PASS** |
| Sprint 5 smoke | **49/49 PASS** |
| Sprint 2 smoke | **17/17 PASS** |
| Publish web mock E2E | **PASS** |
| Publish web API-mode E2E | **PASS** (`-IncludeApiMode`) |
| Production deploy | **Not performed** |
| Remote migration push | **Not performed** |

---

## 10. Known Limitations

- **No auto-post KBM** — manual copy + local exported marker only
- **No OpenRouter / AI generation** — stub `publish_stub_v1` only
- **No model router** — deferred
- **No credit deduction** — deferred Sprint 8
- **No analytics** — deferred
- **No chapter picker** — default Bab 1 from outline bundle
- **No UI regenerate** — API supports `regenerate=true`; no CTA in PublishPage
- **Clipboard content not asserted** — E2E checks copy button presence only
- **API-mode web E2E not in GitHub Actions** — local `-IncludeApiMode` only
- **CI still typecheck/build only** — no Docker/Supabase/Playwright in Actions
- **No audit log for export event** — metadata on package row only
- **Checklist incomplete warning** does not block mark-exported
- **No production deploy / remote migration push**

---

## 11. Closure Decision

| Question | Answer |
|---|---|
| **Sprint 7 ready to close?** | **Yes** |
| **Blockers** | None |
| **Non-blocking limitations** | Auto-post, OpenRouter/AI, regenerate UI, chapter picker, export audit log, CI E2E — documented in §10 and `docs/36` |

Sprint 7 acceptance criteria dari `docs/39` §12 terpenuhi via smoke + web integration + publish boundary tests.

---

## 12. Recommended Next Sprint

**Primary recommendation: Option B — Hardening Sprint (audit logs, DB transactions, CI E2E) before AI**

Alasan:

- Sprint 7 menutup MVP artifact flow dari ide → foundation → outline → write → summary → **publish package** copy-ready.
- Sebelum AI/OpenRouter/credit-gated generation, sistem perlu hardening: `audit_logs` + `audit_action` extension, DB transaction wrappers untuk multi-step workflows, dan CI E2E strategy (publish/summary API-mode).
- Debt P1 di `docs/36` secara eksplisit menempatkan audit logs dan transactions **before AI generation or production deploy**.

**Deferred to later (after hardening): Option A — Sprint 8 AI/OpenRouter & Credit-Gated Generation**

- OpenRouter integration, model router, credit deduction, and production-quality generation remain out of scope until hardening baseline is met.

**Concrete next tasks (suggested):**

1. Audit log enum + write-room/summary/publish export events
2. DB transaction wrapper for outline lock, proposal promotion, publish supersede
3. `smoke:all:local` include sprint6 + sprint7 scripts
4. GitHub Actions optional smoke job (or documented local gate)
5. `confirmHighRisk` UI for summary reveal proposals (carry-over Sprint 6)

---

## Related documents

- [`docs/39-sprint-7-publish-package-kbm-export-implementation-plan.md`](39-sprint-7-publish-package-kbm-export-implementation-plan.md)
- [`docs/38-sprint-6-verification-report.md`](38-sprint-6-verification-report.md)
- [`docs/36-non-blocking-technical-debt-and-deferred-items.md`](36-non-blocking-technical-debt-and-deferred-items.md)
- [`apps/api/README.md`](../apps/api/README.md) — Tasks 7.2–7.3 API reference
- [`scripts/README.md`](../scripts/README.md) — smoke command index