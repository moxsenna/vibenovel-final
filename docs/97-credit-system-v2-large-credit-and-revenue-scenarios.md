# 97 — Credit System v2: Large Credit Unit, AI Action Pricing & Revenue Scenarios

**Date:** 2026-06-18  
**Status:** Proposed — do not apply to production without migration + smoke gate  
**Brand:** Narraza — *Build long fiction without losing the plot.*

---

## 1. Why v2 is needed

Narraza already has a working credit foundation:

- `credit_balances`
- `credit_ledger`
- `generation_attempts`
- top-up product/order/webhook tables
- debit/refund flow for AI generation
- Duitku/Mayar provider abstraction
- atomic top-up grant RPC in migration `00010`

The current issue is not absence of credits. The issue is **credit scale**.

Current MVP pricing uses small numbers:

- Prose beat: 5 / 10 / 20 credits
- Rewrite: 3 / 6 / 12 credits
- Publish copy: 3 / 6 / 12 credits
- Intake assistant: 1 credit
- Concept generation: 3 credits

This is functional, but not ideal when AI usage spreads across many feature types. We need bigger credit numbers so each AI action can be priced more flexibly without decimal logic or awkward tiny numbers.

---

## 2. Current repo condition summary

### Existing DB foundations

- `00008_sprint8_ai_generation_credit.sql` adds `generation_attempts` and append-only `credit_ledger`.
- `00009_sprint10_payment_topup.sql` adds top-up catalog, orders, webhook events, and four seeded product slugs: `starter`, `creator`, `pro`, `studio`.
- `00010_atomic_grant_credit_topup_rpc.sql` adds `grant_paid_credit_topup_atomic` for single-transaction paid top-up grant.

### Existing API behavior

- `ai-credit-policy.ts` contains fixed server-side credit costs.
- `credit-ledger.ts` debits/refunds by attempt and is idempotent per attempt/reason.
- `credit-topup.ts` loads active products from DB and uses `credits + bonus_credits` as `credits_to_grant`.
- `intake.ts` and `concept.ts` currently use `publish_copy` as billing alias because dedicated generation types are not yet modeled.

### Current production posture

- Payment is not production enabled.
- AI founder test is live/private-beta path.
- Production migration `00010` has historically been gated separately.

Conclusion: **v2 should be implemented as a forward migration + code policy change**, not by editing old migrations.

---

## 3. Recommended credit philosophy

### Product-facing principle

Users should see a large balance:

```txt
20.000 kredit
55.000 kredit
130.000 kredit
300.000 kredit
```

This feels more natural for many small AI actions.

### Internal principle

Credits are not direct tokens.

Credits should represent:

```txt
AI provider cost
+ retry/failure allowance
+ payment fee allowance
+ infrastructure allowance
+ product margin
+ simplicity premium
```

### Important correction

The example `Rp49rb = 20.000 kredit` and `Rp99rb = 25.000 kredit` does **not** make higher top-up cheaper. It makes higher top-up more expensive per credit.

So the v2 ladder must increase credits more aggressively at higher tiers.

---

## 4. Recommended top-up packages

| Slug | Product name | Price | Credits | Effective Rp / credit | Positioning |
|---|---:|---:|---:|---:|---|
| `starter` | Starter | Rp49.000 | 20.000 | Rp2,45 | mencoba 3–4 bab hemat |
| `creator` | Creator | Rp99.000 | 55.000 | Rp1,80 | recommended / best seller |
| `pro` | Pro | Rp199.000 | 130.000 | Rp1,53 | produksi serial rutin |
| `studio` | Studio | Rp399.000 | 300.000 | Rp1,33 | volume tinggi |

Optional later:

| Slug | Product name | Price | Credits | Effective Rp / credit |
|---|---:|---:|---:|---:|
| `agency` | Agency | Rp799.000 | 700.000 | Rp1,14 |

Do not introduce `agency` until the first four packages are stable in payment smoke.

---

## 5. Recommended AI action pricing v2

### 5.1 Intake / onboarding

| Action | Credits | Notes |
|---|---:|---|
| Intake assistant reply | 150 | small friction, can be free-limited for first project |
| Generate 3 concepts | 1.000 | high value; currently 3 old credits |
| Generate foundation proposal | 1.500 | when real generator exists |
| Foundation readiness check | 0 | deterministic/system included |
| Lock foundation | 0 | user action, not AI |

### 5.2 Planning

| Action | Hemat | Seimbang | Terbaik | Notes |
|---|---:|---:|---:|---|
| Generate 10-chapter outline | 2.500 | 3.500 | 6.000 | includes retention/reveal notes |
| Regenerate one chapter outline | 300 | 600 | 1.200 | partial regeneration only |
| Adjust pacing / target length | 700 | 1.200 | 2.500 | planning-heavy |
| Reveal schedule helper | 700 | 1.200 | 2.500 | future truth handling |

### 5.3 Writing

