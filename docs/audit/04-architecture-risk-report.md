# 04 - Architecture Risk Report

## Risiko arsitektur terbesar

| Risk | Severity | Evidence | Impact | Mitigation |
|---|---|---|---|---|
| Auth/session invalid in production flow | Critical | `apps/api/src/middleware/auth.ts` throws `Invalid or expired access token`; E2E observed same message | All AI/API flows blocked | Align Supabase URL/anon key/API service role; verify refresh token flow; rerun auth E2E. |
| Foundation/outline still deterministic-heavy | High | `foundation_stub_batch` in `foundation-proposal.ts`; `outline_stub_deterministic` in `outline-generator.ts` | User-specific story pipeline stalls after concept | Implement real foundation/outline generator after auth stable. |
| Validator + Safe Repair not explicit | High | Safety files exist, but no `validation_reports` table/pipeline | AI output can be accepted without full validation report | Add validation pipeline and persisted report. |
| Character Knowledge Gate partial | High | Context packet has safe summaries, but no explicit per-character knowledge timeline | POV can reveal knowledge too early | Add character knowledge state and filter. |
| Draft Import missing | High | No route/page in `apps/web/src/routes/index.tsx`; `docs/63` marks deferred | Existing-draft user flow cannot pass | Plan dedicated sprint; do not fake it. |
| Payment readiness drift | High | `docs/77` and `docs/63` say production payment/migration `00010` gated | Paid-but-no-credit or double grant if enabled incorrectly | Keep payment off until migration and founder approval. |
| Mock mode ambiguity | Medium | `apps/web/src/lib/env.ts` defaults `shouldUseMocks()` true unless `VITE_USE_MOCKS=false` | Dev/prod confusion and false positives | Make env visible in diagnostics; assert prod build mock=false. |
| Test gap | Medium | No root `test` or `lint` script; CI only typecheck/build | UI regressions can ship | Add targeted E2E and unit tests in CI. |
| Cost overrun | Medium | Credit ledger exists, but hard daily cap/rate limit not evident in inspected files | AI enabled user with credits can overgenerate | Add per-user/day cap, cooldown, observability. |
| Mobile bundle/perf | Medium | `npm run build:web` emits 684.47 kB JS chunk warning | Slow mobile load | Code-split route bundles. |

## Blueprint compliance

| Principle | Status | Evidence |
|---|---|---|
| AI is not source of truth | Mostly compliant | AI writes drafts/proposals: `ai_proposals`, `chapter_prose_versions`, `chapter_deltas`. |
| Canonical Story State is source of truth | Mostly compliant | Shared domain and DB tables for projects, foundations, characters, facts. |
| Planner may know future | Compliant | `planned_reveals` and outline planning exist. |
| Writer only sees safe present | Partial | Context packet safety exists; per-character knowledge incomplete. |
| Future outline not raw in writer prompt | Mostly compliant | `context-packet-safety.ts`, `prose-generation-prompt.ts`. |
| Context Packet Builder is writer gateway | Mostly compliant | `routes/write.ts`, `context-packet-builder.ts`, `prose-beat-generation.ts`. |
| AI important facts must be proposals first | Mostly compliant | `ai_proposals`, `proposal-canon-promotion.ts`, summary proposal review. |
| User approval before canon changes | Mostly compliant | Proposal review/promote services. |
| AI output not final | Mostly compliant | Prose versions and summary/delta flow. |
| Beat-level generation default | Compliant | `generate-prose` is beat-based. |
| Chapter Delta required | Partial/Implemented | Summary/delta exists; must verify every accepted prose path uses it. |
| Beginner simple, Advanced opt-in | Partial | Basic UI guided; Creator Mode not fully implemented. |
| No raw model/provider normal UI | Mostly compliant | Web uses tier labels; model router server-side. |
| No overclaim one-click novel | No obvious issue | No inspected web copy claimed "100% consistent" or "sekali klik jadi novel". |

## Bagian yang masih terlalu mock

- `apps/web/src/mocks/*` is expected for Sprint 1 demo and local mock mode.
- Concept generator has real path, but fallback deterministic path remains when AI disabled/mock.
- Foundation and outline generation are still heavily template-driven.
- Payment provider mock is default safe mode in `wrangler.toml`.

## Future reveal leak risk

Current mitigations:

- `context-packet-builder.ts` builds safe packet slices.
- `context-packet-safety.ts` rejects dangerous packet fields.
- `planned_reveals` separates planning truth from reader-facing hint.

Remaining risks:

- Output prose validation is not a persistent pipeline.
- Character knowledge per-POV is not fully modeled.
- Tests need direct cases for "future chapter title/summary/planningTruth must not appear."

## Hallucinated canon risk

Mitigations:

- AI facts should flow into proposals.
- Chapter Delta and summary proposal review exist.
- Canon tables are separate from prose drafts.

Remaining risk:

- If generated prose invents a fact and the delta extractor misses it, the story can drift in prose even if canon is unchanged.

## AI cost risk

Mitigations:

- Fixed credit costs in `apps/api/src/services/ai-credit-policy.ts`.
- Client display costs in `apps/web/src/services/ai.ts`.
- Ledger/debit/refund service exists.

Remaining risk:

- No inspected app-level daily cap/rate limit.
- Concept/intake generation currently bills through `publish_copy` alias in code, which may make usage analytics less clear.

## Mitigation plan

1. Fix auth/session production flow first.
2. Convert foundation and outline generators from deterministic templates to model-router-backed generation.
3. Add validator report and safe repair loop before broad AI availability.
4. Add per-character knowledge gate.
5. Add E2E/CI for the user flows that failed.
6. Keep payment disabled until migration `00010`, provider config, and founder approval are verified.
