# Narraza Public Beta Hardening Sprint Plan

> Status dokumen: execution plan untuk agent IDE.
>
> Target utama: mengubah Narraza dari private-beta hybrid AI/stub story pipeline menjadi public-beta-ready AI long-fiction engine.

---

## 0. Master Goal

Mengubah Narraza dari:

```text
Private beta AI writing pipeline dengan beberapa stub story intelligence
```

menjadi:

```text
Public-beta-ready AI long-fiction engine:
intake → concept → foundation/canon → outline → beat → prose → summary → continuity → publish
```

Prioritas utama bukan menambah fitur kosmetik, tetapi:

1. menghilangkan stub dari production path;
2. memperbaiki canon settlement loop;
3. memperkuat reveal/safety guard;
4. menstabilkan generation type, credit, audit, dan smoke test;
5. baru setelah itu memperkuat writing cockpit UX.

---

## 1. Aturan Eksekusi untuk Agent IDE

Gunakan aturan ini untuk semua sprint.

```text
Repository: moxsenna/vibenovel-final

Working rules:
1. Jangan rewrite besar-besaran.
2. Jangan ubah UI besar sebelum backend behavior stabil.
3. Satu task = satu commit kecil.
4. Jangan hapus deterministic stub sepenuhnya; jadikan dev/test fallback only.
5. Production build tidak boleh memakai stub kecuali env eksplisit mengizinkan.
6. Semua AI generation harus:
   - server-side only
   - punya generation_attempt
   - punya credit debit/refund
   - punya promptHash
   - punya safe output validation
   - punya audit log
7. Jangan expose planning_truth, context packet raw, full prompt, provider tokens, atau internal model metadata ke client.
8. Setelah setiap task, jalankan:
   npm run typecheck
   npm run build
   npm run lint
   jika ada test terkait, jalankan test terkait.
9. Jika gagal, fix sampai clean sebelum lanjut task berikutnya.
10. Dokumentasikan perubahan di docs/12-public-beta-hardening-log.md.
```

---

## 2. Urutan Sprint

Eksekusi dalam urutan ini:

```text
12.0 Baseline & no-prod-stub guard
12.1 Generation types cleanup
12.2 Real AI Beat Generator
12.3 AI Chapter Summary & Continuity Delta
12.4 Proposal Accept → Canon Promotion
12.5 Semantic Reveal Guard
12.6 Atomic Credit RPC
12.7 Write Room Version History & Diff
12.8 Public Beta QA Gate
```

Prioritas jika waktu terbatas:

```text
MUST:
12.0
12.1
12.2
12.3
12.4
12.5

SHOULD:
12.6

NICE:
12.7
12.8
```

---

# Sprint 12.0 — Baseline Lock & Regression Harness

## Tujuan

Membuat baseline agar sprint berikutnya tidak merusak flow yang sudah hidup.

## Scope

Tidak menambah fitur user-facing. Fokus pada test, smoke, docs, dan guard.

---

## Task 12.0.1 — Tambahkan audit baseline doc

### File target

```text
docs/12-public-beta-hardening-plan.md
docs/12-public-beta-hardening-log.md
```

### Isi minimal

```text
Current verified code-level state:
- AI prose generation real
- context packet real
- model router real
- credit ledger compensation-style
- intake/concept/foundation/outline hybrid AI/stub
- beat generation stub
- summary generation stub
- proposal accept status-only
- production mock guard exists
```

### Acceptance Criteria

```text
- Dokumen ada.
- Menyebut file service utama.
- Tidak mengklaim runtime PASS kalau belum diuji.
```

---

## Task 12.0.2 — Tambahkan environment guard untuk deterministic stub

### Tujuan

Production tidak boleh diam-diam memakai stub story generation.

### File target

```text
apps/api/src/env.ts
apps/api/src/services/chapter-beat.ts
apps/api/src/services/chapter-summary.ts
apps/api/src/services/outline.ts
apps/api/src/services/foundation-proposal.ts
apps/api/src/services/concept.ts
```

### Implementasi

Tambahkan helper:

```ts
export function allowDeterministicStoryStubs(bindings: AppBindings): boolean {
  return bindings.ALLOW_DETERMINISTIC_STORY_STUBS === "true";
}
```

Policy:

```text
DEV/local/test:
- stub boleh jika env true atau AI provider mock.

Production/live:
- jika AI generation enabled dan provider live, jangan fallback silent ke stub.
- jika AI gagal, return error + refund, bukan generate template Nadira/Arman.
```

