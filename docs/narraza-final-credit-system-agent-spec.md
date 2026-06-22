# Narraza Final Credit System — Agent Implementation Spec

**Product:** Narraza  
**Tagline:** Build long fiction without losing the plot.  
**Document purpose:** This file converts the latest credit-system brainstorming into a clear implementation spec for any AI coding agent.  
**Target repo context:** `moxsenna/vibenovel-final` / Narraza app.  
**Status:** Final product direction for launch implementation.  
**Important:** Do not treat this as a production migration unless the engineering checklist and smoke tests are completed.

---

## 0. Executive Summary

Narraza should use an **action-based credit system**, not token-based billing exposed to users.

Users should never need to understand tokens, input/output pricing, provider cost, or model routing. They should only see simple credit prices such as:

- AI brainstorming reply: 100 credits
- Generate 3 concepts: 1,000 credits
- Generate prose beat Hemat: 800 credits
- Generate prose beat Seimbang: 1,500 credits
- Generate prose beat Terbaik: 7,500 credits

Internally, the system may track tokens, estimated provider cost, model, retries, and margin. Externally, the product should show fixed credit costs per successful AI action.

---

## 1. Core Product Decisions

### 1.1 Credit is NOT token billing

Do **not** expose token-based billing to users.

Bad UX example:

> "This message used 2,874 input tokens and 931 output tokens, so we charged 73.42 credits."

Correct UX example:

> "AI brainstorming reply: 100 credits."

The system can still store token counts and estimated provider costs internally for analytics, cost control, and margin monitoring.

### 1.2 User messages are free

For all chat-like features:

- User sends message: **0 credits**
- AI successfully replies: **charge credits**
- AI fails: **no charge or automatic refund**
- Validation fails before model call: **no charge**
- Duplicate request / idempotent retry: **do not double charge**

### 1.3 Charge only for successful AI value

Credit should be charged when the AI produces useful output.

Recommended debit behavior:

1. User triggers an AI action.
2. API validates request.
3. API checks credit balance.
4. API creates `generation_attempt`.
5. API debits credits before model call, using idempotency key.
6. API calls model.
7. If output is saved successfully, attempt becomes `succeeded`.
8. If model/save fails, refund automatically.

This matches the current Narraza debit/refund pattern and should be preserved.

### 1.4 Hemat / Seimbang / Terbaik only applies to prose writing

The quality modes:

- `hemat`
- `seimbang`
- `terbaik`

must only affect prose/beat writing features.

They should **not** affect:

- intake assistant
- concept chat
- concept generation
- foundation normalizer
- foundation proposal
- outline generation
- continuity check
- reveal gate
- summary delta
- publish copy

Those non-prose features should use fixed model routing and fixed credit pricing.

---

## 2. Credit Packages

Use large credit numbers to make deductions feel clean and flexible across many AI features.

### 2.1 Final top-up packages

| Slug | Display Name | Price IDR | Credits Granted | Effective Rp/Credit | Notes |
|---|---:|---:|---:|---:|---|
| `starter` | Starter | 49,000 | 20,000 | 2.45 | Entry package |
| `creator` | Creator | 99,000 | 55,000 | 1.80 | Recommended / best seller |
| `pro` | Pro | 199,000 | 130,000 | 1.53 | Serious writer |
| `studio` | Studio | 399,000 | 300,000 | 1.33 | Best value |

### 2.2 Important correction

Do not use this old example:

- Rp49,000 = 20,000 credits
- Rp99,000 = 25,000 credits

That pricing is wrong because the higher package becomes more expensive per credit.

Correct principle:

> Bigger top-up package must always give cheaper effective credit price.

---

## 3. Final Credit Pricing

### 3.1 Chat / brainstorming layer

| Feature Key | User-Facing Action | Credit Cost | Billing Rule |
|---|---:|---:|---|
| `intake_chat_reply` | Intake Assistant AI reply | 100 | Charge only when AI reply succeeds |
| `concept_chat_reply` | Concept refinement AI reply | 150 | Charge only when AI reply succeeds |
| `story_consultant_reply` | Mid-project story consultant reply | 200 | Charge only when AI reply succeeds |
| `long_context_consultation` | Long-context story consultation | 300–500 | Use 300 by default, 500 for large context |

