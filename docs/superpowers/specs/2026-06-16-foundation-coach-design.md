# Foundation Coach / Matangkan Fondasi Design

Date: 2026-06-16
Status: Proposed design
Owner: Narraza product sprint

## Problem

The current Foundation flow can reach 75% after import-derived proposals are accepted. That proves the project has the minimum structural pieces: selected concept, premise, conflict, reader promise, protagonist, a few facts, target reader, genre, tone, and secret safety. It does not prove the story is mature enough to lock.

This is especially visible after Draft Import. The imported draft can seed a real foundation, but the result is often a "working draft" rather than a reliable story bible. Locking at 75% lets weak premises, shallow stakes, vague character motivation, or generic reader promise flow into outline generation.

The product needs an intermediate refinement step: after proposals fill the foundation, the writer should be guided by AI to sharpen the foundation before lock.

## Goals

- Treat 75% as "ready to refine", not "ready to lock".
- Add a guided AI step named Foundation Coach / Matangkan Fondasi.
- Keep Narraza's proposal-first rule: AI output becomes proposals or patch previews, never silent canon mutation.
- Let the writer answer a few targeted questions instead of rewriting the whole foundation form manually.
- Raise the lock threshold to a story-quality threshold around 85%.
- Make the Foundation page honest about what is missing: not just fields, but maturity signals like motivation, stakes, opposing force, serial engine, and style specificity.

## Non-Goals

- No free-form chatbot that can mutate canon directly.
- No BYOK/provider setting changes.
- No outline generation changes in this feature.
- No raw future-truth leakage into writer context packets.
- No attempt to solve all Story Bible granularity; this feature only matures the current foundation/canon primitives.

## Recommended Product Flow

1. Writer imports a draft, generates foundation proposals, or accepts foundation suggestions.
2. The Foundation page recomputes readiness.
3. If readiness is below 75%, the primary action remains proposal/intake completion.
4. If readiness is 75-84%, the primary action becomes `Matangkan Fondasi`.
5. Foundation Coach opens a focused refinement panel and asks one targeted question at a time.
6. After enough answers, the coach generates a Foundation Patch.
7. The patch appears as reviewable proposals grouped by foundation fields, characters, facts, style, and high-risk secrets.
8. Writer applies accepted proposals using the existing foundation proposal acceptance path.
9. Readiness recomputes. At 85% or higher, `Kunci Fondasi` becomes available.

## Readiness Model

The current readiness model is structural and often caps near 75 for non-relationship-heavy projects. The new model should split readiness into two bands:

### Core Completeness: 70 Points

- Selected concept.
- Premise.
- Main conflict.
- Reader promise.
- Protagonist.
- Minimum two safe canon facts.
- Target reader.
- Genre and tone.
- High-risk secret safety.

### Foundation Maturity: 30 Points

- Protagonist motivation or wound is specific.
- Opposing force is clear.
- Stakes and consequence are explicit.
- Reader promise has serial momentum, not just a generic genre promise.
- Style and mobile format are specific enough to guide generation.
- Secret/reveal material is identified as planner-only proposal, not unsafe canon.

`canLock` should require:

- score >= 85,
- all core checks passing,
- no unresolved high-risk direct-canon issue,
- no locked-foundation conflict.

The UI labels should be:

- 0-44: `Belum siap`
- 45-74: `Perlu dilengkapi`
- 75-84: `Siap dimatangkan`
- 85-94: `Siap dikunci`
- 95-100: `Sangat siap`

The existing enum can remain as storage compatibility, but UI copy and `canLock` should follow the richer score.

## Coach Behavior

The coach should be a focused agent, not an open-ended companion. It receives:

- project title and selected concept,
- current foundation fields,
- accepted characters and facts,
- current proposal queue summary,
- import-derived signals and author voice if available,
- readiness check failures and weak maturity checks.

It asks at most five questions per session. Each question must target one weakness and should be easy to answer. Examples:

- "Apa luka atau rasa bersalah yang paling menentukan keputusan tokoh utama?"
- "Kalau tokoh utama gagal, kerugian emosional apa yang paling terasa?"
- "Siapa atau apa yang terus menekan tokoh utama dari luar?"
- "Janji apa yang membuat pembaca ingin lanjut bab berikutnya?"
- "Rahasia apa yang perlu disimpan, tapi tidak boleh dibocorkan terlalu cepat?"

The coach should avoid re-asking details already present in foundation/canon. If enough information already exists, it can generate the patch immediately.

## Foundation Patch Output

The coach output should be a structured JSON patch with these sections:

- `foundation`: proposed premise, main conflict, reader promise, tone, target reader, style tags, and optional story secrets preview.
- `characters`: proposed character additions or description upgrades.
- `facts`: safe canon facts only, such as motivation, relationship, event, location, or promise.
- `style`: author voice and mobile-serial guidance.
- `secrets`: high-risk or planner-only material, always kept as proposals and never directly promoted to facts.
- `maturityEvaluation`: check statuses and reasons.