### Acceptance Criteria

```text
- Tidak ada silent fallback ke deterministic story stub di live AI mode.
- Error message aman: "AI generation failed. Please try again."
- Credit refund tetap jalan jika sudah debit.
```

---

## Task 12.0.3 — Tambahkan smoke test script untuk no production stub

### File target

```text
scripts/smoke-no-production-stubs.ts
package.json
```

### Marker yang harus dicari

```text
beat_stub_deterministic
summary_stub_v1
outline_stub_deterministic
foundation_stub_batch
deterministic_stub
```

### Behavior

```text
- Di mode production env, marker ini tidak boleh muncul sebagai path aktif kecuali ALLOW_DETERMINISTIC_STORY_STUBS=true.
- Script boleh static-scan + runtime env assertion minimal.
```

### package.json

```json
{
  "scripts": {
    "smoke:no-prod-stubs": "tsx scripts/smoke-no-production-stubs.ts"
  }
}
```

### Acceptance Criteria

```text
npm run smoke:no-prod-stubs
```

lulus.

---

# Sprint 12.1 — Generation Type & Cost Model Cleanup

## Tujuan

Menghapus billing alias `publish_copy` dari intake, concept, foundation, dan outline. Setiap AI flow harus punya generation type resmi agar audit, cost, ledger, dan analytics tidak misleading.

## Generation types baru

```text
intake_assistant
concept_generation
foundation_generation
outline_generation
beat_generation
chapter_summary_generation
continuity_delta
prose_beat
prose_rewrite
publish_copy
```

---

## Task 12.1.1 — Update shared constants/types

### File target yang harus dicari agent

```text
packages/shared/src/*
packages/shared/*
```

Cari:

```text
GENERATION_TYPES
GenerationType
generation_type enum mapping
```

### Acceptance Criteria

```text
- TypeScript mengenali generation type baru.
- Existing imports tidak rusak.
```

---

## Task 12.1.2 — Update Supabase migration untuk enum/database

### File target

```text
supabase/migrations/00011_add_generation_types_public_beta.sql
```

### Migration behavior

Jika `generation_type` adalah Postgres enum:

```sql
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'intake_assistant';
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'concept_generation';
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'foundation_generation';
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'outline_generation';
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'beat_generation';
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'chapter_summary_generation';
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'continuity_delta';
```

Jika pakai check constraint/text, update constraint sesuai schema nyata.

### Acceptance Criteria

```text
- Migration idempotent.
- Tidak drop existing data.
- Tidak rename value lama secara destructive.
```

---

## Task 12.1.3 — Update model router caps

### File target

```text
apps/api/src/services/model-router.ts
```

Tambahkan cap:

```ts
const GENERATION_TYPE_TOKEN_CAP = {
  intake_assistant: 800,
  concept_generation: 3000,
  foundation_generation: 3000,
  outline_generation: 4000,
  beat_generation: 3000,
  chapter_summary_generation: 3000,
  continuity_delta: 1500,
  prose_beat: 2000,
  prose_rewrite: 2000,
  publish_copy: 800,
};
```

### Acceptance Criteria

```text
- Semua generation type punya cap.
- Tidak ada fallback undefined.
- Tests/typecheck lulus.
```

---

## Task 12.1.4 — Replace billing aliases

### File target

```text
apps/api/src/services/intake.ts
apps/api/src/services/concept.ts
apps/api/src/services/foundation-proposal.ts
apps/api/src/services/outline-generator.ts
```

Ganti penggunaan `GENERATION_TYPES.publish_copy` menjadi:

```text
intake.ts                → intake_assistant
concept.ts              → concept_generation
foundation-proposal.ts  → foundation_generation
outline-generator.ts    → outline_generation
```

Metadata `actualGenerationType` boleh dihapus kalau sudah redundant.

### Acceptance Criteria

```text
- generation_attempts menunjukkan type domain yang benar.
- credit ledger generationType juga benar.
- Tidak ada concept/foundation/outline/intake yang masih pakai publish_copy.
```

---

## Prompt Agent — Sprint 12.1

