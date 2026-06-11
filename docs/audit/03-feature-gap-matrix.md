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
| Outline 10 Bab | High | Partial/Implemented | Real generator from locked foundation; current `outline_stub_deterministic` | High | 10.31b | Generate 10 user-specific chapters, not Nadira/Arman/Siska template. |
| Reveal Schedule | Critical | Partial/Implemented | Stronger tests for forbidden-before rules and per-POV knowledge | High | Hardening | Future truth never enters writer prompt before allowed chapter. |
| Context Packet Builder | Critical | Implemented | Unit tests and output validation integration | High | Hardening | Packet is safe present only, auditable, no raw future outline. |
| Reveal Gate | Critical | Partial/Implemented | Output prose validation and repair loop | High | Hardening | Unsafe reveal detected before accepted prose is used. |
| Character Knowledge | Critical | Partial | Per-character "who knows what when" model | High | Hardening/Creator Mode | POV character cannot know facts not yet learned. |
| Beat Writer | High | Implemented | E2E blocked by auth and outline preconditions | High | Stabilization | Write room opens for locked outline and AI prose can be accepted. |
| Prose Versioning | High | Implemented | No delete endpoint; acceptable MVP | Low | Done/Later | Generated/user prose versions saved, current version tracked. |
| Validators | Critical | Partial | `validation_reports` table/pipeline, explicit validate step | High | Hardening | Each AI output has validation result before marked usable. |
| Safe Repair | High | Partial/Missing | Validator-triggered repair; current rewrite is user tool, not repair pipeline | High | Hardening | Failed validation triggers safe repair or regenerate. |
| Chapter Delta | Critical | Implemented | AI extraction quality eval | Medium | Done/Hardening | Accepted chapter produces reviewable delta/proposals. |
| Publish Package | High | Implemented | Chapter picker/regenerate UI polish | Low | Done/Later | Publish package generated from accepted chapter; user copies manually. |
| Credit Estimate | Medium | Implemented | Pre-action estimate on all relevant screens; runtime cost cap | Medium | Stabilization | Settings/write/publish show numeric credit cost. |
| Credit Ledger | High | Implemented | Production payment atomic grant gated by `00010` | Medium | Payment readiness | Debit/refund/topup idempotent and auditable. |
| Model Router | High | Implemented | Runtime health/cost observability | Medium | Hardening | Client sends tier only; server chooses allowlisted model. |
| Draft Import | High for existing-draft persona | Missing | Route, API, extraction, conflict detection, continuation plan | High | Future product sprint | Paste/import draft produces signals, facts proposals, continuation plan. |
| Creator Mode | Medium/High | Partial/Missing | Story Bible, reveal schedule, open loop editors | Medium | Future product sprint | Advanced controls are opt-in, not default beginner UI. |

## Gap paling penting

1. Auth/session reliability is a blocker for all API/AI user flows.
2. Real foundation and outline generation are the next product gap after concept generation.
3. Draft Import is not implemented and should not be represented as available.
4. Validator/Safe Repair must become explicit before public AI usage.
5. Character Knowledge Gate needs deeper modeling than current reveal-level filtering.

## Acceptance baseline for next E2E rerun

- API mode has a valid Supabase session and same Supabase project between web and API.
- Concept generation returns 3 concepts.
- Foundation proposals appear and readiness increases above 0%.
- Outline generation creates 10 chapters from locked foundation.
- Write room opens only after outline lock, then allows AI prose acceptance.
- Settings quality mode persists after reload.
- Credit estimate is numeric, not stuck on `Memuat...`.
