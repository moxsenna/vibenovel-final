# 03 - Feature Gap Matrix

Status: Implemented, Partial, Planned-only, Missing, Implemented but unsafe.

| Feature | Product importance | Current status | Missing parts | Risk | Target sprint | Acceptance criteria |
|---|---|---|---|---|---|---|
| Chat Story Agent | High | Partial/Implemented | Auth stability; quality eval; production token flow | High | Stabilization | User can chat, agent replies, signals update, no 401. |
| 3 Concept Options | High | Partial/Implemented | Must consistently return 3 real concepts in API mode; no deterministic fallback in prod | High | Stabilization/10.31b | Click `Buat 3 Konsep Cerita` returns exactly 3 options tied to user idea. |
| Foundation Readiness | High | Implemented | Depends on proposal generation quality | Medium | 10.31b | Readiness moves from 0% after proposals and blocks lock until required items exist. |
| Lock Foundation | High | Implemented | Need E2E coverage after auth fix | Medium | Stabilization | Lock moves project to foundation locked safely. |
| AI Proposal Queue | Critical | Implemented | Better UI for review/reject/merge | Medium | Hardening | AI facts remain proposals until user approval. |
| Facts | Critical | Implemented | None obvious | Low | Done | Important facts stored as canon only after approval. |
| Relationship Speech Rules | Medium | Implemented | Advanced editing UX | Low | Later | Speech rules are stored and included safely in context packet. |
| Target Length | Medium | Partial | Full planner enforcement | Medium | Later | User choice affects outline/write output length. |
| Outline 10 Bab | High | Partial/Implemented | AI path + `outline_stub_deterministic` fallback when AI off | Medium | 13 | Generate 10 user-specific chapters from locked foundation; verify `docs/97`. |
| Reveal Schedule | Critical | Partial/Implemented | Stronger tests for forbidden-before rules and per-POV knowledge | High | Hardening | Future truth never enters writer prompt before allowed chapter. |
| Context Packet Builder | Critical | Implemented | Unit tests and output validation integration | High | Hardening | Packet is safe present only, auditable, no raw future outline. |
| Reveal Gate | Critical | Partial/Implemented | Output prose validation and repair loop | High | Hardening | Unsafe reveal detected before accepted prose is used. |
| Character Knowledge | Critical | Partial/Implemented | `character_knowledge` + `povKnowledge` in packet (Sprint 16); not full `docs/09` validator | High | Hardening | POV character cannot know facts not yet learned. |
| Beat Writer | High | Partial/Implemented | Beat generation may use `beat_stub_deterministic` when AI path absent; prose AI shipped | High | 112 / P1 | Write room opens; prefer real beat AI when AI on. |
| Prose Versioning | High | Implemented | No delete endpoint; acceptable MVP | Low | Done/Later | Generated/user prose versions saved, current version tracked. |
| Validators | Critical | Partial/Implemented | `output-validator.ts` + `validation_reports` (`00012`); not full 8-validator suite | High | Hardening | Each AI output has validation result before marked usable. |
| Safe Repair | High | Partial/Implemented | Safe-repair endpoint + validator loop (Sprint 14); not all `docs/09` triggers | High | Hardening | Failed validation triggers safe repair or regenerate. |
| Chapter Delta | Critical | Implemented | AI extraction quality eval | Medium | Done/Hardening | Accepted chapter produces reviewable delta/proposals. |
| Publish Package | High | Implemented | Chapter picker/regenerate UI polish | Low | Done/Later | Publish package generated from accepted chapter; user copies manually. |
| Credit Estimate | Medium | Implemented | Pre-action estimate on all relevant screens; runtime cost cap | Medium | Stabilization | Settings/write/publish show numeric credit cost. |
| Credit Ledger | High | Implemented | Production payment atomic grant gated by `00010` | Medium | Payment readiness | Debit/refund/topup idempotent and auditable. |
| Model Router | High | Implemented | Runtime health/cost observability | Medium | Hardening | Client sends tier only; server chooses allowlisted model. |
| Draft Import | High for existing-draft persona | Partial/Implemented | Route `/projects/:id/import-draft`, API, signals, RAG prep partial (`00013`–`00018`); not full Persona C polish | Medium | 15/18 | Paste/import draft produces signals, proposals, continuation path. |
| Creator Mode | Medium/High | Partial/Implemented | `creator_mode` setting + advanced outline UI (`00014`); not full Story Bible editors | Medium | 16 | Advanced controls opt-in; see `docs/101-sprint-16-creator-mode-report.md`. |

## Gap paling penting (updated 2026-06-16)

1. Beat/chapter-summary generation stubs on default paths when AI on — see `docs/112` / `docs/100-competitive`.
2. Full validator suite per `docs/09` — subset shipped in Sprint 14.
3. Production payment still gated on migration `00010` approval.
4. Character Knowledge **packet** shipped; deepen automated prose validators.
5. Prod migration lag possible for `00014`–`00019` — see `docs/audit/12`.

Drift SSOT: [`12-docs-code-truth-matrix-2026-06-16.md`](12-docs-code-truth-matrix-2026-06-16.md).

## Acceptance baseline for next E2E rerun

- API mode has a valid Supabase session and same Supabase project between web and API.
- Concept generation returns 3 concepts.
- Foundation proposals appear and readiness increases above 0%.
- Outline generation creates 10 chapters from locked foundation.
- Write room opens only after outline lock, then allows AI prose acceptance.
- Settings quality mode persists after reload.
- Credit estimate is numeric, not stuck on `Memuat...`.