```text
You are working in repo moxsenna/vibenovel-final.

Task: Implement Sprint 12.1 Generation Type & Cost Model Cleanup.

Context:
Several AI flows currently use GENERATION_TYPES.publish_copy as billing alias even though they are concept/foundation/outline/intake generation. This creates misleading audit and credit metadata.

Requirements:
1. Add official generation types:
   intake_assistant, concept_generation, foundation_generation, outline_generation,
   beat_generation, chapter_summary_generation, continuity_delta.
2. Update shared TypeScript constants/types.
3. Add an idempotent Supabase migration for DB enum/check constraint.
4. Update model-router token caps for each generation type.
5. Replace publish_copy aliases in intake, concept, foundation-proposal, outline-generator.
6. Keep publish_copy for actual publish copy only.
7. Do not change provider/model allowlist behavior.
8. Run typecheck, build, lint.
9. Write a short report in docs/12-public-beta-hardening-log.md.

Acceptance:
- No intake/concept/foundation/outline service uses publish_copy as alias.
- generation_attempt metadata is still safe.
- credit debit/refund still works.
```

---

# Sprint 12.2 — Real AI Beat Generator

## Tujuan

Mengganti production beat generation dari deterministic stub menjadi AI structured generation berbasis canon + outline + reveal-safe context.

---

## Task 12.2.1 — Extract existing stub into explicit dev fallback

### File target

```text
apps/api/src/services/chapter-beat.ts
```

Refactor `generateBeatsForSessionForOwner()` menjadi:

```ts
if (shouldUseAiBeatGeneration(bindings)) {
  return generateBeatsWithAiForSession(...);
}

if (allowDeterministicStoryStubs(bindings)) {
  return generateBeatsWithDeterministicStub(...);
}

throw AppError.serviceUnavailable("AI beat generation is unavailable");
```

### Acceptance Criteria

```text
- Existing stub code masih ada tapi explicit fallback.
- Production tidak otomatis pakai stub.
```

---

## Task 12.2.2 — Buat beat-generation snapshot

### File baru

```text
apps/api/src/services/beat-generation-snapshot.ts
```

Snapshot harus load:

```text
project
foundation locked
selected concept
outline plan locked/generated
current chapter outline
previous chapter summaries if available
active/open loops
safe planned reveals only, without planning_truth
characters
facts
relationship speech rules
writing session
existing beats if regenerating
```

### Acceptance Criteria

```text
- Tidak select planning_truth.
- Tidak return future chapter summaries selain yang aman.
- Ownership check tetap ada.
```

---

## Task 12.2.3 — Buat AI beat prompt builder

### File baru

```text
apps/api/src/services/beat-generation-prompt.ts
```

Output JSON wajib:

```json
{
  "beats": [
    {
      "title": "string",
      "summary": "string",
      "direction": "string",
      "emotionalShift": "string",
      "mustInclude": ["string"],
      "mustNotInclude": ["string"],
      "wordTarget": 400,
      "stopCondition": "string"
    }
  ]
}
```

Prompt rules:

```text
- Generate 5–8 beats for current chapter.
- Follow current chapter hook, purpose, emotional direction, ending hook.
- Do not reveal forbidden future information.
- Use canon facts only.
- Respect relationship speech rules.
- Do not use template names unless present in canon.
- Keep each beat actionable for prose writing.
- Return valid JSON only.
```

---

## Task 12.2.4 — Implement `generateBeatsWithAiForSession`

### File target

```text
apps/api/src/services/chapter-beat.ts
apps/api/src/services/beat-generation-ai.ts
```

Flow wajib:

```text
load snapshot
build prompt
compute prompt hash
create generation_attempt beat_generation
debit credit
mark running
call model router
parse JSON
validate 5–8 beats
insert chapter_beats
mark succeeded
refund on failure
```

Cost awal:

```text
beat_generation = 3 credits
```

Validation:

```text
title max 200
summary max 1000
direction max 2000
mustInclude max 20
mustNotInclude max 20
wordTarget 100–1200
stopCondition max 500
```

### Acceptance Criteria

```text
- AI branch creates beat rows with metadata generator: "beat_ai_generator".
- No Nadira/Arman/Siska unless present in canon/snapshot.
- Failed JSON parse refunds credit.
- Existing regenerate prose guard tetap berlaku.
```

---

## Task 12.2.5 — Add tests

### File target

```text
apps/api/src/services/__tests__/beat-generation-ai.test.ts
```

Test minimal:

```text
- parses valid AI output
- rejects invalid JSON
- rejects too few beats
- rejects forbidden context markers
- does not include planning_truth in prompt
- refund path called on provider failure
```

---

## Prompt Agent — Sprint 12.2