| Action | Hemat | Seimbang | Terbaik | Notes |
|---|---:|---:|---:|---|
| Generate one beat / scene | 800 | 1.500 | 3.000 | main paid action |
| Continue current beat | 500 | 900 | 1.800 | shorter continuation |
| Rewrite beat | 500 | 900 | 1.800 | canon-safe rewrite |
| Expand beat | 600 | 1.100 | 2.200 | no new canon facts |
| Strengthen emotion/dialogue | 400 | 700 | 1.400 | focused polish |

Recommended default: **Seimbang hidden for beginner?** No. Show all 3 modes but default to **Hemat** in private beta and **Seimbang** after quality is stable.

### 5.4 Review / QA

| Action | Credits | Notes |
|---|---:|---|
| Basic validation after generation | 0 | included with paid generation |
| Standalone continuity check | 700 | useful for imported draft / advanced user |
| Chapter summary + delta | 700 | can be included after all beats accepted |
| Safe repair pass | 0 for first pass | first repair included if system violation |
| Extra repair / re-polish | 40–60% of original action | user-requested extra iteration |

### 5.5 Publish

| Action | Hemat | Seimbang | Terbaik | Notes |
|---|---:|---:|---:|---|
| Publish copy package | 400 | 800 | 1.500 | teaser, caption, question, next teaser |
| Regenerate one publish field | 150 | 300 | 600 | field-level retry |
| Title/blurb optimizer | 400 | 800 | 1.500 | later |

---

## 6. What the packages mean in real usage

Assume one normal KBM chapter has:

```txt
5 beats
+ chapter summary/delta
+ publish package
```

### Hemat chapter estimate

```txt
5 beats × 800 = 4.000
summary/delta = 700
publish package = 400
Total ≈ 5.100 credits / chapter
```

| Package | Credits | Approx chapters in Hemat |
|---|---:|---:|
| Starter | 20.000 | ±3–4 chapters |
| Creator | 55.000 | ±10 chapters |
| Pro | 130.000 | ±25 chapters |
| Studio | 300.000 | ±58 chapters |

This is a good commercial ladder because Starter lets users feel value, while serious serial production pushes them toward Creator/Pro/Studio.

---

## 7. Revenue scenarios

Assumption for simple modeling:

- Gross revenue = top-up sales.
- Net after variable cost uses two versions:
  - 15% variable cost: AI + payment fee + retries + infra buffer.
  - 25% variable cost: more conservative / heavier premium model usage.
- Does not include fixed salary, founder time, agency fee, or paid ads.

### 7.1 Monthly scenario table

| Scenario | Paying users / month | Mix assumption | Avg order value | Gross revenue | Net @15% variable | Net @25% variable |
|---|---:|---|---:|---:|---:|---:|
| Conservative | 100 | 45% Starter, 40% Creator, 12% Pro, 3% Studio | Rp97.500 | Rp9.750.000 | Rp8.287.500 | Rp7.312.500 |
| Base | 300 | 30% Starter, 45% Creator, 20% Pro, 5% Studio | Rp119.000 | Rp35.700.000 | Rp30.345.000 | Rp26.775.000 |
| Growth | 1.000 | 20% Starter, 45% Creator, 25% Pro, 10% Studio | Rp144.000 | Rp144.000.000 | Rp122.400.000 | Rp108.000.000 |

### 7.2 User-level example

A user buying **Creator Rp99.000 / 55.000 credits** can roughly produce:

```txt
10 chapters in Hemat mode
or 5–6 chapters in Seimbang mode
plus some intake/concept/publish actions
```

This creates natural upsell:

```txt
Starter → testing
Creator → first real mini-arc
Pro → one season draft chunk
Studio → active serial production
```

---

## 8. Unit economics notes

Current repo cost map contains Gemini 2.5 Flash pricing assumption:

```txt
Input:  $0.30 / 1M tokens
Output: $2.50 / 1M tokens
```

For a rough Hemat beat:

```txt
input: 8.000 tokens
output: 1.200 tokens
provider cost ≈ $0.0054
```

At Rp17.000/USD, this is roughly Rp92 provider cost before retry/overhead.

If a Hemat beat costs 800 credits:

- Starter revenue equivalent: 800 × Rp2,45 = Rp1.960
- Studio revenue equivalent: 800 × Rp1,33 = Rp1.064

So Hemat beat margin remains healthy even at discounted package tiers.

For `Terbaik`, do not scale aggressively until `model-cost-map.ts` includes the actual premium model cost. Current repo defaults include model names that are not all represented in the cost map, so premium economics must be reverified before public launch.

---

## 9. Migration plan

Do not edit old migrations. Add a new migration:

```txt
supabase/migrations/00011_credit_scale_v2_topup_products.sql
```

Recommended SQL:

```sql
INSERT INTO public.credit_topup_products (
  slug,
  name,
  description,
  price_idr,
  credits,
  bonus_credits,
  is_active,
  sort_order,
  metadata
) VALUES
  (
    'starter',
    'Paket Starter',
    '20.000 kredit untuk mencoba Narraza dan mulai menulis beberapa bab pertama.',
    49000,
    20000,
    0,
    true,
    10,
    '{"creditScaleVersion":"v2", "recommended": false}'::jsonb
  ),
  (
    'creator',
    'Paket Creator',
    '55.000 kredit — pilihan terbaik untuk membuat mini-arc awal dan beberapa bab pertama.',
    99000,
    50000,
    5000,
    true,
    20,
    '{"creditScaleVersion":"v2", "recommended": true, "bestSeller": true}'::jsonb
  ),
  (
    'pro',
    'Paket Pro',
    '130.000 kredit — untuk penulis yang mulai produksi serial secara rutin.',
    199000,
    120000,
    10000,
    true,
    30,
    '{"creditScaleVersion":"v2", "recommended": false}'::jsonb
  ),
  (
    'studio',
    'Paket Studio',
    '300.000 kredit — untuk produksi volume tinggi dan penulis serial aktif.',
    399000,
    270000,
    30000,
    true,
    40,
    '{"creditScaleVersion":"v2", "recommended": false, "volume": true}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_idr = EXCLUDED.price_idr,
  credits = EXCLUDED.credits,
  bonus_credits = EXCLUDED.bonus_credits,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  metadata = public.credit_topup_products.metadata || EXCLUDED.metadata,
  updated_at = now();
```

---

## 10. Code policy migration

### 10.1 `ai-credit-policy.ts`

Replace the current small table with v2 numbers:

```ts
const CREDIT_COST_TABLE = {
  prose_beat: {
    hemat: 800,
    seimbang: 1500,
    terbaik: 3000,
  },
  prose_rewrite: {
    hemat: 500,
    seimbang: 900,
    terbaik: 1800,
  },
  publish_copy: {
    hemat: 400,
    seimbang: 800,
    terbaik: 1500,
  },
  summary_delta: {
    hemat: null,
    seimbang: null,
    terbaik: null,
  },
};
```

### 10.2 Intake assistant

Replace hardcoded 1 credit with:

```ts
const INTAKE_ASSISTANT_CREDIT_COST = 150;
```

Use the same value for:

- `createGenerationAttempt.creditCost`
- `debitCreditsForAttempt.amount`
- `refundCreditsForAttempt.amount`

### 10.3 Concept generation

Replace hardcoded 3 credits with:

```ts
const CONCEPT_GENERATION_CREDIT_COST = 1000;
```

Use the same value for:

- `createGenerationAttempt.creditCost`
- `debitCreditsForAttempt.amount`
- `refundCreditsForAttempt.amount`

### 10.4 Future cleanup

Current intake/concept generators use `GENERATION_TYPES.publish_copy` as billing alias. For v2, add dedicated generation types later:

```txt
intake_assistant
concept_generation
foundation_generation
outline_generation
standalone_validation
```

Until then, metadata must continue recording:

```json
{
  "actualGenerationType": "intake_assistant",
  "billingAlias": "publish_copy"
}
```

---

## 11. Balance migration caution

If existing production users already have small-scale balances, decide one of these before applying v2:

### Option A — Founder/private beta only

Manually regrant founder/test balances in the new scale. Do not multiply historical balances.

Recommended while payment is off.

### Option B — Multiply existing balances

Add a one-time migration:

```sql
UPDATE public.credit_balances
SET balance = balance * 1000,
    monthly_quota = monthly_quota * 1000,
    monthly_used = monthly_used * 1000,
    source = 'ledger',
    updated_at = now();
```

Do **not** rewrite historical `credit_ledger` unless you explicitly want old ledger rows to match new reporting. For audit correctness, it is better to leave historical ledger intact and write an admin adjustment ledger entry per affected user.

### Recommended

Use Option A for private beta. Before paid public launch, seed all real users with v2 balances only.

---

## 12. Public launch recommendation

Use v2 credit scale only after these gates pass:

```txt
1. Update top-up package migration.
2. Update ai-credit-policy.ts.
3. Update intake/concept hardcoded costs.
4. Add smoke assertion: product catalog returns 20k/55k/130k/300k.
5. Add smoke assertion: prose beat Hemat debits 800.
6. Add smoke assertion: intake debits 150, concept debits 1000.
7. Confirm founder/test balance is converted or regranted.
8. Confirm AI per-user daily cap exists before public paid launch.
```

---

## 13. Final recommendation

Use the large-credit ladder:

```txt
Rp49.000  → 20.000 credits
Rp99.000  → 55.000 credits
Rp199.000 → 130.000 credits
Rp399.000 → 300.000 credits
```

Then price the most common action like this:

```txt
Generate beat:
Hemat    800
Seimbang 1.500
Terbaik  3.000
```

This gives users a large, satisfying balance while still keeping usage economics controlled across many AI features.
