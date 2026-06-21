# 12 — Docs ↔ Code Truth Matrix (2026-06-16)

**Status:** Living SSOT for doc drift vs repository code.  
**Baseline audit:** [`00-audit-executive-summary.md`](00-audit-executive-summary.md) (2026-06-11, `NOT_READY_NEEDS_FIX`).  
**Gap/backlog (competitive):** [`docs/100-competitive-manuscript-teardown-and-gap-sprint-plan.md`](../100-competitive-manuscript-teardown-and-gap-sprint-plan.md) — cite full basename; never ambiguous `docs/100` alone.

**Prod migration lag:** Code in this repo ships through migration **`00019`**; hosted production may still be behind on `00014`–`00019` until the operator applies them. **Code shipped ≠ prod migrated** — confirm with `information_schema.tables` / Supabase migration history per environment before claiming prod feature availability.

---

## Legend

| Verdict | Meaning |
|---|---|
| **MATCH** | Doc claim aligns with code/migrations |
| **STALE_DOC** | Documentation under-reports shipped work |
| **STALE_CODE** | Documentation ahead of implementation |
| **PARTIAL** | Some surfaces shipped; backlog remains |

---

## Drift matrix (verified 2026-06-16)

| Area | Common doc claim | Code / migration actual | Verdict | Owner doc(s) |
|---|---|---|---|---|
| `facts.canon_status` 2-state | `docs/04` | `00001` enum `confirmed`/`deprecated` | **MATCH** | `docs/04` |
| `chapter_prose_versions.source` | `docs/12` | 3 values + `ai_generated` in prose flow | **MATCH** | `docs/12` |
| `character_states` / `character_knowledge` | `docs/08`, `docs/12` “belum ada” | `00016` + `character-knowledge.ts` + `povKnowledge` in packet | **STALE_DOC** → fixed Fase A | `docs/08`, `docs/12`, `docs/07` |
| `timeline_events` / `mini_arcs` | `docs/12` planned | `00015` + `timeline.ts` + outline UI | **STALE_DOC** → fixed Fase A | `docs/12`, `docs/08` |
| `prose_embeddings` / `import_jobs` | `docs/12` planned | `00017` + `pipeline-runner.ts` | **STALE_DOC** → fixed Fase A | `docs/12` |
| `draft_imports` + import route | `audit/03` Missing; `docs/63` not started | `00013`/`00017`/`00018`, `/projects/:id/import-draft`, E2E | **STALE_DOC** → fixed Fase A | `audit/03`, `docs/63`, `docs/03` |
| Version history + diff UX | `docs/07` planned | `WriterVersionHistoryPanel`, E2E `sprint15-version-history-flow` | **STALE_DOC** | `docs/07`, `docs/03` |
| Creator Mode | `docs/63` not started | `00014` `creator_mode`, Settings + Outline advanced UI | **PARTIAL** | `docs/63`, [`docs/101-sprint-16-creator-mode-report.md`](../101-sprint-16-creator-mode-report.md) |
| Validators (8 kinds, `docs/09`) | Full MVP pipeline | `output-validator.ts`, `validation_reports` (`00012`), safe-repair | **PARTIAL** | `docs/09`, `audit/03` |
| Foundation/outline AI | Stub only | AI paths + stub fallback when AI off; `docs/97` | **MATCH** (with fallback) | `docs/96`–`97` |
| Beat / chapter summary gen | — | `beat_stub_deterministic`, `summary_stub_v1` still default when AI path absent | **STALE_CODE** / open | `docs/100-competitive`, `docs/112` |
| Production API hosting | README EC2-era banners | CF Worker `api.narraza.web.id` per competitive header | **STALE_DOC** (README banner) | `README.md` |
| Sprint 19 Story Bible + retention | Part F `[ ]` 19.x | No `writing_activity` table | **MATCH** (not shipped) | `docs/100-competitive` |
| Duplicate `docs/100-*` prefix | One `docs/NN` per role | Two files `100-competitive` + old `100-sprint-16` | **STALE_DOC** → **fixed**: closure → `docs/101-sprint-16-creator-mode-report.md` | process |

---

## Historical / do not use as live status

- [`docs/26-current-sprint-plan.md`](../26-current-sprint-plan.md) — vision only.
- [`00-audit-executive-summary.md`](00-audit-executive-summary.md) — Jun 11 snapshot; see § Superseded below.
- [`03-feature-gap-matrix.md`](03-feature-gap-matrix.md) — refreshed 2026-06-16 in Fase A.

---

## Canonical citation (avoid ambiguous `docs/100`)

| Topic | Canonical doc |
|---|---|
| Manuscript gap, Part F backlog | `docs/100-competitive-manuscript-teardown-and-gap-sprint-plan.md` |
| Creator Mode closure (`00014`) | `docs/101-sprint-16-creator-mode-report.md` |
| Draft import closure | `docs/99-sprint-15-draft-import-report.md` |
| Safety hardening closure | `docs/98-sprint-14-safety-hardening-report.md` |
| Real generation closure | `docs/97-sprint-13-real-generation-report.md` |
| Stabilization closure | `docs/96-sprint-12-stabilization-report.md` |

---

## Doc ID collisions (`docs/NN`)

| Prefix | Files | Resolution |
|---|---|---|
| `100` | `100-competitive-…` (living backlog) | Keep; add pointer to Sprint 16 closure at `101` |
| `101` | `101-sprint-16-creator-mode-report.md` | Renamed from `100-sprint-16-…` (2026-06-16 Fase A12) |

---

## How to re-audit (3 commands)

From repo root:

```bash
# 1) Migration inventory (newest first)
find supabase/migrations -name '*.sql' | sort

# 2) Table names in SQL (spot-check drift vs docs/12)
search CREATE TABLE --paths supabase/migrations

# 3) API contract tests (generation + continuity + import)
npm run test:generation-contracts -w @vibenovel/api
npm run test:sprint14-safety -w @vibenovel/api
npm run test:sprint16-character-continuity -w @vibenovel/api
npm run test:sprint17-timeline-miniarc -w @vibenovel/api
npm run test:sprint18-import-rag -w @vibenovel/api

# 4) Automated doc drift gate (Fase B)
npm run check:docs-drift
```

Optional doc hygiene after edits (expect **no** hits for stale character_states claim in `docs/08` / `docs/12`; expect **no** `100-sprint-16-creator-mode` in `README.md` or active closure links):

```bash
search "Belum ada tabel \`character_states\`" --paths docs/08-character-state-timeline-and-memory.md docs/12-database-schema-and-data-model.md
search "100-sprint-16-creator-mode" --paths docs README.md
```

---

## Product verdict (2026-06-16)

Repo is **far ahead** of `audit/00` (Jun 11). Remaining **public-beta partial** drivers: beat/summary stub on default paths, incomplete `docs/09` validator depth, possible **prod migration lag** for `00014`–`00019`. Primary risk today is **wrong prioritization from stale docs**, not an empty codebase.