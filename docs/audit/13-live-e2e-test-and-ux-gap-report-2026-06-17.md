# Live E2E Test, UX & Gap Report — narraza.web.id

**Date:** 2026-06-17
**Method:** Live black-box test of production (`app.narraza.web.id`) via BrowserAct (local Chrome automation), authenticated with a test account, cross-referenced against the full-feature blueprint (`docs/03`), code inventory, and audit docs (`docs/audit/*`, `docs/36`, `docs/100`).
**Scope:** Real authenticated run on a fresh throwaway project ("Ide Kasar", `19f3bc20-…`). Existing data was not modified. AI generations used real OpenRouter (production config), not mocks.

---

## 1. Executive summary

The **front half** of the pipeline works well on production with **real AI**: project creation, Asisten Narra chat + signal detection, 3-concept generation, concept selection, foundation proposal generation, proposal-first canon promotion, high-risk-secret safety, and foundation lock all PASSED.

The pipeline then hits a **hard, reproducible production blocker at Outline generation** ("AI provider returned an invalid response", 2/2 attempts). Because Outline gates Write Room → Summary → Publish, **the entire downstream half of the product is currently unreachable for real users on production.** Root cause is almost certainly the production model config: all quality tiers point to a single **free** model (`google/gemma-4-31b-it:free`) that cannot reliably return the large structured JSON the outline step requires.

A second structural finding: the **foundation readiness model saturates to 100% almost immediately** after accepting a few AI proposals, so the 75–84% "Siap dimatangkan" band — the only place the new **"Matangkan dengan Narra"** CTA appears — is skipped in practice. The refinement feature we shipped is effectively unreachable for AI-generated foundations.

---

## 2. Live test results (PASS / FAIL / PARTIAL)

