# Narraza — Master Recovery Roadmap

**Date:** 2026-06-17 (updated 2026-06-17 recovery pass)
**Purpose:** Single source of truth for finishing Narraza per the full-feature blueprint (`docs/03`). Consolidates the live E2E test (`docs/audit/13`), the code inventory, and the prior audit docs (`docs/audit/00/03/11/12`, `docs/36`, `docs/63`, `docs/100`) into one sequenced plan.
**Scope reminder:** Layer 0 remainder + Layer 1 UX/correctness shipped locally (2026-06-17). **Layers 0–2 MVP+ shipped locally; Layer 4 CI slice; see `docs/audit/16-narraza-recovery-final-report-2026-06-17.md`.

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
- Local Node dev: `npm run dev:api:node` (loads `.dev.vars`) → `localhost:8787` against local Supabase. **No Workers subrequest limit** — path for heavy flows (prose) and future VPS.
- **Local proof:** `npm run smoke:api:sprint14:e2e-node` → **36 PASS, 0 FAIL** (intake → publish on Node, mock AI). Log: `docs/14-narraza-layer1-recovery-log.md`.

---

## Live findings ledger (from `docs/audit/13`)
| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Outline generation fails on free model ("invalid response") | 🔴 P0 | ✅ Fixed (Phase 0 resilience) — live-verified |
| 2 | Readiness saturates to 100%; "Matangkan dengan Narra" band skipped | 🟠 P1 | ✅ Layer 1 — maturity +1, structural 75–84 band (`sprint19` contracts) |
| 3 | Foundation lockable with empty core fields (Gaya/Rahasia) | 🟠 P1 | ✅ Layer 1 — `genre_tone` + `secret_guard` in `coreKeys` (pass required) |
| 4 | Intake progress % vs per-field cards inconsistent | 🟡 P2 | ✅ Layer 1 — honest `buildHonestProgress` only |
| 5 | "Fakta dikunci" card empties after lock | 🟡 P2 | ✅ Layer 1 — refetch full foundation bundle after lock |
| 6 | Product branding still "VibeNovel" (title + some copy) | 🟡 P2 | ✅ Layer 1 — Narraza user-facing API/payment/OpenRouter; web UI already Narraza |
| 7 | Prose output hard-blocked by validator (forbidden-concept over-match) | 🔴 P0 | ✅ Fixed (Phase 2) — live-verified (24→3) |
| 8 | AI-failure UX is a dead-end (no retry/refund clarity, no streaming) | 🟠 P1 | 🟡 Layer 1 — refund notice on concept/foundation/outline; **streaming deferred** |
| 9 | Prose flow exceeds Cloudflare Worker subrequest limit (50 Free) | 🔴 P0 | ✅ Resolved via Node runtime (local now, VPS later) |

---

## Layer 0 — Core pipeline complete end-to-end
| Item | Status | Notes / acceptance |
|------|--------|--------------------|
| Intake / Asisten Narra chat + signal detection (real AI) | ✅ | Live-verified |
| Concept generation (3 options) + selection | ✅ | Live-verified |
| Foundation proposals + proposal-first canon promotion | ✅ | Live-verified |
| High-risk secret safety (stays proposal) | ✅ | Live-verified; smoke skips non-promotable facts |
| Outline generation (10 ch, real AI) + lock | ✅ | Live-verified after Phase 0 |
| Beat list generation (real AI) | ✅ | Live-verified |
| Context Packet + safety gates (forbidden / POV / secrets) | ✅ | Live-verified |
| Credits: balance, debit, refund | ✅ | Live-verified |
| **Prose → Summary → Publish end-to-end (on Node)** | ✅ | **`smoke:api:sprint14:e2e-node` PASS** (2026-06-17, mock AI) |
| Model quality for prose/outline (reliable tier) | ⏸️ | Free model unreliable; needs paid `TERBAIK` for prod |
| MVP acceptance: 20–30 chapter serial, no reveal leak, POV-correct | ⛔ | Core acceptance proof — never run |

## Layer 1 — UX & correctness gaps (P1)
| Item | Finding | Status | Acceptance |
|------|---------|--------|-----------|
| Branding sweep VibeNovel → Narraza | #6 | ✅ | API/payment/OpenRouter; `@vibenovel/*` package names unchanged |
| Readiness calibration + reachable "Matangkan" band | #2 | ✅ | Maturity +1; rich intake ~80; lock path ≥85 in contracts |
| `canLock` requires core fields filled | #3 | ✅ | `genre_tone`, `secret_guard` require pass |
| Reconcile intake progress meters | #4 | ✅ | Single honest signal checklist |
| Post-lock foundation render | #5 | ✅ | Full bundle refetch after lock |
| AI-failure UX (refund clarity, retry affordance, streaming) | #8 | 🟡 | Refund copy shipped; streaming → Layer 2+ |

## Layer 2 — Full validator suite (Phase D, `docs/09`) — **in progress**
| Validator | Status |
|-----------|--------|
| Output safety / no future-reveal leak / no raw context | ✅ (Sprint 14 core; recalibrated Phase 2) |
| Instruction-compliance (beat goal, must-include/not) | 🟡 partial (`beat_requirement_coverage` warning) |
| Character-knowledge (POV) automated validator | 🟡 prose output check vs unknown canon facts (beat + rewrite) |
| Mobile readability | 🟡 partial (`safe_mobile_prose_length` warning) |
| Retention / unlockability scoring | 🟡 `retention_unlock_hook` warning (hook keywords) |
| Style / voice consistency | 🟡 `style_voice_consistency` warning (foundation tone) |
| Safe-repair **auto-loop** (validator fail → repair → re-validate) | 🟡 server loop on beat + rewrite + publish copy |

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
| API contract tests in CI | 🟡 `test:api:contracts` (no Supabase E2E in CI) |
| Web bundle split | 🟡 Vite `manualChunks` (react/supabase/vendor) |
| Production payments enable (Duitku/Mayar live) | ⏸️ gated: founder + migration `00010` to prod |
| Audit logs for outline/write/prose events | 🟡 partial (`docs/36`) |

## Layer 5 — Final acceptance
| Item | Status |
|------|--------|
| Conformance review vs `docs/03` (72-feature checklist) | 🟡 snapshot in `docs/audit/16` |
| Full-version sign-off | ⛔ |

---

## Sequenced execution plan (dependency order)
1. ~~**Layer 1 (P1)**~~ — ✅ shipped locally (see `docs/14-narraza-layer1-recovery-log.md`).
2. ~~**Layer 0 remainder**~~ — ✅ Node E2E smoke PASS.
3. ~~**Layer 2 MVP+**~~ — validators + safe-repair + POV + labels (retention/style warnings).
4. **Layer 4 infra** — VPS/Node prod deploy + DB atomicity + CI E2E.
5. **Layer 3** — Full Version features.
6. **Payments (Layer 4)** — gated production enable.
7. **Layer 5** — conformance review + sign-off.

> This roadmap supersedes the tactical view in `docs/audit/13`. Update item statuses here as work lands.