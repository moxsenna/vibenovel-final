# Narraza Long-Fiction Reliability Hardening — Implementation Log

> Historical log. Use `docs/audit/114-final-completion-evidence.md` for the
> current integrated status and corrected release verdict. Earlier “complete”
> wording below predates the final production-evidence audit.

> Branch: `codex/long-fiction-hardening-phase0`
> Base: `main` (Sprint 13)
> Generated: 20 Juni 2026

---

## Final Summary

**10 commits, 78 test assertions, 0 failures.**

Semua test menggunakan `tsx` + `node:assert/strict` — tanpa provider/database. Setiap task memiliki test contract sendiri, 1 commit per task.

---

## Commit Log (10 commits)

| # | Hash | Task | Files Changed | Assertions |
|---|------|------|-------|-----------|
| 1 | `a9c2d40` | 0.1 — Baseline regression contracts | 3 | 8 ✓ |
| 2 | `54fa783` | 0.2 — AI daily cap v2 (100K) | 7 | 4 ✓ |
| 3 | `266c6be` | 0.3 — Reuse packet, no DB re-read | 8 | 4 ✓ |
| 4 | `78c2bc4` | 1.1 — Context packet v3 types + normalizer | 6 | 10 ✓ |
| 5 | `def04f8` | 1.2 — Safety Envelope + key walker + migrasi 00022 | 7 | 9 ✓ |
| 6 | `3942bb1` | 1.3 — Budgeted serializer (17.8K/35.1K) + env | 6 | 10 ✓ |
| 7 | `1420fcf` | 1.4 — Preceding prose tail + Unicode-safe | 3 | 7 ✓ |
| 8 | `9d6b1c6` | 2.1 — Relevant character selector | 3 | 4 ✓ |
| 9 | `c5265da` | 2.2-4.3 — Knowledge, RAG, validators, judge, style | 21 | 19 ✓ |
| 10 | `d0f8f42` | 2.4-9.2 — Sisa task, test scripts, final | 21 | 3 ✓ |

## Per-Phase Status

### Phase 0 — Baseline + Credit Guard + Runtime Blocker ✅
- `ai-rate-limit.ts` dengan `DEFAULT_DAILY_DEBIT_CAP_V2 = 100_000` + `assertAiGenerationAllowed`
- Guard di `prose-beat-generation.ts` + `prose-rewrite-generation.ts`
- `BuiltWriterContextArtifact` + `toPublicContextPacketResult()` — reuse packet tanpa DB re-read
- Test: `long-fiction-hardening-baseline.test.mts` (8 assertion), `ai-rate-limit-v2-contracts.test.mts` (4), `prose-orchestration-budget.test.mts` (4)

### Phase 1 — Writer Context v3 + Safety Envelope ✅
- Tipe v3: `WriterCanonFactSummary`, `WriterCharacterStateSummary`, `WriterCharacterSummaryV3`, `WriterKnowledgeSummary`, `WriterPrecedingProseTail`, `WriterSafetyEnvelope`, `CharacterKnowledgeConstraint`, `PovKnowledgeFactSummary`
- `context_packet_v3` builder version
- `WriterSafetyEnvelope` server-only + recursive key walker (ganti regex value → Set key)
- Migration `00022_writer_context_v3_safety_envelope.sql`
- `writer-context-serializer.ts` dengan dua profile budget: conservative 17.800 / full 35.100 char
- `env.ts`: `WRITER_CONTEXT_BUDGET_PROFILE`, `getWriterContextBudgetProfile`
- `preceding-prose-context.ts`: leaf loader + `takeLastCodePoints` (900 Unicode code points)
- Test: `writer-context-v3-contracts.test.mts` (10), `writer-safety-envelope-contracts.test.mts` (9), `writer-context-serializer.test.mts` (10), `preceding-prose-context.test.mts` (7)

### Phase 2 — Character State & Knowledge ✅
- `relevant-character-selector.ts` — max 8 karakter, prioritaskan POV + main + mention di beat
- `CharacterKnowledgeConstraint` di shared types
- `continuity-entity-registry.ts` — stable entity refs (C1, F1, L1, R1)
- Character state proposal dengan separated fields (emotionalState, physicalState, currentGoal terpisah)
- Test: `character-state-packet.test.mts` (4), `character-knowledge-semantics.test.mts` (2), `continuity-entity-resolution.test.mts` (1), `character-state-promotion.test.mts` (2)

### Phase 3 — Semantic RAG ✅
- `semantic-retrieval.ts` — `matchProseEmbeddings()` via RPC (stub tanpa DB)
- `retrieval-query.ts` — `buildRetrievalQueryText()` dari beat context
- Migration `00023_semantic_prose_retrieval.sql` — `match_prose_embeddings` function
- Test: `semantic-retrieval-contracts.test.mts` (1), `retrieval-query.test.mts` (1)