| # | Step | Result | Evidence |
|---|------|--------|----------|
| 1 | Login / Supabase auth | ✅ PASS | Redirect to `/dashboard`, session persisted |
| 2 | Dashboard + sidebar nav | ✅ PASS | "Asisten Narra" nav live (shipped rename), credit balance 4.961, project list |
| 3 | New project (persona "ide kasar") | ✅ PASS | Project `19f3bc20-…` created, routed to intake |
| 4 | Asisten Narra chat (real AI) | ✅ PASS | Contextual reply; signals detected (genre, protagonist, conflict, tone, secret, format) |
| 5 | Intake progress vs field cards | ⚠️ PARTIAL | Progress jumped to 86% but per-field cards still "belum terdeteksi" (inconsistent) |
| 6 | Concept generation (3 options) | ✅ PASS | 3 distinct, high-quality concepts (Domestic Thriller / Empowerment / Revenge Drama) |
| 7 | Concept selection → foundation | ✅ PASS | Routed to `/foundation`, concept bound |
| 8 | Foundation proposal generation | ✅ PASS | Real AI proposals: foundation, protagonist, facts, supporting chars, style, secret |
| 9 | Proposal-first canon promotion | ✅ PASS | Accepting proposals populated foundation cards (premise, protagonist, conflict, fact) |
| 10 | High-risk secret safety | ✅ PASS | "Rahasia · Risiko tinggi" stayed a pending proposal; never auto-promoted to canon |
| 11 | Foundation readiness scoring | ⚠️ PARTIAL | Jumped 0 → **100% "Sangat siap"** after ~4 accepts (saturates; see §3.2) |
| 12 | "Matangkan dengan Narra" CTA (75–84%) | ⚠️ NOT OBSERVED | Readiness skipped the 75–84 band; CTA never rendered (see §3.2) |
| 13 | Foundation lock | ✅ PASS | "Fondasi Terkunci" badge + "Lanjut ke Outline" |
| 14 | **Outline generation (10 chapters)** | ❌ **FAIL** | **"AI provider returned an invalid response" — 2/2 attempts.** Blocks everything downstream |
| 15 | Outline lock | ⛔ BLOCKED | No outline produced |
| 16 | Write Room / context packet / beats / prose | ⛔ BLOCKED | Gated by outline lock — unreachable |
| 17 | Beat & prose generation (stub vs real) | ⛔ NOT TESTED | Could not reach Write Room (audit's open question remains unverified live) |
| 18 | Chapter Summary / delta / proposals | ⛔ BLOCKED | Gated by Write Room |
| 19 | Publish package | ⛔ BLOCKED | Gated by Summary |
| 20 | Credits: balance + per-action debit | ✅ PASS | Balance shown (4.961); decremented on intake/generation |
| 21 | Product branding ("Narraza") | ❌ FAIL | `<title>` and some body copy still say "VibeNovel" across pages |

---

## 3. Key findings

### 3.1 🔴 CRITICAL — Outline generation fails on production (pipeline blocker)
- **Symptom:** "AI provider returned an invalid response" on every outline generate attempt (2/2).
- **Impact:** Outline gates Write Room, Summary, and Publish. The **entire downstream product is unreachable** for real users. This is the #1 launch blocker.
- **Likely root cause:** Production worker config sets **all three quality tiers to the same free model**: `AI_MODEL_HEMAT = AI_MODEL_SEIMBANG = AI_MODEL_TERBAIK = google/gemma-4-31b-it:free` (confirmed in production env dump during deploy). Outline is the heaviest structured generation (10 chapters, ~4000-token JSON). Free models frequently emit truncated/invalid JSON at that size → parse fails → 502 "invalid response."
- **Corroborates audit:** `docs/100` / `docs/audit/00` flagged "beat/chapter-summary still stub / model quality" as the top remaining risk; this is the live confirmation, and it extends to **outline** on the current model config.

### 3.2 🟠 HIGH — Readiness saturates to 100%, hiding the refinement gate
- After accepting ~4 proposals, readiness went **0 → 100% "Sangat siap"** in one jump.
- The **75–84% "Siap dimatangkan"** band — the sole trigger for the **"Matangkan dengan Narra"** CTA (shipped this sprint) — is skipped. The refinement loop is effectively dead-on-arrival for AI-generated foundations.
- **Root cause:** maturity checks are keyword/regex-based on the joined foundation text; rich AI prose trivially matches them, so maturity points max out alongside core completeness. The intended "ready to refine, not yet ready to lock" middle state never persists.

### 3.3 🟠 HIGH — Foundation lockable while core fields are empty
- Readiness reported 100% / `canLock=true` while **"Gaya Cerita"** and **"Rahasia Cerita"** showed "Belum diisi", and "Fakta yang Dikunci" had only one entry. A "Catatan Beta: lengkapi bagian yang masih kosong" note appears but does **not** block locking. Quality risk flows into outline/writing.

### 3.4 🟡 MEDIUM — Intake progress % vs field cards inconsistent
- Right-panel "Progres Fondasi" reached 86% while the per-field cards (Genre/Tokoh/Konflik/Janji/Target/Nada) still read "belum terdeteksi". On a different project the cards populated. Users see a high % next to "not detected" fields — looks broken.

### 3.5 🟡 MEDIUM — "Fakta yang Dikunci" appeared to clear after lock
- Before lock it listed "Sari adalah tokoh utama"; immediately after lock the card rendered empty. Likely a display/refetch quirk, not data loss, but reads as a regression to the user.

### 3.6 🟡 MEDIUM — Product branding still "VibeNovel"
- `<title>VibeNovel</title>` on every page; `/start` body header reads "VibeNovel — Workspace Penulis Serial". README states Narraza is the product-facing brand; the app UI mostly says "Narraza" but the title bar and some marketing copy leak the old name.

### 3.7 🟢 Positive confirmations
- Real OpenRouter generation for intake, concepts, foundation proposals — quality is genuinely good and on-theme.
- Proposal-first canon flow works exactly as designed; high-risk secrets are correctly withheld from canon.
- Step gating (nav locks until prerequisites met) and credit debit/economy are working.
- The **Asisten Narra rename + phase-aware intake** shipped this sprint is live and correct.

---

## 4. UX flow recommendations (writer experience)

Ordered by impact on the writer's journey.

1. **Make AI failures recoverable, not dead-ends.** The outline failure surfaced a bare error string and reset the button. Add: automatic retry with backoff, a fallback to a smaller/JSON-reliable model, a clear "coba lagi / hubungi kami" affordance, and a visible confirmation that **credits were refunded** on failure. Never leave the writer staring at "invalid response" with no path forward.
2. **Stream/strengthen long generations.** Outline (and prose) take 30–90s. Show progress/streaming and a time estimate, and make the operation resumable. A 60–120s opaque spinner that can end in failure is the worst case.
3. **Fix the readiness story end-to-end.** Either (a) recalibrate scoring so a freshly-accepted basic foundation lands in 75–84% ("siap dimatangkan") and reaching 85%+ requires genuine maturity, or (b) if 100% is legitimate, drop the now-meaningless refine band. Today the writer is told "Sangat siap 100%" with empty Gaya/Rahasia — mixed signals. Tie `canLock` to core fields actually being filled.
4. **Reconcile the two progress meters.** Intake "Progres Fondasi %" and the per-field cards must agree. Drive both from the same detected-signal state so a writer never sees "86%" beside "belum terdeteksi".
5. **Surface the "Matangkan dengan Narra" path proactively.** Even at high readiness, offer an explicit "tajamkan fondasi dengan Narra" entry (motivation, stakes, serial momentum) rather than gating it to a band users skip. The refinement value shouldn't depend on a transient score window.
6. **Soft-warn before lock when fields are empty.** Lock is described as hard-to-reverse; show a confirm dialog listing empty/weak sections ("Gaya & Rahasia belum diisi — kunci tetap?") instead of silently allowing it.
7. **Branding consistency.** Set `<title>` to "Narraza" and sweep remaining "VibeNovel" strings in user-facing copy (`/start`, meta tags, social cards).
8. **Persist after-lock state cleanly.** Ensure locked facts/fields re-render from canon immediately after lock (avoid the empty "Fakta yang Dikunci" flash).

---

## 5. Completion plan (to finish Narraza per the full-feature blueprint)

Prioritized; the first item is a launch blocker.

### Phase 0 — Unblock the pipeline (P0, do first)
- **Fix model config / outline reliability.** Point `TERBAIK` (and ideally `SEIMBANG`) at a paid model that reliably returns structured JSON (e.g. a Gemini Flash or Claude Haiku tier already allowlisted in `model-router.ts`), keeping `HEMAT`=free for cheap steps. Add JSON-mode/schema enforcement + a repair-parse + retry/fallback path in outline/beat/summary generators. **Acceptance:** outline generates 10 chapters end-to-end on production ≥ 9/10 attempts.
- **Re-run the full live E2E** (outline → write room → beat → prose → summary → publish) and finally verify the audit's open question: are **beat & chapter-summary generation real AI or stub on default paths** (`docs/100` Sprint-112 item)?

### Phase 1 — Readiness & foundation quality (P1)
- Recalibrate readiness so core-vs-maturity bands behave (see §4.3); replace regex maturity checks with model-scored or structured checks; gate `canLock` on filled core fields; wire the "Matangkan dengan Narra" path so it's reachable.

### Phase 2 — Safety/validator depth (P1, per `docs/09`)
- Complete the validator suite beyond the Sprint-14 subset (instruction compliance, character-knowledge, mobile readability, retention) and wire the safe-repair loop into the write flow; verify live that prose respects reveal/POV gates.

### Phase 3 — Polish & consistency (P2)
- Reconcile progress meters (§4.4), fix post-lock rendering (§3.5), branding sweep (§3.6), and AI-failure UX (§4.1–4.2) as shared components.

### Phase 4 — Backlog features from the full plan (P2–P3)
- Draft Import full analyzer + conflict detection; Creator Mode Story-Bible editors (reveal schedule, character knowledge, locked-facts CRUD); Voice DNA / style learning; analytics/retention dashboard; KBM auto-post.

### Phase 5 — Payments (gated, P2)
- Production payment enable remains **BLOCKED** pending founder approval + ops checklist + atomic-grant RPC `00010` applied to prod (`docs/73`, `docs/77`). Keep disabled until Phase 0–1 are solid.

---

## 6. Test artifacts & notes
- Test project: `19f3bc20-730e-4e40-a235-49d9f47d3a7b` ("Ide Kasar"), production. A BrowserAct browser `narraza-test` remains on the BrowserAct account (session closed).
- Credits consumed: a handful (intake 1 + concept + foundation proposals + 2 failed outline attempts — failed attempts should be auto-refunded per `credit-ledger` logic; verify in ledger).
- The BrowserAct test account credential used here should be rotated (it was shared in chat).

---

## 7. Phase 0 fix + downstream live re-test (2026-06-17, same day)

After this report's first pass, **Phase 0 resilience** was implemented and deployed to production (worker version `3726d940`) — model config left unchanged (still `gemma-…:free` on all tiers), per the testing-phase constraint. Changes: retry on empty output, planning retry-floor (3) + exponential backoff, 60s timeout for heavy planning gens, and lenient JSON parse for outline.

### Re-test results

| Step | Before Phase 0 | After Phase 0 |
|------|----------------|----------------|
| **Outline generation** | ❌ FAIL 2/2 ("invalid response") | ✅ **PASS** — 10/10 chapters, `outline_ai_generator`, ~90s (retries visibly worked) |
| Outline lock | ⛔ blocked | ✅ PASS — open loops + reveal schedule populated |
| Beat list generation | not reached | ✅ **PASS — real AI** (beats specific to Sari's story, not stub templates) |
| Context Packet + safety gates | not reached | ✅ **PASS** — 3 must-include, **24 forbidden**, 5 safety checks, "Rahasia masa depan ditahan", "POV knowledge scoped" |
| **Prose beat generation** | not reached | ❌ **FAIL 2/2** — output rejected by safety validator |
| Summary / Publish | not reached | ⛔ blocked (gated by prose) |

**Phase 0 verdict:** ✅ Confirmed effective. The free-model outline blocker (§3.1) is resolved by resilience alone — the same model now succeeds. Beat generation and the context-packet safety system are confirmed working with real AI.

### 🔴 NEW CRITICAL — Finding #8: prose output consistently rejected by validator

- **Symptom:** Every "Tulis Beat dengan AI" attempt returns `AI_OUTPUT_UNSAFE` → "Output AI ditolak oleh pemeriksaan keamanan." Credit is correctly refunded (balance unchanged); the safe-repair affordance ("Perbaiki Teks dengan AI") appears. Reproduced 2/2.
- **Root cause (code-traced):** `validateAiOutput` in `apps/api/src/services/output-validator.ts` has 4 hard-`blocked` checks. The only one that can fire repeatedly on ordinary scene prose is **`no_future_reveal_leak`** (`apps/api/src/services/output-validator.ts:114`), which does a **case-insensitive substring match** of the prose against the context packet's ~24 forbidden concepts (AI-generated reveal titles/concepts: house-sale secret, debt, character names, etc.). The other blocked checks (`no_raw_context_fields`, `no_provider_or_model_names`) require leakage markers that normal prose won't contain.
- **Why it's a blocker:** substring matching is too aggressive — when forbidden concepts share common words with the scene (a free model that doesn't perfectly avoid them makes this near-certain), legitimate prose is hard-blocked, not warned. Write Room can't produce any prose → Summary/Publish unreachable. This is partly a **validator-calibration** issue and partly a **model-quality** issue (a stronger model leaks forbidden concepts less).
- **Fix (Phase 2 — validator calibration):**
  1. Match whole reveal phrases / semantic intent, not bare substrings; exclude short/common tokens and canon-known entity names (protagonist name, locations already public) from the forbidden set.
  2. Downgrade `no_future_reveal_leak` from hard `blocked` to `warning` + **auto-invoke the existing safe-repair loop** to strip the leak, re-validate, and only block if repair fails N times.
  3. Re-test on a stronger model tier (the eventual paid `TERBAIK`) — likely reduces leak frequency materially.

### Updated priority

Phase 0 cleared the first gate; the pipeline now blocks one step later, at **prose validation**. Recommended next: **Phase 2 validator calibration** (above) to unblock Write Room → Summary → Publish, then re-run the full downstream chain. Everything upstream of prose (intake → concept → foundation → outline → beats → context packet) is now live-verified working with real AI.

---

## 8. Phase 2 fix + prose re-test (2026-06-17, same day)

**Phase 2 validator calibration** was implemented and deployed (worker `ab8b15e7`).

- **Fix:** `extractForbiddenConcepts` (`apps/api/src/services/context-packet-safety.ts`) was emitting every 3+ char non-stopword token from the reveal title **and** the safe reader-facing hint, so common words like `hubungan`/`identitas` became forbidden and `no_future_reveal_leak` hard-blocked nearly all prose. Now it emits distinctive multi-word phrases from the **title only** (lone words kept only when ≥6 chars).
- **Live evidence:** the context-packet "Item dilarang" count dropped **24 → 3**, and the "Output AI ditolak oleh pemeriksaan keamanan" rejection is **gone**. ✅ Phase 2 confirmed effective.

### 🔴 NEW CRITICAL — Finding #9: prose flow exceeds the Cloudflare Worker subrequest limit

After the validator fix, prose generation reaches a different hard failure: HTTP 500 `INTERNAL_ERROR` → "Failed to update generation attempt". A temporary diagnostic surfaced the real cause from the worker:

> **"Too many subrequests by single Worker invocation."** (Cloudflare Workers limit — 50 on the Free plan, 1000 on Paid)

- **Stack:** failed inside `markGenerationAttemptFailed → handleProviderFailure → generateProseBeatForOwner` — i.e. the free model failed, the router retried, and the cumulative subrequests (context-packet build + provider retries + credit refund + mark-failed + audit writes) blew past the per-invocation subrequest cap. Even the failure path can't finish.
- **Why prose specifically:** the prose flow is by far the heaviest — `buildContextPacketForOwner` + `loadWriteContextSnapshot` (foundation, characters, facts, reveals, open loops, timeline, POV knowledge) + prompt build + attempt lifecycle + ledger + audit + OpenRouter (×retries). Queries are mostly `Promise.all`-batched (no runaway N+1), but the total (~30–60 subrequests) exceeds a **50-subrequest Free-plan cap**. Lighter flows (intake/concept/foundation/outline) stay under it, which is why they pass.
- **This is an infrastructure ceiling, not a code bug** — independent of model quality and validator calibration. It very likely means prose generation has never completed on the current production worker.

**Fixes:**
1. **Immediate (recommended):** move the worker to the **Cloudflare Workers Paid plan** ($5/mo) → 1000 subrequests/invocation. Unblocks prose (and any other heavy flow) at once. This is a billing/account decision for the owner.
2. **Engineering (good hygiene, not urgent if on Paid):** trim subrequests in the prose path — collapse the per-attempt audit/ledger round-trips, fold context-packet snapshot reads into fewer batched queries, and short-circuit the failure handler so it does the minimum DB work when subrequests are already near the cap.
3. **Model quality (separate, deferred):** even with headroom, the free model still fails prose often; the eventual paid `TERBAIK` tier is needed for reliable prose. Until then, prose may fail at the model level (now with a clean refund instead of a subrequest crash).

### Net status after Phases 0 + 2
- ✅ Intake → Concept → Foundation → Outline → Outline lock → Beats → Context Packet (+ safety gates) — all live-verified with real AI.
- ✅ Two code blockers fixed and deployed: outline resilience (Phase 0) and validator false-block (Phase 2).
- ⛔ Prose → Summary → Publish remain blocked by Finding #9 (Worker subrequest cap) and, secondarily, free-model prose reliability — both **owner decisions** (upgrade plan / enable paid model), not outstanding code bugs.
