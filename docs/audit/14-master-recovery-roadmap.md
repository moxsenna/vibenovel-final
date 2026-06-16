# Narraza — Master Recovery Roadmap

**Date:** 2026-06-17
**Purpose:** Single source of truth for finishing Narraza per the full-feature blueprint (`docs/03`). Consolidates the live E2E test (`docs/audit/13`), the code inventory, and the prior audit docs (`docs/audit/00/03/11/12`, `docs/36`, `docs/63`, `docs/100`) into one sequenced plan.
**Scope reminder:** the work done so far is the **P0 firefighting layer** surfaced by live testing. This roadmap is the full path from "core pipeline mostly works" to "full version complete."

## Legend
- ✅ **Done** — implemented and (where noted) live-verified
- 🟡 **Partial** — subset shipped; meaningful gaps remain
- ⛔ **Not started**
- ⏸️ **Deferred** — intentionally postponed (owner decision / gated)
- ❌ **Failed / Blocked** — attempted or required, currently broken or gated by infra/billing

---

## Current deployment snapshot (2026-06-17)
- API worker (Cloudflare): version `c0abe707` — live at `api.narraza.web.id`.
- Web (Cloudflare Pages): Asisten Narra build live at `app.narraza.web.id`.
- Local Node dev: `npm run dev:api:node` (loads `.dev.vars`) → `localhost:8787` against local Supabase. **No Workers subrequest limit** — this is the path for heavy flows (prose) and the future VPS.

---

## Live findings ledger (from `docs/audit/13`)
| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Outline generation fails on free model ("invalid response") | 🔴 P0 | ✅ Fixed (Phase 0 resilience) — live-verified |
| 2 | Readiness saturates to 100%; "Matangkan dengan Narra" band skipped | 🟠 P1 | ⛔ Not started (Layer 1) |
| 3 | Foundation lockable with empty core fields (Gaya/Rahasia) | 🟠 P1 | ⛔ Not started (Layer 1) |
| 4 | Intake progress % vs per-field cards inconsistent | 🟡 P2 | ⛔ Not started (Layer 1) |
| 5 | "Fakta dikunci" card empties after lock | 🟡 P2 | ⛔ Not started (Layer 1) |
| 6 | Product branding still "VibeNovel" (title + some copy) | 🟡 P2 | ⛔ Not started (Layer 1) |
| 7 | Prose output hard-blocked by validator (forbidden-concept over-match) | 🔴 P0 | ✅ Fixed (Phase 2) — live-verified (24→3) |
| 8 | AI-failure UX is a dead-end (no retry/refund clarity, no streaming) | 🟠 P1 | ⛔ Not started (Layer 1) |
| 9 | Prose flow exceeds Cloudflare Worker subrequest limit (50 Free) | 🔴 P0 | ✅ Resolved via Node runtime (local now, VPS later) — no code reduction |

---

## Layer 0 — Core pipeline complete end-to-end
| Item | Status | Notes / acceptance |
|------|--------|--------------------|
| Intake / Asisten Narra chat + signal detection (real AI) | ✅ | Live-verified |
| Concept generation (3 options) + selection | ✅ | Live-verified |
| Foundation proposals + proposal-first canon promotion | ✅ | Live-verified |
| High-risk secret safety (stays proposal) | ✅ | Live-verified |
| Outline generation (10 ch, real AI) + lock | ✅ | Live-verified after Phase 0 |
| Beat list generation (real AI) | ✅ | Live-verified |
| Context Packet + safety gates (forbidden / POV / secrets) | ✅ | Live-verified |
| Credits: balance, debit, refund | ✅ | Live-verified |
| **Prose → Summary → Publish end-to-end (on Node)** | ⛔ | **Next up after Layer 1** — never proven end-to-end; run on local Node |
| Model quality for prose/outline (reliable tier) | ⏸️ | Free model unreliable; needs paid `TERBAIK` for prod. Owner-deferred during local dev |
| MVP acceptance: 20–30 chapter serial, no reveal leak, POV-correct | ⛔ | Core acceptance proof — never run |

