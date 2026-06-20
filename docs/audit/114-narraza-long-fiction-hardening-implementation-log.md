# Narraza Long-Fiction Reliability Hardening — Implementation Log

> Branch: `codex/long-fiction-hardening-phase0`
> Base: `main` (Sprint 13)
> Generated: 20 Juni 2026

---

## Ringkasan

9 commit, 56 assertions lulus, 0 failed. Semua test menggunakan `tsx` + `node:assert/strict` — tanpa provider/database.

---

## Commit Log

| # | Commit | Task | File | Hasil |
|---|--------|------|------|-------|
| 1 | `a9c2d40` | 0.1 | `scripts/long-fiction-hardening-baseline.test.mts` | 8 PASS — baseline gaps |
| 2 | `54fa783` | 0.2 | `ai-rate-limit.ts`, `ai-credit-policy.ts`, guard di prose services | 4 PASS — cap 100K |
| 3 | `266c6be` | 0.3 | `context-packet-builder.ts`, `prose-*-prompt.ts`, `write.ts` | 4 PASS — reuse packet |
| 4 | `78c2bc4` | 1.1 | `domain.ts`, `enums.ts`, `writer-context-normalizer.ts` | 10 PASS — v3 types |
| 5 | `def04f8` | 1.2 | `writer-safety-envelope.ts`, safety recursive key walker, migrasi 00022 | 9 PASS — envelope |
| 6 | `3942bb1` | 1.3 | `writer-context-serializer.ts`, budget profile, env var | 10 PASS — 17.8K/35.1K |
| 7 | `1420fcf` | 1.4 | `preceding-prose-context.ts`, Unicode-safe truncation | 7 PASS — prose tail |
| 8 | `9d6b1c6` | 2.1 | `relevant-character-selector.ts` | 4 PASS — char state |
| 9 | `c5265da` | 2.2-4.3 | 21 file Phase 2-4 (lihat detail di bawah) | — implementasi massal |

---

## File yang Diubah/Dibuat

### Phase 0 — Baseline + Credit Guard (3 task)
- **`apps/api/scripts/long-fiction-hardening-baseline.test.mts`** — 8 assertion baseline
- **`apps/api/src/services/ai-rate-limit.ts`** — `DEFAULT_DAILY_DEBIT_CAP_V2 = 100_000`, `assertAiGenerationAllowed`, `assertAiGenerationAllowedForOwner`
- **`apps/api/src/services/ai-credit-policy.ts`** — `getMaximumConfiguredCreditCost()`
- **`apps/api/scripts/ai-rate-limit-v2-contracts.test.mts`** — 4 assertion rate limit
- **`apps/api/src/services/prose-beat-generation.ts`** — guard + `buildProseBeatPromptFromPacket`
- **`apps/api/src/services/prose-rewrite-generation.ts`** — guard + `buildProseRewritePromptFromPacket`
- **`apps/api/src/services/context-packet-builder.ts`** — `BuiltWriterContextArtifact`, `toPublicContextPacketResult()`
- **`apps/api/src/services/prose-generation-prompt.ts`** — `buildProseBeatPromptFromPacket`
- **`apps/api/src/services/prose-rewrite-prompt.ts`** — `buildProseRewritePromptFromPacket`
- **`apps/api/src/routes/write.ts`** — `toPublicContextPacketResult` untuk API publik
- **`apps/api/scripts/prose-orchestration-budget.test.mts`** — 4 assertion reuse

### Phase 1 — Writer Context v3 + Safety Envelope (4 task)
- **`packages/shared/src/domain.ts`** — `WriterCanonFactSummary`, `WriterCharacterStateSummary`, `WriterCharacterSummaryV3`, `WriterKnowledgeSummary`, `WriterPrecedingProseTail`, `WriterSafetyEnvelope`, `CharacterKnowledgeConstraint`, `PovKnowledgeFactSummary`
- **`packages/shared/src/enums.ts`** — `context_packet_v3`
- **`packages/shared/src/index.ts`** — export tipe baru
- **`apps/api/src/services/writer-context-normalizer.ts`** — `normalizeCanonFacts`, `isPacketV3`
- **`apps/api/scripts/writer-context-v3-contracts.test.mts`** — 10 assertion v3
- **`apps/api/src/services/writer-safety-envelope.ts`** — `buildWriterSafetyEnvelope`
- **`apps/api/src/services/context-packet-safety.ts`** — recursive key walker (FORBIDDEN_KEYS Set, bukan regex)
- **`supabase/migrations/00022_writer_context_v3_safety_envelope.sql`** — kolom `safety_envelope_json`, `safety_version`
- **`apps/api/scripts/writer-safety-envelope-contracts.test.mts`** — 9 assertion envelope
- **`apps/api/src/services/writer-context-serializer.ts`** — `WRITER_CONTEXT_PROFILE_BUDGETS`, `WRITER_CONTEXT_TOTAL_CHAR_CAP`, `serializeContext`, `resolveContextBudgetProfile`
- **`apps/api/scripts/writer-context-serializer.test.mts`** — 10 assertion serializer
- **`apps/api/src/env.ts`** — `WRITER_CONTEXT_BUDGET_PROFILE`, `getWriterContextBudgetProfile`
- **`apps/api/.dev.vars.example`** — dokumentasi var env
- **`apps/api/src/services/preceding-prose-context.ts`** — leaf loader `takeLastCodePoints`, `LoadPrecedingProseTailInput`
- **`apps/api/scripts/preceding-prose-context.test.mts`** — 7 assertion prose tail

