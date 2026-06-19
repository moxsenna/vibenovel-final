# Credit System v2 Closure Report

**Date:** 2026-06-19

**Branch:** `codex/credit-v2-closure`

**Closure base:** `8ddd24604f6910d58ddaf84865d0965687537a65`

**Payment status:** OFF

**Decision:** **GO for local engineering closure; NO-GO for hosted rollout**

Hosted rollout remains blocked until staging credentials are available and the
founder explicitly approves production mutation. No staging or production
database, deployment, balance, ledger, or payment mutation was performed during
this closure.

## 1. Implementation commits

| Scope | Commit |
|---|---|
| Intake and Concept billed through mock provider | `bd51e57` |
| Uniform billed lifecycle for all mock AI routes | `af700a2` |
| Foundation and Outline credit transparency | `2071b6c` |
| Database-backed Credit v2 launch gate | `d441d6e` |
| OpenRouter catalog verification and routing constraints | `2d0e717` |
| Guarded migration operator | `81bd84b` |
| Browser-QA fix: sanitize AI failure notices | `8ddd246` |

The documentation closure commit is created after this report and the main
implementation plan are reviewed.

## 2. Verification summary

| Command / evidence | Exit | Result |
|---|---:|---|
| `powershell -ExecutionPolicy Bypass -File scripts/credit-system-v2-launch-gate.ps1` | 0 | PASS |
| `npm run test:e2e:credit-v2-foundation-outline -w @vibenovel/web` | 0 | 2/2 PASS |
| `npm run verify:openrouter-models -w @vibenovel/api` | 0 | 11 active verified; 2 incompatible rejected |
| `npm run operator:credit-v2:migrations -- -Environment local` | 0 | `PASS_ALREADY_APPLIED` |
| Staging operator preflight | 2 (blocked) | Missing hosted migration credentials; no mutation |
| Browser plugin QA against local Node API, local Supabase, and mock AI provider | n/a | PASS after one leak fix |

The final launch-gate run passed:

- Credit v2 contracts;
- API safety contracts;
- TypeScript typecheck;
- lint with **0 errors and 44 existing warnings**;
- production web build;
- Cloudflare Worker dry-run build;
- no-production-stubs policy;
- 26 database-backed billing checkpoints.

A prior gate attempt connected to the intentionally failing Browser-QA server
still occupying port 8799. After that local process was stopped, the clean rerun
above passed. This was an environment/process conflict, not a code regression.

## 3. Billing matrix: expected versus observed

| Feature | Expected credits | Observed evidence |
|---|---:|---|
| Intake AI reply | 100 | DB smoke debit 100; replay unchanged |
| Concept generate 3 | 1,000 | DB smoke debit 1,000; replay unchanged |
| Foundation setup | 2,000 | DB smoke debit 2,000; replay unchanged |
| Outline 10 chapters | 2,500 | DB smoke debit 2,500; replay unchanged |
| Chapter beats | 3 | DB smoke debit 3 |
| Chapter summary / delta | 500 | DB smoke debit 500 |
| Prose Hemat | 800 | DB smoke debit 800; replay unchanged |
| Prose Seimbang | 1,500 | DB smoke debit 1,500 |
| Prose Terbaik | 7,500 | DB smoke debit 7,500 |
| Rewrite Hemat | 500 | DB smoke debit 500 |
| Rewrite Seimbang | 900 | policy/UI contract and Browser QA |
| Rewrite Terbaik | 4,500 | policy/UI contract and Browser QA |
| Publish copy package | 400 | DB smoke debit 400; replay unchanged |

Additional billing assertions:

- provider failure produced one debit and one equal refund;
- final balance after provider failure returned to the starting balance;
- repeated idempotency keys did not create a second debit;
- client `model`, `provider`, and `creditCost` overrides were rejected;
- AI-disabled user messages remained free and created no generation attempt;
- debit metadata contained `featureKey`, `creditCost`,
  `creditPricingVersion=v2`, `generationAttemptId`, and `idempotencyKey`;
- public errors did not expose secrets or raw provider payloads.

## 4. Browser QA

Browser QA used the in-app Browser against:

- web: local Vite API-mode build;
- API: local Node build;
- database/auth: local Supabase;
- AI: deterministic mock provider only;
- payment: OFF.

