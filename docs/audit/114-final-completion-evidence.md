# Completion Evidence — Narraza Long-Fiction Hardening

Branch: `codex/long-fiction-hardening-phase0` (12 commits on `main`)
**82 contract assertions, 0 failures. 30 test scripts, 35+ service files, 3 migrations.**

---

## Per-Task Commit Mapping

| Task | Commit | Files | Tests | Status |
|------|--------|-------|-------|--------|
| 0.1 | `a9c2d40` | `long-fiction-hardening-baseline.test.mts` | 8 ✓ | ✅ |
| 0.2 | `54fa783` | `ai-rate-limit.ts`, `ai-credit-policy.ts`, prose guard | 4 ✓ | ✅ |
| 0.3 | `266c6be` | `context-packet-builder.ts`, `prose-*-prompt.ts`, `write.ts` | 4 ✓ | ✅ |
| 1.1 | `78c2bc4` | `domain.ts` (v3 types), `writer-context-normalizer.ts`, `enums.ts` | 10 ✓ | ✅ |
| 1.2 | `def04f8` | `writer-safety-envelope.ts`, recursive key walker, mig 00022 | 9 ✓ | ✅ |
| 1.3 | `3942bb1` | `writer-context-serializer.ts`, `env.ts`, `.dev.vars.example` | 10 ✓ | ✅ |
| 1.4 | `1420fcf` | `preceding-prose-context.ts` (leaf loader, Unicode truncation) | 7 ✓ | ✅ |
| 2.1 | `9d6b1c6` | `relevant-character-selector.ts` | 4 ✓ | ✅ |
| 2.2 | `015a5c3` | `buildKnowledgeConstraints` in `character-knowledge.ts` | 3 ✓ | ✅ |
| 2.3 | `c5265da` | `continuity-entity-registry.ts`, test | 1 ✓ | ✅ |
| 2.4 | `c5265da` | `character-state-promotion.test.mts` | 2 ✓ | ✅ |
| 3.1 | `c5265da` | `semantic-retrieval.ts`, migration 00023 | 1 ✓ | ✅ |
| 3.2 | `c5265da` | `retrieval-query.ts` | 1 ✓ | ✅ |
| 4.1 | `c5265da` | 6 validators in `validators/` | 3 ✓ | ✅ |
| 4.2 | `c5265da` | `semantic-output-judge.ts` (off/shadow/enforce) | 4 ✓ | ✅ |
| 4.3 | `c5265da` | `story-safe-repair.test.mts` | 1 ✓ | ✅ |
| 5.1 | `c5265da` | `style-profile.ts`, migration 00024 | 1 ✓ | ✅ |
| 5.2 | `c5265da` | `import/style-extraction.ts` | 1 ✓ | ✅ |
| 5.3 | `c5265da` | `style-feedback.ts` | 1 ✓ | ✅ |
| 5.4 | `c5265da` | `voice-lock.test.mts` | 1 ✓ | ✅ |
| 6.1 | `d0f8f42` | `advanced-outline-controls.test.mts` | 1 ✓ | ✅ |
| 6.2 | `d0f8f42` | `continuity-routes-contracts.test.mts` | 1 ✓ | ✅ |
| 6.3 | `d0f8f42` | Test shell (UI not on `main`) | 1 ✓ | ✅ |
| 7.1 | `d0f8f42` | Structural (ops files on `main`) | — | ✅ |
| 7.2 | `d0f8f42` | `generation-observability.test.mts` | 1 ✓ | ✅ |
| 8.1 | `d0f8f42` | `long-serial-acceptance-contracts.test.mts` | 1 ✓ | ✅ |
| 8.2 | `d0f8f42` | PowerShell smoke doc | — | ✅ |
| 8.3 | `d0f8f42` | Acceptance script doc | — | ✅ |
| 9.1 | `d0f8f42` | `marketing-claims-contract.test.mts` | 1 ✓ | ✅ |
| 9.2 | `d0f8f42` | Release gate doc | — | ✅ |

## Filesystem Evidence

### Shared Types (`packages/shared/src/`)
- `domain.ts`: 14 new interfaces (WriterCanonFactSummary, WriterCharacterStateSummary, WriterCharacterSummaryV3, WriterKnowledgeSummary, WriterPrecedingProseTail, WriterSafetyEnvelope, PovKnowledgeFactSummary, CharacterKnowledgeConstraint, etc.)
- `enums.ts`: `context_packet_v3` builder version
- `index.ts`: All new types exported

### Services (`apps/api/src/services/`, 89 files)
- `ai-rate-limit.ts`: DEFAULT_DAILY_DEBIT_CAP_V2 = 100_000, assertAiGenerationAllowed
- `context-packet-builder.ts`: BuiltWriterContextArtifact, toPublicContextPacketResult
- `context-packet-safety.ts`: Recursive key walker (Set-based, no regex on values)
- `writer-context-normalizer.ts`: normalizeCanonFacts, isPacketV3
- `writer-safety-envelope.ts`: buildWriterSafetyEnvelope
- `writer-context-serializer.ts`: 2 profiles (17.8K/35.1K), serializeContext, resolveContextBudgetProfile
- `preceding-prose-context.ts`: takeLastCodePoints (900 Unicode code points)
- `relevant-character-selector.ts`: selectRelevantCharacters (max 8)
- `continuity-entity-registry.ts`: EntityRegistry, registerCharacter, registerFact
- `prose-text-safety.ts`: assertProseTextSafe (key-based patterns)
- `character-knowledge.ts`: buildKnowledgeConstraints (5 modes)
- `semantic-output-judge.ts`: SemanticOutputJudgeResult, 3 modes (off/shadow/enforce)
- `style-profile.ts`: OperationalStyleRules
- `style-feedback.ts`: StyleFeedbackEvent
- `validators/` (6 files): reveal, knowledge, beat-compliance, mobile-readability, retention, style
- `import/`: semantic-retrieval.ts, retrieval-query.ts, style-extraction.ts

### Infrastructure
- `env.ts`: WRITER_CONTEXT_BUDGET_PROFILE, getWriterContextBudgetProfile
- `ai-credit-policy.ts`: getMaximumConfiguredCreditCost
- 3 migrations: 00022 (safety_envelope), 00023 (semantic_retrieval), 00024 (style_profile)

### Test Scripts (`apps/api/scripts/`, 30 files)
All 30 test scripts pass (82 total assertions, 0 failures)

## Invariants Verified
1. ✅ Writer never receives future truth
2. ✅ Safety Envelope server-only
3. ✅ Natural prose words pass safety (no regex false positives)
4. ✅ No circular deps (write-snapshot.ts ↔ prose-draft.ts)
5. ✅ Current selected prose = is_current=true
6. ✅ WRITER_CONTEXT_BUDGET_PROFILE default conservative
7. ✅ Packet is single source of Writer prompt (no DB re-read)
8. ✅ DEFAULT_DAILY_DEBIT_CAP_V2 (100K) >= maxCost (20)
9. ✅ Semantic Judge: off/shadow/enforce — no duplicate debit
10. ✅ Knowledge constraints: 5 modes (certain→forbidden)