Recommended MVP:

- `intake_chat_reply`: 100 credits
- `concept_chat_reply`: 150 credits

Do not charge per user message.

### 3.2 Creation layer

| Feature Key | User-Facing Action | Credit Cost |
|---|---:|---:|
| `concept_generate_3` | Generate 3 story concepts | 1,000 |
| `concept_regenerate_1` | Regenerate 1 concept | 400 |
| `concept_merge_2` | Merge 2 concepts into 1 | 500 |
| `concept_finalize` | Finalize selected concept | 300 |
| `foundation_setup` | Normalize + propose + lock foundation | 2,000 |
| `outline_10_chapters` | Generate 10-chapter outline | 2,500 |

### 3.3 Prose / beat layer

Quality mode applies only here.

| Feature Key | Mode | Credit Cost |
|---|---:|---:|
| `prose_beat` | Hemat | 800 |
| `prose_beat` | Seimbang | 1,500 |
| `prose_beat` | Terbaik | 7,500 |
| `prose_continue` | Hemat | 500 |
| `prose_continue` | Seimbang | 900 |
| `prose_continue` | Terbaik | 4,500 |
| `prose_rewrite` | Hemat | 500 |
| `prose_rewrite` | Seimbang | 900 |
| `prose_rewrite` | Terbaik | 4,500 |
| `prose_expand` | Hemat | 600 |
| `prose_expand` | Seimbang | 1,100 |
| `prose_expand` | Terbaik | 5,000 |
| `prose_polish_emotion_dialog` | Hemat | 400 |
| `prose_polish_emotion_dialog` | Seimbang | 700 |
| `prose_polish_emotion_dialog` | Terbaik | 3,500 |

### 3.4 Validation / repair / publish layer

| Feature Key | User-Facing Action | Credit Cost | Notes |
|---|---:|---:|---|
| `continuity_check_standalone` | Standalone continuity check | 500 | User-triggered check |
| `summary_delta` | Summary delta / memory update | 500 | Can be auto-run after accepted chapter |
| `safe_repair_system_violation` | First repair due to AI violating continuity/reveal | 0 | Free if system caused the issue |
| `extra_repair_user_request` | Additional user-requested repair | 40–60% of original action | Calculate from original feature cost |
| `publish_package` | Title + blurb + hook + tags | 400 | Fixed model |
| `publish_regenerate_field` | Regenerate one publish field | 150 | Fixed model |

---

## 4. Final Model Routing

### 4.1 Key principle

Only prose writing has user-selectable quality mode.

All other features use fixed internal model routing.

### 4.2 Fixed model routing for non-prose features

> Model names below are launch candidates based on current OpenRouter research.  
> Before production launch, verify availability, price, and model behavior again.

| Feature | Primary Model | Fallback Model | Uses Quality Mode? | Reason |
|---|---|---|---|---|
| Intake Assistant / brainstorming chat | `google/gemini-3.1-flash-lite` | `qwen/qwen3.7-plus` | No | Cheap, fast, high-volume chat and extraction |
| Concept refinement chat | `qwen/qwen3.7-plus` | `google/gemini-3.1-flash-lite` | No | Better ideation and story refinement |
| Generate 3 concepts | `qwen/qwen3.7-plus` | `minimax/minimax-m3` | No | Good creativity, structure, and cost balance |
| Foundation Normalizer | `google/gemini-3.1-flash-lite` | `deepseek/deepseek-v4-flash` | No | Structured extraction and JSON normalization |
| Foundation Proposal / Character Bible | `minimax/minimax-m3` | `qwen/qwen3.7-plus` | No | Long-context planning and consistency |
| Season / Arc / 10-chapter outline | `minimax/minimax-m3` | `qwen/qwen3.7-plus` | No | Long-horizon outline coherence |
| Continuity Check / Reveal Gate | `deepseek/deepseek-v4-flash` | `google/gemini-3.1-flash-lite` | No | Cheap validator and long-context check |
| Summary Delta / Memory Update | `deepseek/deepseek-v4-flash` | `google/gemini-3.1-flash-lite` | No | Factual summarization and memory update |
| Publish Copy | `qwen/qwen3.7-plus` | `google/gemini-3.1-flash-lite` | No | Short persuasive copy |