| Surface | Browser observation |
|---|---|
| Intake | `AI reply ini memakai 100 kredit.` |
| Concept | `Buat 3 konsep — 1.000 kredit.` |
| Foundation | `Biaya: 2.000 kredit`; no quality selector |
| Outline | `Biaya: 2.500 kredit`; no quality selector |
| Prose Hemat / Seimbang / Terbaik | 800 / 1,500 / 7,500 |
| Rewrite Hemat / Seimbang / Terbaik | 500 / 900 / 4,500 |
| Terbaik warning | `Mode Terbaik memakai 7.500 kredit...` visible before spend |
| Publish | `Biaya: 400 kredit`; no quality selector |
| Success | `400 kredit digunakan. Sisa kredit: 89.597.` |
| Failure | `Layanan AI sedang tidak tersedia. Kredit tidak terpakai atau sudah dikembalikan otomatis.` |

The first real provider-failure fixture exposed the mock diagnostic message in
the Foundation notice. Commit `8ddd246` added a failing regression contract,
mapped provider-class errors to safe copy, and removed raw
`ApiClientError.message` interpolation. The same Browser scenario then showed
the safe failure copy with no `mock`, provider, model, token, or OpenRouter
diagnostics.

Auditable Browser references:

- `apps/web/e2e/credit-v2-foundation-outline.spec.ts`;
- `apps/web/scripts/credit-transparency-ui-contracts.test.mts`;
- this run's Browser DOM snapshots and local fixture assertions.

The Browser screenshot command itself timed out at the CDP capture boundary, so
the closure uses DOM snapshots plus the passing Playwright E2E as the retained
visual/interaction evidence.

## 5. Model routing verification

Read-only catalog verification used:

`https://openrouter.ai/api/v1/models`

No generation request and no paid model sweep was sent.

- 11 production routing records: `VERIFIED`;
- `anthropic/claude-opus-4.8`: rejected because the catalog did not advertise
  the required `temperature` parameter;
- `openai/gpt-5.2`: rejected for the same incompatibility;
- Terbaik routes to verified `anthropic/claude-opus-4.6`, with verified
  `google/gemini-3.1-pro-preview` fallback;
- changing routing did not change user credit prices.

Full catalog evidence:
[20-credit-v2-model-verification-2026-06-19.md](20-credit-v2-model-verification-2026-06-19.md).

## 6. Migration and top-up status

| Environment | Status | Evidence |
|---|---|---|
| Local | PASS | migrations 00017-00021 applied; products and FK integrity pass |
| Staging | BLOCKED | `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` unavailable |
| Production | NOT RUN | read-only preflight belongs to Task 8; mutation requires founder approval |

Local active products were verified:

| Product | Base | Bonus | Total |
|---|---:|---:|---:|
| Starter | 20,000 | 0 | 20,000 |
| Creator | 50,000 | 5,000 | 55,000 |
| Pro | 120,000 | 10,000 | 130,000 |
| Studio | 270,000 | 30,000 | 300,000 |

A temporary historical order remained readable with its original product
foreign key. Old products are retired through `is_active`, not deletion.

Operator evidence:
[21-credit-v2-migration-preflight-2026-06-19.md](21-credit-v2-migration-preflight-2026-06-19.md).

## 7. Payment and mutation safety

- `CREDIT_TOPUP_ENABLED=false`;
- health checks reported payment OFF in success, provider-failure, and
  AI-disabled modes;
- the migration operator blocked hosted work without credentials;
- no balances were multiplied or rewritten;
- no historical ledger rows were changed;
- no hosted payment behavior was enabled.

## 8. Residual risks and launch decision

Known residual risks:

1. Staging migration/deployment smoke cannot run without hosted Supabase
   credentials.
2. Production migration and deployment have not been applied.
3. No paid live OpenRouter generation sweep was run; catalog compatibility and
   deterministic mock integration are the current evidence.
4. Lint has 44 pre-existing warnings, but zero errors.
5. Private-beta balance adjustments remain a founder-operated, audited decision;
   no automatic scaling was implemented.

Decision:

- **GO** — implementation, local migration, billing lifecycle, UI transparency,
  routing verification, rollback controls, and local launch gate.
- **NO-GO** — staging/production rollout until hosted preflight succeeds and the
  founder supplies explicit approval for mutation.
