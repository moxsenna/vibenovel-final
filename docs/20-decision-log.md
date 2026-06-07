# 20 — Decision Log

## D001 — Unified docs

Do not split MVP and Full into separate architecture documents. Use one unified blueprint and separate delivery phases in roadmap.

## D002 — Sprint 1 is frontend parity

Sprint 1 builds the frontend to match Stitch. No real backend, AI generation, credit deduction, validator, or database persistence.

## D003 — Use easy document names

Document names must be readable by humans and AI agents.

## D004 — Agent rules are active behavior rules

`.agents/rules` files are written as Always On style rules for Antigravity/Codex-like agents.

## D005 — Document navigation map required

Agents must use the navigation map to decide what to read for each task.

## D006 — High-risk sprint tasks must be split

Any sprint involving AI generation, database schema, credits, canonical state, reveal gate, context packet, validator, or chapter delta must be broken down into sub-tasks.

## D007 — Planner/Writer separation

Planner may know future direction. Writer must not receive raw future truth.

## D008 — AI output is not canon by default

AI-generated facts must be proposed, validated, accepted, then stored.