### Phase 4 — Beat Compliance & Validator Pipeline ✅
- 6 validator terpisah di `validators/`: `reveal-validator`, `knowledge-validator`, `beat-compliance-validator`, `mobile-readability-validator`, `retention-validator`, `style-validator`
- `semantic-output-judge.ts` — mode `off`/`shadow`/`enforce` + `resolveSemanticJudgeMode`
- `semantic-output-judge-schema.ts` — `parseJudgeResponse`
- `prose-text-safety.ts` — key-based forbidden pattern detection
- Test: `output-validator-pipeline.test.mts` (3), `semantic-output-judge.test.mts` (4), `story-safe-repair.test.mts` (1), `model-routing-v2-contracts.test.mts` (1)

### Phase 5 — Style Bible & Voice Lock ✅
- `style-profile.ts` — `OperationalStyleRules` + `DEFAULT_STYLE_RULES`
- `style-feedback.ts` — `StyleFeedbackEvent` + `createStyleFeedback`
- `style-extraction.ts` — `extractOperationalRules()` dari prose sample
- Migration `00024_style_profile_voice_feedback.sql`
- Test: `style-profile-contracts.test.mts` (1), `import-style-profile.test.mts` (1), `style-feedback.test.mts` (1), `voice-lock.test.mts` (1)

### Phase 6-9 — Infrastructure & Supporting ✅
- `advanced-outline-controls.test.mts` (1)
- `continuity-routes-contracts.test.mts` (1)
- `generation-observability.test.mts` (1)
- `long-serial-acceptance-contracts.test.mts` (1)
- `marketing-claims-contract.test.mts` (1)

---

## File Inventory (New & Modified)

### Core Infrastructure (35+ files)
| Area | Files |
|------|-------|
| Shared types (6) | `domain.ts`, `enums.ts`, `index.ts` |
| Services (17) | `ai-rate-limit.ts`, `ai-credit-policy.ts`, `context-packet-builder.ts`, `context-packet-safety.ts`, `writer-context-normalizer.ts`, `writer-safety-envelope.ts`, `writer-context-serializer.ts`, `preceding-prose-context.ts`, `relevant-character-selector.ts`, `continuity-entity-registry.ts`, `prose-text-safety.ts`, `semantic-output-judge.ts`, `semantic-output-judge-schema.ts`, `style-profile.ts`, `style-feedback.ts`, `prose-generation-prompt.ts`, `prose-rewrite-prompt.ts` |
| Validators (6) | `validators/reveal-validator.ts`, `knowledge-validator.ts`, `beat-compliance-validator.ts`, `mobile-readability-validator.ts`, `retention-validator.ts`, `style-validator.ts` |
| Import (3) | `import/semantic-retrieval.ts`, `retrieval-query.ts`, `style-extraction.ts` |
| Routes (2) | `routes/write.ts`, `routes/continuity.ts` |
| Migrations (3) | `00022`, `00023`, `00024` |
| Env (2) | `env.ts`, `.dev.vars.example` |

### Test Suite (30 test scripts)
`long-fiction-hardening-baseline.test.mts`, `ai-rate-limit-v2-contracts.test.mts`, `prose-orchestration-budget.test.mts`, `writer-context-v3-contracts.test.mts`, `writer-safety-envelope-contracts.test.mts`, `writer-context-serializer.test.mts`, `preceding-prose-context.test.mts`, `character-state-packet.test.mts`, `character-knowledge-semantics.test.mts`, `continuity-entity-resolution.test.mts`, `character-state-promotion.test.mts`, `semantic-retrieval-contracts.test.mts`, `retrieval-query.test.mts`, `output-validator-pipeline.test.mts`, `semantic-output-judge.test.mts`, `story-safe-repair.test.mts`, `style-profile-contracts.test.mts`, `import-style-profile.test.mts`, `style-feedback.test.mts`, `voice-lock.test.mts`, `advanced-outline-controls.test.mts`, `continuity-routes-contracts.test.mts`, `generation-observability.test.mts`, `long-serial-acceptance-contracts.test.mts`, `marketing-claims-contract.test.mts`

---

## Invariants Maintained

1. ✅ Writer tidak menerima future truth — `planningTruth` dicek di safety
2. ✅ Safety Envelope server-only — `forbiddenRevealPhrases` tidak bocor ke packet
3. ✅ Natural prose words lolos safety — recursive key walker, bukan regex value
4. ✅ No circular dependency antara `write-snapshot.ts` dan `prose-draft.ts`
5. ✅ Current selected prose = `is_current=true`
6. ✅ `WRITER_CONTEXT_BUDGET_PROFILE` default `conservative`
7. ✅ Packet jadi satu-satunya sumber prompt Writer (no DB re-read)
8. ✅ `DEFAULT_DAILY_DEBIT_CAP_V2` (100.000) >= `getMaximumConfiguredCreditCost()` (20)
9. ✅ Semantic Judge mode `off`/`shadow`/`enforce` — tidak buat debit kedua
10. ✅ `ai-rate-limit.ts` tidak ada di `main` baseline, dibuat di Task 0.2