## Layer 1 — UX & correctness gaps (P1 — **in progress now**)
| Item | Finding | Status | Acceptance |
|------|---------|--------|-----------|
| Branding sweep VibeNovel → Narraza | #6 | ⛔ | `<title>` + all user-facing copy say "Narraza" |
| Readiness calibration + reachable "Matangkan" band | #2 | ⛔ | A fresh AI foundation lands 75–84 before lock; CTA shows |
| `canLock` requires core fields filled | #3 | ⛔ | Lock blocked while premise/conflict/etc. empty |
| Reconcile intake progress meters | #4 | ⛔ | % and per-field cards driven by same signal state |
| Post-lock foundation render | #5 | ⛔ | Locked facts/fields persist visibly after lock |
| AI-failure UX (refund clarity, retry affordance, streaming) | #8 | ⛔ | Failures show refund + retry; long gens stream/progress |

## Layer 2 — Full validator suite (Phase D, `docs/09`)
| Validator | Status |
|-----------|--------|
| Output safety / no future-reveal leak / no raw context | ✅ (Sprint 14 core; recalibrated Phase 2) |
| Instruction-compliance (beat goal, must-include/not) | 🟡 partial |
| Character-knowledge (POV) automated validator | 🟡 packet shipped; automated check pending |
| Mobile readability | 🟡 partial |
| Retention / unlockability scoring | 🟡 tracked, no full validator |
| Style / voice consistency | ⛔ |
| Safe-repair **auto-loop** (validator fail → repair → re-validate) | ⛔ (manual "Perbaiki Teks" only) |

## Layer 3 — Full Version feature backlog
| Feature | Phase | Status |
|---------|-------|--------|
| Draft Import full analyzer + conflict detection | E | 🟡 signals only |
| Creator Mode Story-Bible editors (reveal schedule, char-knowledge, locked-facts CRUD) | G | 🟡 read-only |
| Voice DNA / style learning + drift detector | F | ⛔ |
| Analytics & retention dashboard + activity tracking + publish-performance loop | H | ⛔ |

## Layer 4 — Production hardening & infra
| Item | Status |
|------|--------|
| Node/VPS production deploy (removes Workers subrequest cap) | ⏸️ planned by owner |
| True DB transactions/RPC for P0 flows (prose save atomicity, outline lock) | ⛔ (`docs/36` debt) |
| API-mode E2E in CI (GitHub Actions) | ⛔ (`docs/36` debt) |
| Web bundle split (720 KB single chunk) | ⛔ |
| Production payments enable (Duitku/Mayar live) | ⏸️ gated: founder + migration `00010` to prod |
| Audit logs for outline/write/prose events | 🟡 partial (`docs/36`) |

## Layer 5 — Final acceptance
| Item | Status |
|------|--------|
| Conformance review vs `docs/03` (72-feature checklist) | ⛔ |
| Full-version sign-off | ⛔ |

---

## Sequenced execution plan (dependency order)
1. **Layer 1 (P1)** — UX/correctness fixes *(current)*. Low-risk, mostly web; unblocks a coherent writer experience.
2. **Layer 0 remainder** — verify prose → summary → publish on local Node; decide model tier for reliability.
3. **Layer 2** — complete validator suite + safe-repair auto-loop (quality gate before opening AI widely).
4. **Layer 4 infra** — VPS/Node prod deploy + DB atomicity + CI E2E (production readiness).
5. **Layer 3** — Full Version features (Draft Import, Creator Mode editors, Voice DNA, Analytics).
6. **Payments (Layer 4)** — gated production enable.
7. **Layer 5** — conformance review + sign-off.

> This roadmap supersedes the tactical view in `docs/audit/13`. Update item statuses here as work lands.
