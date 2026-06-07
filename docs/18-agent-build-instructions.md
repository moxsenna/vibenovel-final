# 18 — Agent Build Instructions

## Mandatory start procedure

Before coding:

1. Identify current sprint.
2. Read `.agents/rules/00-read-first.md`.
3. Read `.agents/rules/01-document-navigation-map.md`.
4. Read sprint plan.
5. Read implementation checklist.
6. Read domain docs required by the task.

## Implementation discipline

- Do not build random features.
- Do not skip sprint boundary.
- Do not invent architecture when docs define it.
- Do not create fake production logic.
- Use typed mocks during Sprint 1.
- Mark integration points clearly.

## Change size

If task touches AI generation, schema, credit, reveal gate, context packet, validators, or chapter delta, split work into smaller tasks.

## Report format

At the end of work, report:

- files changed,
- what was implemented,
- what was not implemented,
- tests/typecheck/lint result,
- manual verification,
- known limitations,
- next recommended step.
