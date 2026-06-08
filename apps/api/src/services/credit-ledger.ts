import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  CREDIT_LEDGER_DIRECTIONS,
  type CreditLedgerDirection,
  type CreditLedgerEntry,
  type GenerationType,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import {
  mapCreditLedgerRow,
  type CreditBalanceRow,
  type CreditLedgerRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import { sanitizeAuditMetadata } from "./audit-snapshot.js";
import { getCreditBalanceForUser, preflightCreditBalance } from "./credit.js";
import { TransactionPlan } from "./transaction.js";

export const CREDIT_LEDGER_REASONS = {
  generationDebit: "generation_debit",
  generationRefund: "generation_refund",
} as const;

export interface CreditMutationBaseInput {
  userId: string;
  projectId: string;
  attemptId: string;
  amount: number;
  reason: string;
  generationType?: GenerationType;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface CreditLedgerOperationResult {
  ledgerEntry: CreditLedgerEntry;
  balanceAfter: number;
  idempotentReplay: boolean;
}

function assertPositiveAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError(
      "CREDIT_INVALID_AMOUNT",
      "Credit amount must be a positive integer",
      400,
    );
  }
}

function buildLedgerMetadata(input: CreditMutationBaseInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (input.idempotencyKey) metadata.idempotencyKey = input.idempotencyKey;
  if (input.correlationId) metadata.correlationId = input.correlationId;
  if (input.generationType) metadata.generationType = input.generationType;
  return sanitizeAuditMetadata(metadata);
}

async function findExistingLedgerEntry(
  bindings: AppBindings,
  input: {
    userId: string;
    attemptId: string;
    reason: string;
    direction: CreditLedgerDirection;
  },
): Promise<CreditLedgerEntry | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_ledger")
    .select(
      "id, user_id, project_id, attempt_id, amount, direction, reason, balance_after, metadata, created_at",
    )
    .eq("user_id", input.userId)
    .eq("attempt_id", input.attemptId)
    .eq("reason", input.reason)
    .eq("direction", input.direction)
    .maybeSingle();

  if (error) {
    console.error("credit_ledger idempotency lookup failed");
    throw new AppError(
      "CREDIT_LEDGER_CONFLICT",
      "Failed to verify credit ledger idempotency",
      409,
    );
  }

  if (!data) return null;
  return mapCreditLedgerRow(data as CreditLedgerRow);
}

async function loadBalanceRow(
  bindings: AppBindings,
  userId: string,
): Promise<CreditBalanceRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_balances")
    .select("id, user_id, balance, monthly_quota, monthly_used, reset_at, source, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("credit_balances select failed");
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Failed to load credit balance",
      500,
    );
  }

  return (data as CreditBalanceRow | null) ?? null;
}

async function updateBalance(
  bindings: AppBindings,
  userId: string,
  expectedBalance: number,
  nextBalance: number,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_balances")
    .update({ balance: nextBalance })
    .eq("user_id", userId)
    .eq("balance", expectedBalance)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("credit_balances update failed");
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Failed to update credit balance",
      500,
    );
  }

  if (!data) {
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Credit balance changed concurrently; retry required",
      409,
    );
  }
}

async function insertLedgerRow(
  bindings: AppBindings,
  input: {
    userId: string;
    projectId: string;
    attemptId: string;
    amount: number;
    direction: CreditLedgerDirection;
    reason: string;
    balanceAfter: number;
    metadata: Record<string, unknown>;
  },
): Promise<CreditLedgerEntry> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_ledger")
    .insert({
      user_id: input.userId,
      project_id: input.projectId,
      attempt_id: input.attemptId,
      amount: input.amount,
      direction: input.direction,
      reason: input.reason,
      balance_after: input.balanceAfter,
      metadata: input.metadata,
    })
    .select(
      "id, user_id, project_id, attempt_id, amount, direction, reason, balance_after, metadata, created_at",
    )
    .single();

  if (error) {
    console.error("credit_ledger insert failed");
    throw new AppError(
      "CREDIT_LEDGER_CONFLICT",
      "Failed to write credit ledger entry",
      409,
    );
  }

  return mapCreditLedgerRow(data as CreditLedgerRow);
}

async function deleteLedgerRow(bindings: AppBindings, ledgerId: string): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { error } = await admin.from("credit_ledger").delete().eq("id", ledgerId);
  if (error) {
    console.error("credit_ledger compensation delete failed");
  }
}

async function writeCreditAudit(
  bindings: AppBindings,
  input: {
    userId: string;
    projectId: string;
    action: typeof AUDIT_ACTIONS.credit_debited | typeof AUDIT_ACTIONS.credit_refunded;
    ledgerEntry: CreditLedgerEntry;
    generationType?: GenerationType;
    correlationId?: string;
  },
): Promise<void> {
  await writeAuditLog(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: input.action,
    entityType: AUDIT_ENTITY_TYPES.credit_ledger_entry,
    entityId: input.ledgerEntry.id,
    metadata: sanitizeAuditMetadata({
      attemptId: input.ledgerEntry.attemptId,
      amount: input.ledgerEntry.amount,
      balanceAfter: input.ledgerEntry.balanceAfter,
      reason: input.ledgerEntry.reason,
      generationType: input.generationType,
      correlationId: input.correlationId,
      direction: input.ledgerEntry.direction,
    }),
  });
}

export { preflightCreditBalance };