Patch materialization should create `ai_proposals` with a marker such as `generator: "foundation_coach_patch"` and a `sessionId`. The existing foundation proposal acceptance endpoint should apply safe proposals. High-risk `secret`, `reveal`, and high-risk fact proposals should remain blocked from direct accept unless a future reveal-gate workflow handles them explicitly.

## Data Model

Recommended additive tables:

### `foundation_refinement_sessions`

- `id`
- `project_id`
- `owner_id`
- `status`: `active`, `patch_ready`, `completed`, `abandoned`, `failed`
- `before_readiness_score`
- `target_readiness_score` default 85
- `final_readiness_score`
- `metadata`
- `created_at`
- `updated_at`

### `foundation_refinement_messages`

- `id`
- `session_id`
- `project_id`
- `role`: `user`, `agent`, `system`
- `content`
- `metadata`
- `created_at`

These tables keep the Foundation Coach conversation distinct from intake chat. Intake remains for collecting raw story ideas; Foundation Coach is for post-seed refinement.

## API Design

Suggested endpoints:

- `POST /api/projects/:id/foundation/refinement/start`
  - Creates or resumes the active refinement session.
  - Returns readiness, current weakness list, and the first coach message.

- `GET /api/projects/:id/foundation/refinement`
  - Returns active/latest session, messages, and patch status.

- `POST /api/projects/:id/foundation/refinement/messages`
  - Adds a user answer and returns the next coach message or patch-ready state.

- `POST /api/projects/:id/foundation/refinement/patch`
  - Generates a structured Foundation Patch and materializes review proposals.

- `POST /api/projects/:id/foundation/refinement/complete`
  - Marks session complete after enough proposals are accepted or the writer exits.

Use the existing model router and credit ledger. MVP can reuse `GENERATION_TYPES.foundation_proposal` with metadata `task: "foundation_coach"` to avoid a migration solely for billing. A later analytics sprint can add `foundation_coach` as a first-class generation type.

## Frontend Design

On the Foundation page:

- The readiness card shows richer status copy and missing maturity items.
- At 75-84%, the primary CTA is `Matangkan Fondasi`.
- `Kunci Fondasi` is disabled below 85 with clear text: "Matangkan fondasi dulu agar outline tidak lemah."
- The coach appears as an inline panel or drawer below the readiness card, not a separate route.
- Questions are shown one at a time, with a text area and compact suggested answer chips where helpful.
- The patch preview appears above the proposal list with actions:
  - `Terapkan Usulan Aman`
  - individual `Terima Usulan`
  - high-risk items marked as planner-only / needs reveal review.

The page must not show generic feature instructions. Copy should be direct and workflow-oriented.

## Error Handling

- If AI generation is disabled, show a deterministic refinement checklist and allow manual foundation editing.
- If OpenRouter fails, keep the session and user answer, show retry copy, and refund credits if debit already happened.
- If AI returns invalid JSON, retry once with a repair prompt; if still invalid, fail the patch request without creating partial proposals.
- If a session already has a patch, `patch` endpoint should be idempotent unless `regenerate=true`.
- If foundation is locked, refinement start should return conflict unless a future unlock/edit workflow is explicitly supported.
- Never write raw prompts, provider tokens, or full imported prose into audit logs.

## Safety

- Coach output is not canon until accepted.
- High-risk secret/reveal items stay in proposal queue and are not directly promoted to `facts`.
- Patch proposals should include safe payload excerpts only.
- Writer Context Packet remains past-safe; coach planner material must not leak into prose generation unless accepted and allowed by Reveal Gate.
- The lock endpoint remains the final authority and recomputes readiness server-side.

## Testing

API contract tests:

- Imported/accepted foundation at 75% returns `canLock=false`.
- A matured foundation with coach patch accepted reaches >=85 and `canLock=true`.
- Coach patch materializes proposals, not direct facts or direct foundation mutation.
- High-risk secret/fact proposals cannot be promoted directly.
- Patch generation is idempotent for the same session.
- AI parse failure does not create partial proposals.

Web tests:

- Foundation at 75% shows `Matangkan Fondasi` as primary CTA and disables lock.
- Coach asks a targeted question based on missing maturity checks.
- User answer leads to patch preview.
- Applying safe patch proposals updates foundation cards and readiness.
- At >=85, lock CTA enables.

Production smoke:

- Existing import-derived project can move from 75 to >=85 by answering coach questions and accepting safe proposals.
- Health smoke remains unchanged for Duitku/OpenRouter.

## Rollout Plan

1. Add readiness maturity model and threshold changes behind code-level tests.
2. Add refinement session schema and API.
3. Add deterministic fallback coach checklist.
4. Add AI coach prompt and structured patch generation.
5. Wire Foundation page CTA/panel.
6. Add tests and production smoke.
7. Backfill existing 75% projects only by recalculating readiness; do not auto-create coach sessions.

## Decision

The MVP default is to make 85% the hard lock threshold. If production testing shows too much friction, a later beta setting can allow "lock with warning" for advanced users. MVP should keep the hard gate because weak foundations produce weak outlines, and that is more damaging than one extra refinement step.
