# VibeNovel Agent Rule — Read First

This repository is VibeNovel Core v2.

VibeNovel is an AI Serial Fiction Production OS, not a generic chatbot and not a one-click novel generator.

Before implementing anything:

- Identify the active sprint.
- Read the roadmap and checklist.
- Read the document navigation map.
- Read only the domain documents relevant to the task.
- Check `.agent-logs/<sprint>/` for an existing work log for the same task (see `09-agent-work-logs.md`).
- Do not invent architecture when the docs already define it.
- Do not build Full Version features during MVP sprint unless explicitly requested.
- Do not bypass Canonical Story State, Reveal Gate, Context Packet, Validator, or Chapter Delta rules.

After every non-trivial task:

- Create or update a work log at `.agent-logs/<sprint>/task-<number>-<slug>.md`.
- Follow `.agents/rules/09-agent-work-logs.md` and `.agent-logs/README.md`.

Core rule:

```txt
Planner may know the future.
Writer must not receive raw future outline, hidden truth, unrevealed twist, ending, or full reveal schedule.
```