### 4.3 Prose model routing

| Quality Mode | Primary Model | Fallback Model | Credit Cost per Beat |
|---|---|---|---:|
| `hemat` | `minimax/minimax-m3` | `qwen/qwen3.7-plus` | 800 |
| `seimbang` | `google/gemini-2.5-flash` | `mistralai/mistral-large-2512` | 1,500 |
| `terbaik` | `anthropic/claude-opus-4.8` | `openai/gpt-5.2` | 7,500 |

### 4.4 Terbaik mode warning

Do not price Terbaik too low.

If Terbaik uses Claude Opus 4.8, `prose_beat_terbaik` should be around **7,500 credits**, not 3,000 credits.

Reason:

- Terbaik is premium.
- Opus-class models are significantly more expensive.
- Terbaik should be used for high-impact scenes: opening, betrayal, confession, climax, ending.
- Terbaik should not be positioned as the default mode for hundreds of chapters.

---

## 5. Internal Token Budget Rules

Even though user billing is fixed, every AI action needs internal token limits.

### 5.1 Suggested internal budgets

| Feature Key | Max Input Tokens | Max Output Tokens | Notes |
|---|---:|---:|---|
| `intake_chat_reply` | 12,000 | 700 | Keep response concise |
| `concept_chat_reply` | 18,000 | 900 | Refinement chat |
| `concept_generate_3` | 25,000 | 2,500 | Generate 3 concepts |
| `foundation_setup` | 40,000 | 3,000 | Structured foundation |
| `outline_10_chapters` | 50,000 | 4,000 | 10-chapter outline |
| `prose_beat_hemat` | 25,000 | 2,000 | Scene/beat prose |
| `prose_beat_seimbang` | 35,000 | 2,500 | Better style and coherence |
| `prose_beat_terbaik` | 50,000 | 3,000 | Premium high-impact scene |
| `continuity_check_standalone` | 60,000 | 1,500 | Validator output should be concise |
| `summary_delta` | 50,000 | 1,500 | Structured memory update |
| `publish_package` | 15,000 | 1,000 | Short copy |

### 5.2 Do not send full raw chat forever

For chat-like features, prevent token growth by using:

1. Recent message window  
   - Send the last 6–10 messages only.

2. Running summary  
   - Maintain internal summary of important decisions.

3. Structured draft state  
   - Store approved/rejected ideas, genre, tone, protagonist, conflict, constraints, and preferences.

Example structured state:

```json
{
  "genre": "drama rumah tangga",
  "targetReader": "KBM adult readers",
  "mainConflict": "wife discovers emotional betrayal",
  "protagonist": "young mother rebuilding self-worth",
  "approvedIdeas": [
    "domestic emotional tension",
    "slow-burn revelation"
  ],
  "rejectedIdeas": [
    "CEO male lead",
    "fantasy setting"
  ],
  "forbiddenDirections": [
    "do not reveal pregnancy twist before chapter 12"
  ]
}
```

---

## 6. Recommended Implementation Shape

### 6.1 Use a central credit policy module

Create or update a centralized policy file, for example:

```ts
// apps/api/src/services/credit-policy-v2.ts

export type NarrazaAiFeature =
  | 'intake_chat_reply'
  | 'concept_chat_reply'
  | 'concept_generate_3'
  | 'concept_regenerate_1'
  | 'concept_merge_2'
  | 'concept_finalize'
  | 'foundation_setup'
  | 'outline_10_chapters'
  | 'prose_beat'
  | 'prose_continue'
  | 'prose_rewrite'
  | 'prose_expand'
  | 'prose_polish_emotion_dialog'
  | 'continuity_check_standalone'
  | 'summary_delta'
  | 'publish_package'
  | 'publish_regenerate_field';

export type ProseQualityMode = 'hemat' | 'seimbang' | 'terbaik';

export const FIXED_FEATURE_CREDIT_COSTS: Record<string, number> = {
  intake_chat_reply: 100,
  concept_chat_reply: 150,
  concept_generate_3: 1000,
  concept_regenerate_1: 400,
  concept_merge_2: 500,
  concept_finalize: 300,
  foundation_setup: 2000,
  outline_10_chapters: 2500,
  continuity_check_standalone: 500,
  summary_delta: 500,
  publish_package: 400,
  publish_regenerate_field: 150,
};

export const PROSE_CREDIT_COSTS: Record<
  'prose_beat' | 'prose_continue' | 'prose_rewrite' | 'prose_expand' | 'prose_polish_emotion_dialog',
  Record<ProseQualityMode, number>
> = {
  prose_beat: {
    hemat: 800,
    seimbang: 1500,
    terbaik: 7500,
  },
  prose_continue: {
    hemat: 500,
    seimbang: 900,
    terbaik: 4500,
  },
  prose_rewrite: {
    hemat: 500,
    seimbang: 900,
    terbaik: 4500,
  },
  prose_expand: {
    hemat: 600,
    seimbang: 1100,
    terbaik: 5000,
  },
  prose_polish_emotion_dialog: {
    hemat: 400,
    seimbang: 700,
    terbaik: 3500,
  },
};

export function getCreditCost(input: {
  feature: NarrazaAiFeature;
  qualityMode?: ProseQualityMode;
}): number {
  if (input.feature in PROSE_CREDIT_COSTS) {
    if (!input.qualityMode) {
      throw new Error(`qualityMode is required for prose feature: ${input.feature}`);
    }

    return PROSE_CREDIT_COSTS[
      input.feature as keyof typeof PROSE_CREDIT_COSTS
    ][input.qualityMode];
  }

  const fixedCost = FIXED_FEATURE_CREDIT_COSTS[input.feature];

  if (typeof fixedCost !== 'number') {
    throw new Error(`Unknown AI feature credit cost: ${input.feature}`);
  }

  return fixedCost;
}
```

### 6.2 Use a central model routing module

Create or update model routing, for example:

```ts
// apps/api/src/services/model-routing-v2.ts

export const FIXED_FEATURE_MODELS = {
  intake_chat_reply: {
    primary: 'google/gemini-3.1-flash-lite',
    fallback: 'qwen/qwen3.7-plus',
  },
  concept_chat_reply: {
    primary: 'qwen/qwen3.7-plus',
    fallback: 'google/gemini-3.1-flash-lite',
  },
  concept_generate_3: {
    primary: 'qwen/qwen3.7-plus',
    fallback: 'minimax/minimax-m3',
  },
  foundation_setup: {
    primary: 'minimax/minimax-m3',
    fallback: 'qwen/qwen3.7-plus',
  },
  outline_10_chapters: {
    primary: 'minimax/minimax-m3',
    fallback: 'qwen/qwen3.7-plus',
  },
  continuity_check_standalone: {
    primary: 'deepseek/deepseek-v4-flash',
    fallback: 'google/gemini-3.1-flash-lite',
  },
  summary_delta: {
    primary: 'deepseek/deepseek-v4-flash',
    fallback: 'google/gemini-3.1-flash-lite',
  },
  publish_package: {
    primary: 'qwen/qwen3.7-plus',
    fallback: 'google/gemini-3.1-flash-lite',
  },
} as const;

export const PROSE_MODELS = {
  hemat: {
    primary: 'minimax/minimax-m3',
    fallback: 'qwen/qwen3.7-plus',
  },
  seimbang: {
    primary: 'google/gemini-2.5-flash',
    fallback: 'mistralai/mistral-large-2512',
  },
  terbaik: {
    primary: 'anthropic/claude-opus-4.8',
    fallback: 'openai/gpt-5.2',
  },
} as const;
```

