# 91 — Founder Browser E2E Story Workflow (Task 10.29)

**Date:** 2026-06-10  
**Status:** **GO**  
**Brand:** **Narraza**  
**Related:** [`docs/90`](90-ai-founder-test-mode-report.md), [`docs/88`](88-founder-private-beta-story-smoke-report.md), [`.agent-logs/sprint-10/task-10.29-founder-browser-e2e-story-workflow.md`](../.agent-logs/sprint-10/task-10.29-founder-browser-e2e-story-workflow.md)

Founder browser E2E on production app with live OpenRouter AI. **Payment OFF.** **Not public AI launch.**

---

## Final summary

```txt
Task 10.29 — Founder Browser E2E Story Workflow on Production App
Status: GO

Founder browser path verified on https://app.narraza.web.id
All workflow routes API-backed (no mock fallback when authed)
Write Room "Tulis Beat dengan AI" triggers real OpenRouter generation
Prose persists after reload; credit debited correctly in UI (35 → 25)
Payment remains OFF; migration 00010 NOT applied
```

---

## Browser path

| Step | Result |
|---|---|
| Open `https://app.narraza.web.id/login` | Session injected (founder `moxsenna@gmail.com`) |
| Dashboard | Real projects visible; no demo-only empty state |
| Project `c5a9f0fb-7f45-4c9f-b37f-4a2981adeba9` routes | Intake → concepts → foundation → outline → write → summary → publish |
| Write room | Bab 1 loaded from API; beats present |
| AI prose (UI) | **Tulis Beat dengan AI** → success notice + prose in editor |
| Reload | Prose text persisted from API |
| Credit | Assistant panel: 35 → 25 (10 kredit, mode Seimbang) |
| Payment | Top up disabled message shown |

**Note:** Sidebar "Proyek Aktif" may show a different project title than URL route (active-project vs deep-link). Write room still loads API data for URL project ID.

---

## Route-by-route audit

| Route | Expected | Current Result | Real/Stub/Mock | Action |
|---|---|---|---|---|
| `/login` | Supabase auth | **PASS** HTTP 200 | **REAL** | None |
| `/dashboard` | API project list | **PASS** — no mock notice | **REAL** (authed) | None |
| `/start` | Create project API | **PASS** | **REAL** | None |
| `/projects/:id/intake` | Persisted messages | **PASS** | **REAL** API + stub agent reply | None |
| `/projects/:id/concepts` | Template concepts | **PASS** | **REAL** API — deterministic stub generator | Label honest (existing) |
| `/projects/:id/foundation` | Foundation bundle | **PASS** | **REAL** API — stub proposals | None |
| `/projects/:id/outline` | Outline plan | **PASS** | **REAL** API — stub generator, persisted rows | None |
| `/projects/:id/write` | Write room + AI | **PASS** — UI AI works | **REAL** OpenRouter prose | Deployed UI gate fix |
| `/projects/:id/summary` | Summary API | **PASS** — loads without mock fallback | **REAL**/stub mix | None |
| `/projects/:id/publish` | Publish API | **PASS** | **REAL** API | None |
| `/settings` | Settings API | **PASS** | **REAL** when authed | None |

---

## Concept / foundation / outline

| Stage | Backend | Browser |
|---|---|---|
| **Concept** | Deterministic stub (`concepts/generate`) | API-backed; persisted; not OpenRouter |
| **Foundation** | Stub proposals + accept/lock | API-backed; persisted |
| **Outline** | Stub generator + approve/lock | API-backed; persisted |
| **Write / prose** | **OpenRouter** via `POST .../ai/generate-prose` | **UI wired** — real LLM output |

---

## AI prose UI

| Item | Value |
|---|---|
| **Trigger** | Button **Tulis Beat dengan AI** in `WriterAssistantPanel` |
| **API call** | `POST /api/projects/:id/ai/generate-prose` with auth Bearer |
| **Result** | Indonesian prose about Nadira (kitchen/family scene); not stub template |
| **Model** | `google/gemini-2.5-flash` (hemat tier env) / UI quality **Seimbang** = 10 credits |
| **Version** | New `chapter_prose_versions` row per generation (persisted) |
| **Persistence** | Survives page reload via `fetchBeatProseVersions` |
| **Error handling** | Honest messages (`mapAiGenerationErrorCode`); no fake output |
| **Loading** | Button disabled + generating state |

No large new architecture — existing Sprint 8 wiring was sufficient.

---

## Credit behavior

| Item | Value |
|---|---|
| **API balance before E2E** | 35 |
| **UI balance before generation** | 35 (assistant panel) |
| **After successful UI generation** | 25 |
| **Debit amount** | 10 (Seimbang prose beat) |
| **Refund on failure** | Verified in Task 10.28 (API path) |
| **UI visibility — write room** | **YES** — Saldo Kredit card shows balance, cost, estimate |
| **UI visibility — shell header** | **NO** — `CreditIndicator` still mock **1.250** (Sprint 1 debt) |
| **Top up** | Disabled — "Top up belum tersedia di versi ini" |

---

## Production regression

| Check | Result |
|---|---|
| `https://narraza.web.id` | **200** |
| `https://app.narraza.web.id` | **200** |
| `https://api.narraza.web.id/api/health` | **PASS** — AI on, payment mock |
| Staging API health | **PASS** |
| Bundle staging refs | **0 hits** (`index-DBGHK6L4.js`) |
| `npm run typecheck` | **PASS** |
| Web deploy | **PASS** — `npm run deploy:web:production` |

---

## Security / payment

| Check | Result |
|---|---|
| Payment OFF | **PASS** |
| Migration 00010 | **NOT applied** |
| Duitku | **Inactive** |
| OpenRouter key in frontend | **None** |
| Service role in frontend | **None** |
| Public AI launch | **NO** — auth + credits required; founder test window only |

---

## Files changed

| Path | Note |
|---|---|
| `apps/web/src/hooks/useWriteRoomData.ts` | Disable AI buttons when `aiGenerationEnabled=false` |
| `apps/web/e2e/sprint10-founder-production-e2e.spec.ts` | Production browser E2E |
| `scripts/task-10.29-founder-browser-e2e.ps1` | Operator runner |
| `docs/91-founder-browser-e2e-story-workflow-report.md` | This report |

**Deployed:** production app bundle `index-DBGHK6L4.js`

---

## Docs updated

- `docs/91-founder-browser-e2e-story-workflow-report.md`
- `README.md`, `docs/36`, `docs/63`, `docs/87`, `docs/88`, `docs/89`, `docs/90`
- `scripts/README.md`

---

## Remaining blockers

| Item | Severity |
|---|---|
| Shell `CreditIndicator` shows mock 1.250 — not API balance | Low — write room has real credit UI |
| Sidebar active project vs URL project can diverge | Low — navigation UX |
| No founder-only AI gate in API | Medium — keep AI test window limited |
| Concept/foundation/outline remain template stubs | Expected — not this task |

---

## Next recommended task

1. **10.30** — Wire shell `CreditIndicator` to `GET /api/credits/balance` (trivial, safe)
2. Align sidebar links with current route project ID
3. Founder manual smoke on deployed bundle `index-DBGHK6L4.js`
4. Do **not** proceed to payment / `00010` / Duitku without separate approval