import assert from "node:assert/strict";
import {
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
} from "@vibenovel/shared";
import {
  buildLedgerMetadata,
  resolveRefundAmountFromDebit,
} from "../src/services/credit-ledger.ts";

const debitMetadata = buildLedgerMetadata({
  userId: "00000000-0000-4000-8000-000000000001",
  projectId: "00000000-0000-4000-8000-000000000002",
  attemptId: "00000000-0000-4000-8000-000000000003",
  amount: 10,
  reason: "generation_debit",
  generationType: GENERATION_TYPES.prose_beat,
  qualityMode: WRITER_QUALITY_MODES.seimbang,
  idempotencyKey: "credit-ledger-v2-test",
  correlationId: "correlation-test",
  creditPricingVersion: "v1",
  modelRoutingVersion: "v1",
});

assert.deepEqual(
  {
    featureKey: debitMetadata.featureKey,
    qualityMode: debitMetadata.qualityMode,
    creditCost: debitMetadata.creditCost,
    creditPricingVersion: debitMetadata.creditPricingVersion,
    modelRoutingVersion: debitMetadata.modelRoutingVersion,
    generationAttemptId: debitMetadata.generationAttemptId,
    idempotencyKey: debitMetadata.idempotencyKey,
  },
  {
    featureKey: "prose_beat",
    qualityMode: "seimbang",
    creditCost: 10,
    creditPricingVersion: "v1",
    modelRoutingVersion: "v1",
    generationAttemptId: "00000000-0000-4000-8000-000000000003",
    idempotencyKey: "credit-ledger-v2-test",
  },
  "debit metadata must contain the complete pricing snapshot",
);

const defaultVersionMetadata = buildLedgerMetadata({
  userId: "00000000-0000-4000-8000-000000000001",
  projectId: "00000000-0000-4000-8000-000000000002",
  attemptId: "00000000-0000-4000-8000-000000000004",
  amount: 100,
  reason: "generation_debit",
  generationType: GENERATION_TYPES.intake_assistant,
  qualityMode: WRITER_QUALITY_MODES.hemat,
});
assert.equal(defaultVersionMetadata.creditPricingVersion, "v2");
assert.equal(defaultVersionMetadata.modelRoutingVersion, "v2");

assert.equal(
  resolveRefundAmountFromDebit({ amount: 10 }),
  10,
  "refund amount must be sourced from the original debit",
);

const refundMetadata = buildLedgerMetadata(
  {
    userId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    attemptId: "00000000-0000-4000-8000-000000000003",
    amount: 999,
    reason: "generation_refund",
    generationType: GENERATION_TYPES.prose_beat,
    qualityMode: WRITER_QUALITY_MODES.terbaik,
    idempotencyKey: "credit-ledger-v2-test",
    creditPricingVersion: "v99",
    modelRoutingVersion: "v99",
  },
  debitMetadata,
);

assert.equal(
  refundMetadata.creditCost,
  10,
  "refund snapshot must preserve the original debit cost",
);
assert.equal(
  refundMetadata.qualityMode,
  "seimbang",
  "refund snapshot must preserve the original debit quality mode",
);
assert.equal(
  refundMetadata.creditPricingVersion,
  "v1",
  "refund snapshot must preserve the original pricing version",
);
assert.equal(
  refundMetadata.modelRoutingVersion,
  "v1",
  "refund snapshot must preserve the original routing version",
);

console.log("PASS credit ledger v2 Phase 2 contracts");
