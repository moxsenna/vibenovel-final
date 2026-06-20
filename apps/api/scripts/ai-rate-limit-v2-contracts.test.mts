/**
 * AI Rate Limit v2 — contract tests.
 *
 * Memverifikasi bahwa DEFAULT_DAILY_DEBIT_CAP_V2 >= max configured action cost
 * dan guard rate limit bekerja pada aksi valid termahal.
 *
 * Run: npm run test:ai-rate-limit-v2 -w @vibenovel/api
 */
import assert from "node:assert/strict";
import {
  DEFAULT_DAILY_DEBIT_CAP_V2,
  getMaximumConfiguredCreditCost,
} from "../src/services/ai-credit-policy.js";
import { assertAiGenerationAllowed } from "../src/services/ai-rate-limit.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    if (e instanceof assert.AssertionError) {
      console.log(`      ${e.message}`);
    } else {
      console.error(`      ${e}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  1. Invariant: default cap >= max configured cost                   */
/* ------------------------------------------------------------------ */

test(
  "DEFAULT_DAILY_DEBIT_CAP_V2 >= getMaximumConfiguredCreditCost()",
  () => {
    const maxCost = getMaximumConfiguredCreditCost();
    assert.ok(
      DEFAULT_DAILY_DEBIT_CAP_V2 >= maxCost,
      `default daily cap ${DEFAULT_DAILY_DEBIT_CAP_V2} must allow at least one ` +
        `highest-cost action (${maxCost})`,
    );
  },
);

/* ------------------------------------------------------------------ */
/*  2. Guard allows highest-cost action when under cap                 */
/* ------------------------------------------------------------------ */

test(
  "assertAiGenerationAllowed passes for highest-cost action within budget",
  () => {
    const maxCost = getMaximumConfiguredCreditCost();
    assert.doesNotThrow(() =>
      assertAiGenerationAllowed({
        dailyDebitedCredits: 0,
        dailyDebitCap: DEFAULT_DAILY_DEBIT_CAP_V2,
        recentFailureCount: 0,
        cooldownFailureThreshold: 3,
      }, maxCost),
    );
  },
);

/* ------------------------------------------------------------------ */
/*  3. Guard blocks when cap exceeded                                  */
/* ------------------------------------------------------------------ */

test(
  "assertAiGenerationAllowed throws when cap exceeded",
  () => {
    const maxCost = getMaximumConfiguredCreditCost();
    assert.throws(
      () =>
        assertAiGenerationAllowed({
          dailyDebitedCredits: DEFAULT_DAILY_DEBIT_CAP_V2,
          dailyDebitCap: DEFAULT_DAILY_DEBIT_CAP_V2,
          recentFailureCount: 0,
          cooldownFailureThreshold: 3,
        }, maxCost),
      (err: unknown) =>
        (err as { code?: string }).code === "AI_DAILY_CAP_EXCEEDED",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  4. Guard blocks on failure cooldown                                */
/* ------------------------------------------------------------------ */

test(
  "assertAiGenerationAllowed throws when failures exceed threshold",
  () => {
    assert.throws(
      () =>
        assertAiGenerationAllowed({
          dailyDebitedCredits: 0,
          dailyDebitCap: DEFAULT_DAILY_DEBIT_CAP_V2,
          recentFailureCount: 3,
          cooldownFailureThreshold: 3,
        }, 0),
      (err: unknown) =>
        (err as { code?: string }).code === "AI_FAILURE_COOLDOWN",
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

console.log(`\n=== AI Rate Limit v2 Contracts ===`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  DEFAULT_DAILY_DEBIT_CAP_V2: ${DEFAULT_DAILY_DEBIT_CAP_V2}`);
console.log(`  Maximum configured credit cost: ${getMaximumConfiguredCreditCost()}`);
console.log(`==================================\n`);

process.exit(failed > 0 ? 1 : 0);