### 6.3 Recommended database migration for product packages

Do not edit old applied migrations. Add a new migration.

Suggested filename:

```txt
supabase/migrations/00011_credit_scale_v2_topup_products.sql
```

Suggested SQL:

```sql
begin;

insert into public.credit_topup_products (
  slug,
  display_name,
  price_idr,
  credits,
  bonus_credits,
  is_active,
  sort_order,
  metadata
)
values
  (
    'starter',
    'Starter',
    49000,
    20000,
    0,
    true,
    10,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'entry'
    )
  ),
  (
    'creator',
    'Creator',
    99000,
    50000,
    5000,
    true,
    20,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'recommended',
      'badge', 'Best Seller'
    )
  ),
  (
    'pro',
    'Pro',
    199000,
    120000,
    10000,
    true,
    30,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'serious_writer'
    )
  ),
  (
    'studio',
    'Studio',
    399000,
    270000,
    30000,
    true,
    40,
    jsonb_build_object(
      'creditScaleVersion', 'v2',
      'positioning', 'best_value',
      'badge', 'Best Value'
    )
  )
on conflict (slug) do update set
  display_name = excluded.display_name,
  price_idr = excluded.price_idr,
  credits = excluded.credits,
  bonus_credits = excluded.bonus_credits,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

commit;
```

---

## 7. Existing Repo Integration Notes

These are expected implementation changes in the current Narraza repo.

### 7.1 Existing current behavior to update

Current repo likely has:

- `apps/api/src/services/ai-credit-policy.ts`
  - `prose_beat`: 5 / 10 / 20
  - `prose_rewrite`: 3 / 6 / 12
  - `publish_copy`: 3 / 6 / 12

This should be replaced or superseded with v2 values.

### 7.2 Intake currently hardcoded too low

Current developing/testing value:

- intake reply = 1 credit

Final launch value:

- intake reply = 100 credits

Expected code change:

- Replace hardcoded `1` with a named constant.
- Example: `INTAKE_CHAT_REPLY_CREDIT_COST = 100`.

### 7.3 Concept currently hardcoded too low

Current developing/testing value:

- generate concepts = 3 credits

Final launch value:

- generate 3 concepts = 1,000 credits

Expected code change:

- Replace hardcoded `3` with a named constant.
- Example: `CONCEPT_GENERATE_3_CREDIT_COST = 1000`.

### 7.4 Publish copy should not use quality mode

If existing implementation maps publish copy to quality modes, remove that behavior for final launch.

Publish copy should use:

- fixed model routing
- fixed credit cost
- no Hemat/Seimbang/Terbaik selector

---

## 8. Generation Type Strategy

### 8.1 Short-term safe strategy

If the database enum currently only supports:

- `prose_beat`
- `prose_rewrite`
- `publish_copy`
- `summary_delta`

then do not force a risky enum migration immediately.

Short-term safe option:

- Continue using existing enum value for compatibility.
- Store real feature name in metadata:
  - `actualGenerationType`
  - `billingAlias`
  - `featureKey`

Example:

```json
{
  "featureKey": "intake_chat_reply",
  "actualGenerationType": "intake_chat_reply",
  "billingAlias": "publish_copy",
  "creditScaleVersion": "v2"
}
```

### 8.2 Better long-term strategy

Add explicit generation types in a future migration:

- `intake_chat_reply`
- `concept_chat_reply`
- `concept_generate_3`
- `foundation_setup`
- `outline_10_chapters`
- `continuity_check_standalone`
- `publish_package`

This is cleaner for analytics and billing reports.

Do this only when ready to handle enum migration safely in Supabase/Postgres.

---

## 9. Chat Billing Rules

### 9.1 Intake Assistant

Rules:

- User message: 0 credits
- AI reply success: 100 credits
- AI failure: refund or no charge
- First onboarding allowance: optional 3–5 free AI replies

Recommended MVP:

```txt
Intake Assistant = 100 credits per successful AI reply.
```

Optional later product improvement:

```txt
First 3 AI replies are free for new users.
```