/**
 * Debit credits for a generation attempt — idempotent per attemptId + reason.
 * Transaction-like: ledger insert then balance update with compensation on failure.
 * True Postgres RPC deferred to pre-production.
 */
export async function debitCreditsForAttempt(
  bindings: AppBindings,
  input: CreditMutationBaseInput,
): Promise<CreditLedgerOperationResult> {
  assertPositiveAmount(input.amount);

  const existing = await findExistingLedgerEntry(bindings, {
    userId: input.userId,
    attemptId: input.attemptId,
    reason: input.reason,
    direction: CREDIT_LEDGER_DIRECTIONS.debit,
  });
  if (existing) {
    return {
      ledgerEntry: existing,
      balanceAfter: existing.balanceAfter,
      idempotentReplay: true,
    };
  }

  const balanceRow = await loadBalanceRow(bindings, input.userId);
  if (!balanceRow || balanceRow.balance < input.amount) {
    throw new AppError(
      "INSUFFICIENT_CREDIT",
      "Insufficient credit balance",
      402,
    );
  }

  const balanceAfter = balanceRow.balance - input.amount;
  const metadata = buildLedgerMetadata(input);
  const plan = new TransactionPlan();
  let ledgerEntry: CreditLedgerEntry | null = null;

  try {
    await plan.run(async () => {
      ledgerEntry = await insertLedgerRow(bindings, {
        userId: input.userId,
        projectId: input.projectId,
        attemptId: input.attemptId,
        amount: input.amount,
        direction: CREDIT_LEDGER_DIRECTIONS.debit,
        reason: input.reason,
        balanceAfter,
        metadata,
      });

      plan.registerCompensation(async () => {
        if (ledgerEntry) {
          await deleteLedgerRow(bindings, ledgerEntry.id);
        }
      });

      await updateBalance(bindings, input.userId, balanceRow.balance, balanceAfter);
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Credit debit failed",
      500,
    );
  }

  if (!ledgerEntry) {
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Credit debit did not produce a ledger entry",
      500,
    );
  }

  await writeCreditAudit(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: AUDIT_ACTIONS.credit_debited,
    ledgerEntry,
    generationType: input.generationType,
    correlationId: input.correlationId,
  });

  return {
    ledgerEntry,
    balanceAfter,
    idempotentReplay: false,
  };
}

/**
 * Refund credits for a failed generation — idempotent per attemptId + reason.
 * Requires a prior debit for the same attempt unless replaying existing refund.
 */
export async function refundCreditsForAttempt(
  bindings: AppBindings,
  input: CreditMutationBaseInput,
): Promise<CreditLedgerOperationResult> {
  assertPositiveAmount(input.amount);

  const existingRefund = await findExistingLedgerEntry(bindings, {
    userId: input.userId,
    attemptId: input.attemptId,
    reason: input.reason,
    direction: CREDIT_LEDGER_DIRECTIONS.refund,
  });
  if (existingRefund) {
    return {
      ledgerEntry: existingRefund,
      balanceAfter: existingRefund.balanceAfter,
      idempotentReplay: true,
    };
  }

  const existingDebit = await findExistingLedgerEntry(bindings, {
    userId: input.userId,
    attemptId: input.attemptId,
    reason: CREDIT_LEDGER_REASONS.generationDebit,
    direction: CREDIT_LEDGER_DIRECTIONS.debit,
  });
  if (!existingDebit) {
    throw new AppError(
      "CREDIT_REFUND_NOT_FOUND",
      "No debit found for this generation attempt",
      404,
    );
  }

  const balanceRow = await loadBalanceRow(bindings, input.userId);
  if (!balanceRow) {
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Credit balance row not found for refund",
      500,
    );
  }

  const balanceAfter = balanceRow.balance + input.amount;
  const metadata = buildLedgerMetadata(input);
  const plan = new TransactionPlan();
  let ledgerEntry: CreditLedgerEntry | null = null;

  try {
    await plan.run(async () => {
      ledgerEntry = await insertLedgerRow(bindings, {
        userId: input.userId,
        projectId: input.projectId,
        attemptId: input.attemptId,
        amount: input.amount,
        direction: CREDIT_LEDGER_DIRECTIONS.refund,
        reason: input.reason,
        balanceAfter,
        metadata,
      });

      plan.registerCompensation(async () => {
        if (ledgerEntry) {
          await deleteLedgerRow(bindings, ledgerEntry.id);
        }
      });

      await updateBalance(bindings, input.userId, balanceRow.balance, balanceAfter);
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Credit refund failed",
      500,
    );
  }

  if (!ledgerEntry) {
    throw new AppError(
      "CREDIT_BALANCE_UPDATE_FAILED",
      "Credit refund did not produce a ledger entry",
      500,
    );
  }

  await writeCreditAudit(bindings, {
    userId: input.userId,
    projectId: input.projectId,
    action: AUDIT_ACTIONS.credit_refunded,
    ledgerEntry,
    generationType: input.generationType,
    correlationId: input.correlationId,
  });

  return {
    ledgerEntry,
    balanceAfter,
    idempotentReplay: false,
  };
}

/** Read current balance — convenience for orchestrators (Task 8.4). */
export async function getCurrentCreditBalance(
  bindings: AppBindings,
  userId: string,
): Promise<number> {
  const balance = await getCreditBalanceForUser(bindings, userId);
  return balance?.balance ?? 0;
}