```text
Implement Sprint 12.2 Real AI Beat Generator.

Repo: moxsenna/vibenovel-final.

Problem:
chapter-beat.ts currently generates chapter beats from hard-coded STUB_BEAT_TEMPLATES. This is not acceptable for public beta because it injects template characters and plots.

Goal:
Production beat generation must use AI structured JSON generation. Deterministic stub may remain only as explicit dev/test fallback.

Requirements:
1. Refactor generateBeatsForSessionForOwner:
   - AI branch when AI_GENERATION_ENABLED=true and provider is not mock.
   - deterministic stub branch only when allowDeterministicStoryStubs=true.
   - otherwise throw safe service unavailable error.
2. Add beat-generation-snapshot.ts.
   - Load project, foundation, selected concept, outline, current chapter, safe reveals, open loops, characters, facts, speech rules, writing session.
   - Never select or include planning_truth.
3. Add beat-generation-prompt.ts.
   - JSON-only prompt.
   - 5–8 beats.
   - mustInclude/mustNotInclude.
   - respect canon and reveal gate.
4. Add generateBeatsWithAiForSession flow:
   create attempt → debit → mark running → model router → parse/validate → insert beats → mark succeeded → refund on failure.
5. Use GENERATION_TYPES.beat_generation.
6. Add tests for parsing, invalid JSON, forbidden markers, refund path.
7. Keep regenerate guard: cannot regenerate beats if prose versions exist.
8. Run typecheck, build, lint, tests.
9. Update docs/12-public-beta-hardening-log.md.

Acceptance:
- Production no longer silently creates beat_stub_deterministic.
- AI generated beat rows have generator: beat_ai_generator.
- No template character names unless present in canon.
```

---

# Sprint 12.3 — AI Chapter Summary & Continuity Delta

## Tujuan

Membuat summary AI yang bisa menjadi memory engine, bukan ringkasan deterministic stub.

---

## Task 12.3.1 — Buat structured summary schema

### File baru

```text
apps/api/src/services/chapter-summary-schema.ts
```

Schema output:

```ts
interface AiChapterSummaryOutput {
  synopsis: string;
  miniVictory: string | null;
  emotionalOutcome: string | null;
  endingHook: string | null;
  newFacts: Array<{
    content: string;
    category: string;
    importance: "minor" | "major" | "core";
    confidence: number;
  }>;
  characterStateChanges: Array<{
    characterName: string;
    change: string;
    evidence: string;
  }>;
  relationshipChanges: Array<{
    characterAName: string;
    characterBName: string;
    change: string;
  }>;
  openLoopUpdates: Array<{
    question: string;
    status: "opened" | "developed" | "payoff_candidate" | "closed";
    note: string;
  }>;
  revealProgress: Array<{
    title: string;
    status: "hinted" | "armed" | "revealed" | "not_touched";
    safeNote: string;
  }>;
  continuityWarnings: Array<{
    severity: "info" | "warning" | "critical";
    title: string;
    body: string;
  }>;
}
```

---

## Task 12.3.2 — Buat AI summary generator

### File baru

```text
apps/api/src/services/chapter-summary-ai.ts
```

Flow:

```text
load summary snapshot
build prompt from current prose + safe canon
create generation_attempt chapter_summary_generation
debit 3 credits
call model router
parse JSON
validate
persist summary + items
create ai_proposals for new facts / relationship changes if confidence high
refund on failure
```

Important:

```text
Jangan auto-update canon. Summary boleh membuat proposal, bukan langsung fakta canon.
```

---

## Task 12.3.3 — Update `chapter-summary.ts`

Saat generate summary:

```ts
const useAi = isAiGenerationEnabled(bindings) && !isAiProviderMock(bindings);

const draft = useAi
  ? await generateChapterSummaryWithAi(...)
  : allowDeterministicStoryStubs(bindings)
    ? generateChapterSummaryStub(...)
    : throw unavailable;
```

### Acceptance Criteria

```text
- summary_stub_v1 tidak dipakai silent di production.
- chapter_summary_items berisi continuity warning/fact candidate/reveal progress dari AI output.
- AI failure refund.
```

---

## Task 12.3.4 — Add tests

Test:

```text
- valid AI summary persists summary and items
- invalid JSON refunds
- output with planning_truth rejected
- newFacts become ai_proposals, not facts
- approved summary cannot regenerate remains unchanged
```

---

## Prompt Agent — Sprint 12.3