### 9.2 Concept Chat

Rules:

- User message: 0 credits
- AI refinement reply: 150 credits
- Generate 3 concepts: 1,000 credits
- Regenerate one concept: 400 credits
- Merge two concepts: 500 credits
- Finalize concept: 300 credits

Do not treat all concept actions as normal chat. Generation and finalization are distinct product actions.

---

## 10. User Interface Requirements

### 10.1 Show credit estimate before AI action

Before calling AI, show clear label:

```txt
AI reply ini memakai 100 kredit.
```

For bigger actions:

```txt
Generate 3 konsep cerita — 1.000 kredit.
```

For prose:

```txt
Tulis beat dengan mode Hemat — 800 kredit.
```

### 10.2 Show credit result after success

After successful AI output:

```txt
Berhasil. 100 kredit digunakan. Sisa kredit: 18.750.
```

### 10.3 Explain failure/refund simply

If model fails:

```txt
AI gagal membalas. Kredit kamu tidak terpakai.
```

or:

```txt
AI gagal membalas. Kredit sudah dikembalikan otomatis.
```

### 10.4 Avoid technical token language

Do not show:

- token count
- provider cost
- OpenRouter price
- model name by default
- internal failure stack

These are developer/admin analytics only.

---

## 11. Abuse and Cost Control

Implement internal guardrails:

1. Max input tokens per feature.
2. Max output tokens per feature.
3. Daily per-user AI call cap.
4. Daily per-user provider cost cap.
5. Idempotency key required for every paid action.
6. No double charge on retry.
7. Refund on failed model call or failed save.
8. Block client-supplied:
   - model
   - provider
   - credit cost
   - raw prompt
   - context packet
   - payment amount
   - credits granted

The client may request a feature and quality mode only where allowed.

Allowed client input example:

```json
{
  "feature": "prose_beat",
  "qualityMode": "hemat",
  "idempotencyKey": "client-generated-uuid"
}
```

Forbidden client input example:

```json
{
  "feature": "prose_beat",
  "model": "anthropic/claude-opus-4.8",
  "creditCost": 1,
  "provider": "openrouter"
}
```

---

## 12. Revenue and Capacity Estimates

### 12.1 Estimated credits per chapter

Assumption:

- 1 chapter = 5 prose beats
- 1 summary delta
- 1 publish package

| Mode | Formula | Total Credits / Chapter |
|---|---:|---:|
| Hemat | 5 × 800 + 500 + 400 | 4,900 |
| Seimbang | 5 × 1,500 + 500 + 400 | 8,400 |
| Terbaik | 5 × 7,500 + 500 + 400 | 38,400 |

### 12.2 Estimated chapters per package

| Package | Credits | Hemat Chapters | Seimbang Chapters | Terbaik Chapters |
|---|---:|---:|---:|---:|
| Starter | 20,000 | ~4 | ~2 | ~0.5 |
| Creator | 55,000 | ~11 | ~6 | ~1 |
| Pro | 130,000 | ~26 | ~15 | ~3 |
| Studio | 300,000 | ~61 | ~35 | ~7 |

### 12.3 Product positioning

- Hemat = default for beginners and long serial writing.
- Seimbang = recommended for better prose quality without huge cost.
- Terbaik = premium for key scenes, not for every chapter.

Suggested UI copy:

```txt
Hemat — cocok untuk draft cepat dan serial panjang.
Seimbang — hasil lebih rapi untuk bab penting.
Terbaik — untuk adegan emosional, opening, climax, atau ending.
```

---

---

## 13A. Future Pricing Adjustability Rules

This section exists to make future pricing changes easy and safe.

### 13A.1 Pricing must have one source of truth

Do not hardcode credit prices directly inside feature handlers such as:

- `intake.ts`
- `concept.ts`
- `prose.ts`
- route handlers
- UI components

All AI feature pricing must go through one centralized function, for example:

```ts
getCreditCost({
  feature: 'prose_beat',
  qualityMode: 'hemat',
});
```

This allows future price changes to be made in one place.

