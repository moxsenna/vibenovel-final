# VibeNovel Agent Rule — Agent Work Logs

Every non-trivial coding or implementation task must leave a **durable work log** that the next human or agent can read without guessing.

This rule complements `02-sprint-discipline.md` and `08-testing-and-change-report.md`. It does not replace sprint verification reports in `docs/`.

---

## When a log is required

Create or update a work log when the task:

- changes application source code,
- adds or changes database migrations,
- adds API routes or shared packages,
- integrates frontend with backend,
- produces a sprint task deliverable that affects how future work is done.

Skip only for truly trivial edits (single-line typo, comment-only) where no handoff risk exists.

---

## Log location

```txt
.agent-logs/<sprint>/task-<number>-<slug>.md
```

Examples:

```txt
.agent-logs/sprint-2/task-2.1-shared-package-foundation.md
.agent-logs/sprint-2/task-2.0b-agent-work-logs-rule.md
```

Rules:

- `<sprint>` — e.g. `sprint-1`, `sprint-2`, aligned with active sprint plan.
- `<number>` — official task id (e.g. `2.1`, `2.0b`).
- `<slug>` — short kebab-case descriptor.
- One task → one file. Resume work by **appending** to the same file, not creating duplicates.

Folder README: `.agent-logs/README.md`

---

## Required log sections

Every log must include all of the following:

| Section | Content |
|---|---|
| **Task goal** | What this task was supposed to achieve |
| **Files read** | Docs, rules, and source files actually opened for context |
| **Files created/changed** | Paths only; brief note per file if helpful |
| **Commands run** | Every verification command attempted |
| **Results** | Factual outcomes (PASS/FAIL/skipped, key errors) |
| **Decisions** | Non-obvious choices and why |
| **Limitations** | What was intentionally not done, gaps, deferred scope |
| **Next recommended task** | Single clear follow-up per sprint plan |

Use the template in `.agent-logs/README.md`.

---

## Command honesty

- If a command was **not** run, write explicitly: `tidak dijalankan` or `not run` with reason.
- Do **not** claim PASS/FAIL for commands you did not execute.
- Do **not** invent file lists or test results.

---

## Secrets and sensitive data — forbidden

Never write into logs:

- API keys, tokens, passwords
- `.env` values or partial secrets
- Supabase service role keys, JWTs, session cookies
- OpenRouter or other provider credentials
- Personal data beyond what is already public in the repo

Refer to env **by variable name only** (e.g. `SUPABASE_URL` configured) without values.

---

## Factual accuracy

Logs must record **what actually happened** in the session:

- files truly read or edited,
- commands truly run,
- verification truly performed or skipped.

False completion claims break canon safety and sprint discipline.

---

## Relationship to other artifacts

| Artifact | Purpose |
|---|---|
| `.agent-logs/...` | Per-task handoff, session truth |
| `docs/22`, `docs/28`, … | Sprint closure / verification reports |
| `08-testing-and-change-report.md` | End-of-task change summary for coding tasks |
| `docs/20-decision-log.md` | Product/architecture decisions worth permanent record |

Product docs stay in `docs/`. Work logs stay in `.agent-logs/`.

---

## Agent workflow (minimum)

Before starting a non-trivial task:

1. Read `00-read-first.md` and navigation map.
2. Check `.agent-logs/<sprint>/` for an existing log for the same task number.

After completing (or blocking on) the task:

1. Create or update the task log with all required sections.
2. Report summary to the user (can mirror log sections briefly).

---

## Numbering note

This file is `09-agent-work-logs.md` because `08-testing-and-change-report.md` already exists. Both rules apply together.