```text
Implement Sprint 12.3 AI Chapter Summary & Continuity Delta.

Problem:
chapter-summary-generator.ts currently uses summary_stub_v1. It cannot act as a real long-fiction continuity memory.

Goal:
Use AI to produce structured chapter summaries and continuity deltas. Keep deterministic summary only as explicit dev/test fallback.

Requirements:
1. Add chapter-summary-schema.ts for structured output validation.
2. Add chapter-summary-ai.ts:
   - load summary snapshot
   - build safe prompt
   - create generation_attempt with GENERATION_TYPES.chapter_summary_generation
   - debit credits
   - call model router
   - parse and validate JSON
   - persist chapter_summaries and chapter_summary_items
   - create ai_proposals for new facts/relationship changes, not direct canon mutations
   - refund on failure
3. Update chapter-summary.ts to use AI branch in live mode.
4. Block raw markers: planning_truth, context_packet, packet_json, openrouter, full_prompt.
5. Add tests.
6. Run typecheck, build, lint, tests.
7. Update hardening log.

Acceptance:
- Production does not silently use summary_stub_v1.
- AI summary creates usable continuity items.
- New canon candidates are proposals only.
```

---

# Sprint 12.4 — Proposal Accept → Canon Promotion

## Tujuan

Ketika user accept proposal, sistem harus apply ke canon sesuai proposal type.

---

## Task 12.4.1 — Buat canon promotion service

### File baru

```text
apps/api/src/services/canon-promotion.ts
```

Function:

```ts
export async function promoteAcceptedProposalToCanon(
  bindings,
  ownerId,
  projectId,
  proposalRow
): Promise<PromotionResult>
```

Result:

```ts
interface PromotionResult {
  applied: boolean;
  targetEntityType: string | null;
  targetEntityId: string | null;
  changedFields: string[];
  warnings: string[];
}
```

---

## Task 12.4.2 — Implement foundation promotion

Proposal type:

```text
foundation
style
```

Behavior:

```text
foundation → update story_foundations fields:
- premise
- main_conflict
- reader_promise
- genre
- tone
- target_reader

style → update:
- tone
- style_tags
```

Rules:

```text
- If foundation is locked, reject unless proposal risk low and body includes explicit applyToLocked? false by default.
- Do not unlock automatically.
- Audit before/after.
```

---

## Task 12.4.3 — Implement character/fact/speech rule promotion

Proposal type:

```text
character
fact
relationship_speech_rule
```

Behavior:

```text
character → insert character or update existing by normalized name
fact → insert fact if no near-duplicate
relationship_speech_rule → insert speech rule if characters resolved
```

Rules:

```text
- High-risk fact category secret cannot become canon directly.
- Secret proposal should become planned reveal/proposal, not public fact.
```

---

## Task 12.4.4 — Update `acceptProposalForOwner`

### File target

```text
apps/api/src/services/ai-proposal.ts
```

Current flow:

```text
set status accepted only
```

New flow:

```text
load proposal
validate proposed
promote to canon
update proposal accepted + result ids
audit proposal accepted + canon applied
return response
```

If promotion fails:

```text
- Do not mark accepted.
- Return safe error.
```

---

## Task 12.4.5 — Add UI indication

### File target

```text
apps/web/src/pages/FoundationPage.tsx
apps/web/src/components/*
```

Display:

```text
Accepted & applied to canon
Accepted but not applied
Rejected
Merged
```

For now, backend should avoid accepted-but-not-applied except legacy records.

---

## Prompt Agent — Sprint 12.4

```text
Implement Sprint 12.4 Proposal Accept → Canon Promotion.

Problem:
ai-proposal accept currently only changes proposal status and logs status_only_no_canon_promotion. This leaves foundation/canon unchanged.

Goal:
When a proposal is accepted, apply it to the correct canon table safely.

Requirements:
1. Add canon-promotion.ts.
2. Support proposal types:
   - foundation → story_foundations
   - style → story_foundations tone/style_tags
   - character → characters
   - fact → facts
   - relationship_speech_rule → relationship_speech_rules
   - secret → do not create plain fact; create high-risk proposal/planned reveal path or mark not directly promotable
3. Update acceptProposalForOwner:
   - validate proposed
   - promote to canon
   - update status accepted
   - set result_fact_id/result_character_id/merged_into_id where applicable
   - audit before/after
4. If promotion fails, do not accept proposal.
5. Add tests:
   - foundation proposal updates foundation
   - character proposal creates character
   - fact proposal creates fact
   - secret proposal does not become plain fact
   - locked foundation blocks unsafe update
6. Update UI labels for accepted & applied.
7. Run typecheck, build, lint, tests.
8. Update docs.

Acceptance:
- Accepting a foundation proposal changes foundation data.
- Accepting a character proposal creates/updates a character.
- Accepting a high-risk secret does not leak into normal facts.
```