### 13A.2 Separate top-up packages from AI action pricing

There are two different pricing layers:

1. **Credit top-up packages**
   - Stored in database table such as `credit_topup_products`.
   - Example: Rp99,000 gives 55,000 credits.

2. **AI action costs**
   - Stored in centralized credit policy code or a future admin-managed pricing table.
   - Example: `prose_beat_hemat` costs 800 credits.

Do not mix these layers.

Changing a top-up package should not require changing AI feature costs.

Changing AI feature costs should not require changing top-up package rows.

### 13A.3 Separate model routing from credit pricing

Credit pricing and model routing must remain separate.

Example:

```txt
prose_beat_hemat = 800 credits
```

This price should not be tightly coupled to a specific provider model.

The model can change internally from:

```txt
minimax/minimax-m3
```

to another better/cheaper model later, while the user-facing credit cost can remain the same.

Reason:

- OpenRouter model prices can change.
- Model quality can change.
- New models can become available.
- Narraza may want to preserve user-facing pricing while optimizing internal margin.

### 13A.4 Store pricing snapshot in ledger metadata

Every credit ledger entry for an AI action should store the pricing snapshot used at the time of debit.

Recommended metadata:

```json
{
  "featureKey": "prose_beat",
  "qualityMode": "hemat",
  "creditCost": 800,
  "creditPricingVersion": "v2",
  "modelRoutingVersion": "v2",
  "model": "minimax/minimax-m3"
}
```

This is required for:

- audit safety
- refund accuracy
- revenue reporting
- future pricing migration
- debugging user complaints

### 13A.5 Never rewrite historical ledger prices

If Narraza changes pricing later, do not mutate old credit ledger rows.

Correct approach:

- old transactions stay on `creditPricingVersion: "v2"`
- new transactions use `creditPricingVersion: "v3"`

This makes old refunds and old reports reliable.

### 13A.6 Use explicit pricing versions for major changes

For small internal model changes, only update `modelRoutingVersion`.

For price changes visible to users, update `creditPricingVersion`.

Examples:

| Change | Version to Update |
|---|---|
| Replace prose Hemat model but keep 800 credits | `modelRoutingVersion` |
| Change prose Hemat from 800 to 900 credits | `creditPricingVersion` |
| Change Creator package from 55,000 to 60,000 credits | top-up product metadata/version |
| Add new feature cost | `creditPricingVersion` if public pricing changes |

### 13A.7 Future admin pricing table option

The MVP can use TypeScript constants for AI action costs.

Later, Narraza can move AI action costs to a database table, for example:

```txt
ai_credit_pricing_rules
```

Suggested columns:

```txt
id
feature_key
quality_mode
credit_cost
pricing_version
is_active
effective_from
effective_until
metadata
created_at
updated_at
```

Do not build this admin table too early unless pricing needs frequent changes from the dashboard.

MVP recommendation:

```txt
Use centralized TypeScript credit policy first.
Move to database-managed AI pricing only after public payment is stable.
```

### 13A.8 Acceptance criteria for future adjustability

The pricing system is future-proof only if:

1. Changing one feature price requires editing only one central policy location.
2. Top-up package changes are handled separately from AI action costs.
3. Model changes do not require changing credit costs.
4. Ledger rows store `creditCost`, `featureKey`, and `creditPricingVersion`.
5. Historical ledger rows are never rewritten when pricing changes.
6. Refunds use the original debited amount, not the latest current price.
7. Client input can never override model, provider, or credit cost.


## 13. Engineering Checklist

### 13.1 Migration

- [ ] Add migration `00011_credit_scale_v2_topup_products.sql`.
- [ ] Do not edit old migrations.
- [ ] Verify `/api/credits/topup/products` returns:
  - Starter 20,000
  - Creator 55,000
  - Pro 130,000
  - Studio 300,000

### 13.2 Credit policy

- [ ] Add central v2 credit policy module.
- [ ] Replace old prose costs:
  - `prose_beat`: 800 / 1500 / 7500
  - `prose_rewrite`: 500 / 900 / 4500
