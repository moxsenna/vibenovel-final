# Asisten Narra / Unified Story Agent Design

Date: 2026-06-16
Status: Proposed design, revised after product brainstorming
Owner: Narraza product sprint

## Decision Summary

Narraza should not add a separate "Foundation Coach" product surface. The writer should experience one continuous assistant: **Asisten Narra**.

Internally, the first version can keep using `intake_sessions` and `intake_messages` as the continuity anchor. The product layer should rename the experience from "Mulai Proyek" to "Asisten Narra", then make the same chat phase-aware:

- During early project creation, Narra behaves as intake assistant.
- After concept/foundation exist, Narra behaves as foundation refinement assistant.
- Later phases can reuse the same agent surface for outline review, continuity review, and publishing help without fragmenting the writer's mental model.

The key rule stays the same: Narra may suggest and materialize proposals, but must not silently mutate canon.

## Problem

The current flow can reach around 75% readiness after import-derived foundation proposals are accepted. That means the project has enough structural pieces, but not necessarily a mature story bible. If Narraza lets the writer lock at this point, weak motivation, generic stakes, vague reader promise, or thin character pressure can flow into outline generation.

The earlier "Foundation Coach" idea solves the quality gap, but it risks feeling like yet another separate feature. The writer already started a conversation with the intake agent. When they reach Foundation, the better experience is to continue that same conversation with the assistant now aware of the current foundation.

## Product Language

- Sidebar label: `Asisten Narra`
- Persona name in chat: `Narra`
- Foundation CTA: `Matangkan dengan Narra`
- Proposal section label: `Usulan Narra`
- Old user-facing label to remove from active project nav: `Mulai Proyek`

`Proyek Baru` remains the creation button. It is not the same concept as the story assistant.

## Overall Narraza Flow Adjustment

Recommended main navigation for an active project:

1. `Beranda`
2. `Asisten Narra`
3. `Fondasi Cerita`
4. `Outline`
5. `Ruang Tulis`
6. `Paket Publish`

`Asisten Narra` is not just "start project". It is the writer's persistent story agent. The route can remain `/projects/:id/intake` for compatibility in MVP, but the UI copy should no longer call it intake except in internal code.

Recommended project lifecycle:

1. Writer creates a project from `/start`.
2. Writer opens `Asisten Narra` and gives idea, premise, draft signals, or story direction.
3. Narra extracts signals and helps produce/select concepts.
4. Draft import can seed concept and foundation proposals.
5. Writer accepts safe proposals into draft foundation.
6. If foundation readiness is below 75, the main action remains "complete missing foundation pieces".
7. If readiness is 75-84, the main action becomes `Matangkan dengan Narra`.
8. The same Narra chat continues with foundation context and asks targeted questions.
9. Narra materializes a Foundation Patch into reviewable `ai_proposals`.
10. Writer accepts safe proposals.
11. At readiness >= 85, `Kunci Fondasi` becomes available.
12. Outline, write room, summary, and publish continue to rely on locked foundation and proposal-first canon flow.

## Phase-Aware Assistant

Use one session history with phase metadata:

- `idea_collection`
- `signal_detection`
- `concept_generation`
- `foundation_preparation`
- `foundation_refinement`

The new phase `foundation_refinement` means Narra must include these context inputs:

- current selected concept,
- current foundation fields,
- accepted characters and facts,
- active foundation proposals,
- latest readiness checks,
- draft import signals if available,
- recent chat history.

The assistant should avoid re-asking details already present. It should ask one focused question at a time. Once enough information exists, it should offer to create `Usulan Narra`.

## Readiness Model

Treat 75% as "ready to refine", not "ready to lock".

Core completeness is worth 70 points:

- selected concept,
- premise,
- main conflict,
- reader promise,
- protagonist,
- at least two safe canon facts,
- target reader,
- genre and tone,
- high-risk secret safety.

Maturity is worth 30 points:

- protagonist motivation or wound is specific,
- opposing force is clear,
- stakes and consequence are explicit,
- reader promise has serial momentum,
- style and mobile format are specific enough,
- high-risk secrets remain planner/proposal-only.

`canLock` should require:

- score >= 85,
- all core checks passing,
- no unresolved high-risk direct-canon issue,
- foundation is not already locked.

UI labels:

- 0-44: `Belum siap`
- 45-74: `Perlu dilengkapi`
- 75-84: `Siap dimatangkan`
- 85-94: `Siap dikunci`
- 95-100: `Sangat siap`

## Narra Foundation Patch

Narra's refinement output is a structured patch. The patch creates proposals only.

Patch sections:

- `foundation`: premise, main conflict, reader promise, genre, tone, target reader, style tags, optional safe story secrets preview.
- `characters`: protagonist/supporting character upgrades.
- `facts`: safe canon facts only.
- `style`: author voice and mobile serial guidance.
- `secrets`: high-risk or planner-only material; never direct fact promotion.
- `maturityEvaluation`: check statuses and reasons.

Patch proposals should use payload metadata:

- `generator: "asisten_narra_foundation_patch"`
- `sessionId`
- `phase: "foundation_refinement"`
- `readinessBefore`
- `targetReadiness: 85`

Existing foundation proposal acceptance remains the promotion path.

## API Shape

Keep chat continuity by extending the existing intake API rather than creating separate foundation chat tables.

Recommended MVP endpoints:

- `GET /api/projects/:id/intake`
  - Returns session, messages, detected signals, and a small `agentContext` summary.

- `POST /api/projects/:id/intake/messages`
  - Accepts `content`.
  - Also accepts optional `phase: "foundation_refinement"` and `entrypoint: "foundation"`.
  - Updates the active session phase and sends Narra a phase-aware prompt.

- `POST /api/projects/:id/foundation/proposals/generate-from-narra`
  - Reads the same active intake session history.
  - Reads foundation/readiness context.
  - Creates reviewable `ai_proposals` marked as `asisten_narra_foundation_patch`.

Rejected API shape:

- Do not create `foundation_refinement_sessions` and `foundation_refinement_messages` for MVP. That fragments the conversation and conflicts with the product decision.

## Frontend Shape

Sidebar:

- Change active-project nav label from `Mulai Proyek` to `Asisten Narra`.
- Route active projects to `/projects/:id/intake`.
- Keep `/start` for creating new projects.

Asisten Narra page:

- Page title: `Asisten Narra`.
- Intro copy changes by phase.
- Foundation entry mode shows foundation readiness context and a CTA to create `Usulan Narra`.
- The chat panel remains the same component family, but it must not say "intake" in user-facing copy.

Foundation page:

- At 75-84 readiness, show `Matangkan dengan Narra`.
- The CTA navigates to Asisten Narra with `?mode=foundation` or opens the same page state in the chat route.
- Proposal list shows Narra-generated patches alongside import/foundation generator proposals.
- Lock stays disabled until 85.

## Safety

- Narra output is not canon until accepted.
- High-risk secret/reveal items stay as proposals.
- No raw imported prose, provider tokens, full prompts, or raw model payloads should enter audit logs.
- Writer Context Packet remains past-safe. Planner-only secrets must not leak into prose generation unless accepted and allowed by reveal controls.
- Server-side lock remains final authority.

## Rollout

1. Normalize naming and session phase model.
2. Add readiness maturity threshold and labels.
3. Extend Narra chat prompt with phase-aware context.
4. Add Narra foundation patch materialization.
5. Wire Foundation CTA into the same chat.
6. Add contract and web smoke coverage.
7. Deploy API and web.

## Product Answer

Yes, Narraza should adjust its overall structure. "Mulai Proyek" is a one-time action; `Asisten Narra` is a persistent companion for the writer. The product will feel clearer if Narra is the one assistant that starts the project, matures the foundation, helps inspect outline quality, and eventually supports writing continuity.