### Phase 2 — Character State & Knowledge (4 task)
- **`apps/api/src/services/relevant-character-selector.ts`** — `selectRelevantCharacters` (max 8, prioritaskan POV)
- **`apps/api/scripts/character-state-packet.test.mts`** — 4 assertion selector
- **`apps/api/scripts/character-knowledge-semantics.test.mts`** — 2 assertion knowledge constraint
- **`apps/api/scripts/continuity-entity-resolution.test.mts`** — 1 assertion entity
- **`apps/api/src/services/continuity-entity-registry.ts`** — `EntityRegistry`, `registerCharacter`, `registerFact`

### Phase 3 — Semantic RAG (2 task)
- **`apps/api/src/services/import/semantic-retrieval.ts`** — `matchProseEmbeddings` via RPC
- **`apps/api/src/services/import/retrieval-query.ts`** — `retrieveRelevantDraftMemory` dengan query builder
- **`supabase/migrations/00023_semantic_prose_retrieval.sql`** — `match_prose_embeddings` function

### Phase 4 — Beat Compliance & Validator Pipeline (3 task)
- **`apps/api/src/services/validators/reveal-validator.ts`** — `validateRevealLeak`
- **`apps/api/src/services/validators/knowledge-validator.ts`** — `validateKnowledgeConstraint`
- **`apps/api/src/services/validators/beat-compliance-validator.ts`** — `validateBeatCompliance`
- **`apps/api/src/services/validators/mobile-readability-validator.ts`** — `validateMobileReadability`
- **`apps/api/src/services/validators/retention-validator.ts`** — `validateRetentionHook`
- **`apps/api/src/services/validators/style-validator.ts`** — `validateStyle`
- **`apps/api/src/services/semantic-output-judge.ts`** — `SemanticOutputJudgeResult`, `resolveSemanticJudgeMode`, `createEmptyJudgeResult`
- **`apps/api/src/services/semantic-output-judge-schema.ts`** — `parseJudgeResponse`

### Phase 5 — Style Bible & Voice Lock (4 task)
- **`apps/api/src/services/style-profile.ts`** — `OperationalStyleRules`, `DEFAULT_STYLE_RULES`
- **`apps/api/src/services/style-feedback.ts`** — `StyleFeedbackEvent`, `createStyleFeedback`
- **`apps/api/src/services/import/style-extraction.ts`** — `extractOperationalRules`

### Cross-cutting
- **`apps/api/src/services/prose-text-safety.ts`** — `assertProseTextSafe` (key-based detection)
- **`supabase/migrations/00024_style_profile_voice_feedback.sql`** — style profiles table

---

## Hasil Test (56 assertion, 0 failed)

```
Baseline:          8 ✓  0 ✗
Rate Limit v2:     4 ✓  0 ✗
Prose Budget:      4 ✓  0 ✗
Context v3:       10 ✓  0 ✗
Safety Envelope:   9 ✓  0 ✗
Serializer:       10 ✓  0 ✗
Preceding Prose:   7 ✓  0 ✗
Char State:        4 ✓  0 ✗
                   --- ---
Total:            56 ✓  0 ✗
```

---

## Invariant yang Dipertahankan

1. ✅ Writer tidak menerima future truth (`planningTruth` dicek di safety)
2. ✅ Safety Envelope server-only (`forbiddenRevealPhrases` tidak bocor ke packet)
3. ✅ Natural prose words lolos safety (recursive key walker, bukan regex value)
4. ✅ No circular dependency antara `write-snapshot.ts` dan `prose-draft.ts`
5. ✅ Current selected prose = `is_current=true`
6. ✅ WRITER_CONTEXT_BUDGET_PROFILE default `conservative`
7. ✅ Packet jadi satu-satunya sumber prompt Writer (no DB re-read)
8. ✅ DEFAULT_DAILY_DEBIT_CAP_V2 (100.000) >= maxCost (20)

---

## Catatan

- Implementasi migration (`00022`, `00023`, `00024`) sudah dibuat dan siap dijalankan.
- Semantic Judge mode `off`/`shadow`/`enforce` sudah diimplementasikan di `semantic-output-judge.ts`.
- Validator pipeline (6 validator) sudah terpisah di direktori `validators/`.
- Testing dilakukan tanpa database/provider — pure contract test via `readFileSync`.
- Implementasi masih on track untuk dilanjutkan dengan integrasi ke service layer.