- [ ] Add fixed feature costs:
  - intake reply 100
  - concept reply 150
  - generate 3 concepts 1000
  - foundation setup 2000
  - outline 10 chapters 2500
  - publish package 400

### 13.3 Model routing

- [ ] Add fixed model matrix for non-prose features.
- [ ] Add prose model matrix by quality mode.
- [ ] Prevent quality mode from affecting non-prose features.
- [ ] Prevent client from choosing model directly.

### 13.4 Intake / concept

- [ ] Change intake reply from 1 credit to 100 credits.
- [ ] Change concept generate from 3 credits to 1,000 credits.
- [ ] Add concept refinement chat reply at 150 credits.
- [ ] Add metadata:
  - `featureKey`
  - `creditScaleVersion: "v2"`
  - `actualGenerationType`

### 13.5 UI

- [ ] Show pre-action credit estimate.
- [ ] Show post-success credit deduction and remaining balance.
- [ ] Show no-charge/refund message on AI failure.
- [ ] Do not show token details to normal users.

### 13.6 Tests / smoke

- [ ] Intake successful reply debits 100 credits.
- [ ] Intake failed reply refunds 100 credits.
- [ ] Concept chat reply debits 150 credits.
- [ ] Generate 3 concepts debits 1,000 credits.
- [ ] Prose beat Hemat debits 800 credits.
- [ ] Prose beat Seimbang debits 1,500 credits.
- [ ] Prose beat Terbaik debits 7,500 credits.
- [ ] Publish package debits 400 credits.
- [ ] Duplicate idempotency key does not double charge.
- [ ] User message alone does not charge credits.
- [ ] Non-prose feature ignores quality mode.
- [ ] Client-supplied `model`, `provider`, or `creditCost` is rejected.

---

## 14. Acceptance Criteria

The implementation is considered correct when:

1. Credit top-up products use large v2 credit values.
2. Users are charged only for successful AI output.
3. User chat messages are free.
4. Intake chat charges 100 credits per successful AI reply.
5. Concept refinement charges 150 credits per successful AI reply.
6. Generate 3 concepts charges 1,000 credits.
7. Hemat/Seimbang/Terbaik only affects prose/beat features.
8. Non-prose features use fixed internal model routing.
9. Credit cost is never accepted from the client.
10. Model/provider is never accepted from the client.
11. Token counts remain internal-only.
12. Failed AI calls are refunded or not charged.
13. Idempotent retries do not double charge.
14. UI communicates credits clearly without mentioning tokens.

---

## 15. Do Not Do

Do not implement these:

- Do not expose token billing to users.
- Do not charge when user merely sends a message.
- Do not let client choose model.
- Do not let client choose credit cost.
- Do not make all features follow Hemat/Seimbang/Terbaik.
- Do not use Claude Opus-class model for normal intake chat.
- Do not price Claude Opus-class Terbaik prose at only 3,000 credits per beat.
- Do not edit old applied migrations.
- Do not multiply existing credit balances automatically without explicit founder approval.
- Do not launch public paid payment before smoke tests pass.

---

## 16. Suggested Implementation Order for Coding Agent

1. Read current repo credit/payment implementation.
2. Add this document to `docs/`.
3. Add v2 top-up product migration.
4. Add central credit policy v2.
5. Add central model routing v2.
6. Update intake credit cost from 1 to 100.
7. Update concept generation credit cost from 3 to 1,000.
8. Add concept refinement credit cost 150 if endpoint exists.
9. Update prose credit costs.
10. Ensure quality mode is only used for prose features.
11. Update UI credit labels.
12. Add/adjust tests.
13. Run typecheck.
14. Run smoke tests.
15. Prepare implementation report.

---

## 17. Final Product Rule

Narraza credits should feel like a simple creative energy system:

> Users buy credits.  
> Credits are used when AI successfully helps them create, refine, validate, or publish story assets.  
> Users should never need to understand tokens, provider prices, or model routing.

This is the cleanest system for user trust, product simplicity, and engineering control.
