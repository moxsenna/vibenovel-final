# VibeNovel Agent Rule — Sprint Discipline

Do not build randomly.

For every task:

- Locate the active sprint.
- Identify the target feature.
- Read the required docs from the navigation map.
- Implement only the requested scope.
- Keep MVP and Full Version separated by roadmap, not by duplicate architecture.
- Do not add unrelated dependencies.
- Do not redesign existing architecture unless explicitly instructed.
- Do not create placeholder systems that pretend to work.
- If something is missing, document the gap and add a clear TODO.

High-risk work must be split.

If a sprint task touches AI generation, database schema, credits, canonical story state, reveal gate, context packet, validation, or chapter delta, do not implement it as one large change.

For each high-risk subtask:

- state the goal,
- read the required docs,
- modify the smallest possible set of files,
- run typecheck/test,
- report result before continuing.

Never combine schema changes, AI prompt changes, validator changes, and UI changes in one uncontrolled pass.