---

# Sprint 12.5 — Semantic Reveal Guard

## Tujuan

Menambahkan validation layer setelah AI output dan sebelum prose disimpan sebagai current version.

---

## Task 12.5.1 — Buat reveal guard snapshot

### File baru

```text
apps/api/src/services/reveal-guard-snapshot.ts
```

Load:

```text
current chapter number
planned reveals with:
- title
- planning_truth
- reader_facing_hint
- forbidden_before_chapter
- status
- risk_level
safe facts
current chapter outline
```

Catatan:

```text
Ini internal server-only. planning_truth boleh dibaca di guard, tapi tidak boleh masuk provider prompt generasi prose.
```

---

## Task 12.5.2 — Buat deterministic reveal leakage scanner

### File baru

```text
apps/api/src/services/reveal-guard.ts
```

Function:

```ts
assertProsePassesRevealGuard(input)
```

Cek:

```text
- exact keyword match dari planning_truth sebelum allowed chapter
- near phrase match sederhana
- title/hint overexposure
- forbidden reveal status
- high-risk reveal mention
```

Return:

```ts
{
  passed: boolean;
  severity: "pass" | "warn" | "block";
  findings: RevealGuardFinding[];
}
```

---

## Task 12.5.3 — Integrate di prose generation/rewrite/manual save

### File target

```text
apps/api/src/services/prose-beat-generation.ts
apps/api/src/services/prose-draft.ts
```

Policy:

```text
AI generated prose:
- block if severity block
- do not save as current
- refund credit if blocked before persistence
- mark attempt failed with AI_OUTPUT_UNSAFE or REVEAL_GUARD_BLOCKED

Manual user save:
- warn? Backend can allow manual save but add metadata warning if safe.
- Jangan hard-block user prose kecuali raw internal markers.
```

---

## Task 12.5.4 — Optional LLM judge mode

Env:

```text
REVEAL_GUARD_LLM_ENABLED=false by default
```

Jika true:

```text
- run cheap model to judge if prose reveals forbidden truth
- never send full planning_truth with user prose unless strictly necessary and redacted/minimized
```

Untuk private beta, deterministic scanner cukup.

---

## Prompt Agent — Sprint 12.5

```text
Implement Sprint 12.5 Semantic Reveal Guard.

Problem:
Context packet excludes planning_truth, but generated prose output is only scanned for technical markers. It may still leak future reveal meaning semantically.

Goal:
Add a server-side reveal guard after AI prose generation and before saving current prose.

Requirements:
1. Add reveal-guard-snapshot.ts.
   - Server-only load of planned reveals including planning_truth.
   - Never expose this snapshot to client or model prompt.
2. Add reveal-guard.ts.
   - Deterministic leakage scanner.
   - Detect forbidden reveal terms/phrases before allowed chapter.
   - Return pass/warn/block.
3. Integrate into prose generation and rewrite path.
   - If block: do not save prose, refund credit, mark attempt failed.
4. Manual save should not be overly blocked, except existing internal marker blocks remain.
5. Add audit metadata for reveal guard result.
6. Add tests:
   - generated prose mentioning forbidden truth before chapter is blocked
   - allowed reveal chapter passes
   - safe hints pass
   - output with planning_truth marker still blocked
7. Run typecheck, build, lint, tests.
8. Update docs.

Acceptance:
- AI prose cannot save forbidden reveal leakage as current version.
- Blocked generation refunds credit.
```

---

# Sprint 12.6 — Atomic Credit RPC

## Tujuan

Pindahkan debit/refund critical path ke Postgres RPC atomic.

---

## Task 12.6.1 — Buat migration RPC

### File baru

```text
supabase/migrations/00012_credit_atomic_rpc.sql
```

Function:

```sql
debit_generation_credit(
  p_user_id uuid,
  p_project_id uuid,
  p_attempt_id uuid,
  p_amount int,
  p_reason text,
  p_generation_type text,
  p_idempotency_key text,
  p_correlation_id text
)

refund_generation_credit(...)
```

Guarantees:

```text
- lock balance row FOR UPDATE
- check sufficient balance
- insert ledger idempotently
- update balance
- return ledger row + balance_after + idempotent_replay
```

---

## Task 12.6.2 — Update `credit-ledger.ts`

Prefer RPC if available:

```ts
try rpc
catch if function missing and ALLOW_LEGACY_CREDIT_MUTATION=true fallback old path
```

Production policy:

```text
legacy fallback false
```

---

## Task 12.6.3 — Add concurrency tests

Ideal test:

```text
- 2 concurrent debit same attempt => one debit, one idempotent replay
- 2 concurrent debit different attempt => balance consistent
- insufficient credit leaves ledger unchanged
```

Jika sulit dengan actual DB test, minimal tambahkan SQL verification script dan docs.

---

## Prompt Agent — Sprint 12.6

```text
Implement Sprint 12.6 Atomic Credit RPC.

Problem:
credit-ledger.ts uses compensation-style writes. This is acceptable for private beta but not robust for public launch.

Goal:
Move debit/refund operations to atomic Postgres RPC with row locking and idempotency.

Requirements:
1. Add Supabase migration 00012_credit_atomic_rpc.sql.
2. Implement debit_generation_credit and refund_generation_credit.
3. Ensure:
   - row-level lock on credit_balances
   - idempotency per attempt/reason/direction
   - no negative balance
   - ledger insert and balance update happen in one transaction
4. Update credit-ledger.ts to call RPC.
5. Keep legacy compensation path only behind ALLOW_LEGACY_CREDIT_MUTATION=true.
6. Add tests or documented SQL verification script.
7. Run typecheck, build, lint.
8. Update docs.

Acceptance:
- Service uses RPC for debit/refund.
- Existing public interface unchanged.
- Idempotent replay works.
```

---

# Sprint 12.7 — Write Room UX: Version History, Diff, Restore

## Tujuan

Mulai mengambil keunggulan Manuscript-style cockpit tanpa mengganti engine Narraza.

---

## Task 12.7.1 — API client for prose versions

### File target

```text
apps/web/src/services/write.ts
apps/web/src/hooks/useWriteRoomData.ts
```

Add functions:

```ts
listProseVersions(beatId)
makeProseVersionCurrent(versionId)
getProseVersion(versionId)
```

---

## Task 12.7.2 — Version history panel

### File target

```text
apps/web/src/components/writer/WriterVersionHistoryPanel.tsx
apps/web/src/components/writer/index.ts
apps/web/src/pages/WritePage.tsx
```

UI:

```text
- list version_number
- source badge: user_edited / ai_generated
- word_count
- created_at
- current badge
- restore button
```

---

## Task 12.7.3 — Simple diff view

Use lightweight text diff library or simple line diff.

UI:

```text
Compare current vs selected version
Added/removed paragraphs
```

No need perfect rich diff in first pass.

---

## Prompt Agent — Sprint 12.7

```text
Implement Sprint 12.7 Write Room Version History & Restore.

Goal:
Expose existing prose versioning backend in the Write Room UI.

Requirements:
1. Add web API client functions:
   - list prose versions for beat
   - get version
   - make version current
2. Add WriterVersionHistoryPanel.
3. Show:
   - version number
   - source
   - word count
   - created date
   - current badge
   - restore button
4. Add simple diff between selected version and current version.
5. After restore, refresh editor text and chapter word count.
6. Do not redesign full Write Room layout.
7. Run typecheck, build, lint.
8. Update docs.

Acceptance:
- User can see previous versions.
- User can restore a previous version.
- Current editor updates after restore.
```

---

# Sprint 12.8 — Public Beta QA, Smoke, and Release Gate

## Tujuan

Membuat release gate objektif: mana blocking, mana warning.

---

## Task 12.8.1 — End-to-end smoke script

### File target

```text
scripts/smoke-public-beta-flow.ts
```

Flow:

```text
login test user
create project
intake message
generate concepts
select concept
generate foundation proposals
accept foundation/character/fact proposals
lock foundation
generate outline
lock outline
start write session
generate beats AI
generate prose AI
rewrite prose AI
generate chapter summary AI
```

Output JSON:

```json
{
  "functionalPass": true,
  "steps": [],
  "blockingIssues": [],
  "warnings": []
}
```

---

## Task 12.8.2 — Add release checklist

### File

```text
docs/12-public-beta-release-checklist.md
```

Checklist:

```text
- typecheck PASS
- build PASS
- lint PASS
- smoke public beta flow PASS
- no production stub PASS
- credit atomic RPC PASS
- AI off fallback safe PASS
- payment still OFF unless explicitly enabled
- founder test user credits PASS
```

---

## Task 12.8.3 — Add launch mode flags

Env table doc:

```text
AI_GENERATION_ENABLED
AI_PROVIDER
AI_PROVIDER_MOCK
ALLOW_DETERMINISTIC_STORY_STUBS
ALLOW_LEGACY_CREDIT_MUTATION
REVEAL_GUARD_LLM_ENABLED
PAYMENT_PROVIDER
PAYMENT_ENABLED
PUBLIC_BETA_ENABLED
```

---

## Prompt Agent — Sprint 12.8

```text
Implement Sprint 12.8 Public Beta QA & Release Gate.

Goal:
Create a clear release gate for Narraza public beta.

Requirements:
1. Add smoke-public-beta-flow.ts covering:
   intake → concept → proposal → canon → foundation lock → outline → write session → AI beats → AI prose → AI rewrite → AI summary.
2. Add docs/12-public-beta-release-checklist.md.
3. Add env flag documentation.
4. Add npm script:
   "smoke:public-beta": "tsx scripts/smoke-public-beta-flow.ts"
5. Smoke output must be JSON with functionalPass, steps, blockingIssues, warnings.
6. Run typecheck, build, lint.
7. Update docs.

Acceptance:
- There is a repeatable public beta readiness check.
- Release can be blocked by objective failures.
```

---

# Master Prompt untuk Agent IDE

Pakai ini sebagai prompt pembuka ke agent IDE:

```text
You are a senior TypeScript/Supabase/Cloudflare full-stack engineer working on Narraza in repo moxsenna/vibenovel-final.

Mission:
Turn Narraza from private-beta hybrid AI/stub story pipeline into public-beta-ready AI long-fiction engine.

Important current state:
- API/routes are real.
- AI prose generation is real.
- context packet and model router are real.
- credit ledger exists but is compensation-style.
- intake/concept/foundation/outline have AI branches but still have stub fallback and publish_copy aliases.
- chapter beat generation is still deterministic stub.
- chapter summary generation is still deterministic stub.
- ai proposal accept is status-only and does not promote to canon.
- Write Room has textarea editor and AI actions but lacks version history/diff UI.

Execution discipline:
1. Work sprint by sprint.
2. Do not redesign everything.
3. Do not break existing flow.
4. One task per commit.
5. Run typecheck/build/lint after each task.
6. Add tests for new service logic.
7. Never expose planning_truth, context_packet raw, full prompt, provider tokens, or internal model metadata to the client.
8. Keep deterministic stubs only as explicit dev/test fallback, never silent production fallback.
9. Refund credits on AI failure after debit.
10. Update docs/12-public-beta-hardening-log.md after each task.

Sprint order:
12.0 Baseline & no-prod-stub guard
12.1 Generation types cleanup
12.2 Real AI Beat Generator
12.3 AI Chapter Summary & Continuity Delta
12.4 Proposal Accept → Canon Promotion
12.5 Semantic Reveal Guard
12.6 Atomic Credit RPC
12.7 Write Room Version History & Diff
12.8 Public Beta QA Gate

Start with Sprint 12.0 only. Do not proceed to Sprint 12.1 until Sprint 12.0 is complete and all checks pass.
```

---

# Milestone Akhir

Setelah semua sprint selesai, Narraza harus bisa diuji seperti ini:

```text
1. User membuat project cerita baru.
2. User chat intake bebas genre.
3. AI membuat 3 konsep yang spesifik, bukan template.
4. User pilih konsep.
5. AI membuat proposal foundation/characters/facts/style/secret.
6. User accept proposal.
7. Canon benar-benar berubah.
8. User lock foundation.
9. AI generate outline tanpa template karakter palsu.
10. User lock outline.
11. User buka Write Room.
12. AI generate beats sesuai canon/chapter.
13. AI write prose sesuai beat/context packet.
14. Reveal guard memblokir bocoran rahasia.
15. User rewrite prose.
16. User generate summary.
17. Summary menghasilkan continuity/fact proposals.
18. User bisa lihat version history dan restore version.
19. Smoke public beta PASS.
```

Jika milestone ini terpenuhi, status baru Narraza:

```text
Narraza public-beta-ready AI long-fiction engine
```
