import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { mapCreditTopupOrderRow, type CreditTopupOrderRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import { sanitizeAuditMetadata } from "./audit-snapshot.js";

export interface GrantCreditsForPaymentSessionInput {
  orderId: string;
  webhookEventId?: string;
  correlationId?: string;
  validateAmountIdr?: number;
  validateProviderInvoiceId?: string | null;
  validateProviderTransactionId?: string | null;
}

export interface GrantCreditsForPaymentSessionResult {
  orderId: string;
  userId: string;
  creditsGranted: number;
  balanceAfter: number;
  ledgerEntryId: string;
  alreadyGranted: boolean;
}

interface AtomicGrantRpcResult {
  granted: boolean;
  already_granted: boolean;
  order_id?: string;
  user_id?: string;
  credits?: number;
  previous_balance?: number | null;
  new_balance?: number | null;
  ledger_id?: string | null;
  reason?: string | null;
}

async function loadTopupOrderRow(
  bindings: AppBindings,
  orderId: string,
): Promise<CreditTopupOrderRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_topup_orders")
    .select(
      "id, user_id, product_id, provider, provider_invoice_id, provider_transaction_id, payment_url, amount_idr, credits_to_grant, status, idempotency_key, provider_payload_safe, paid_at, expires_at, metadata, created_at, updated_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("credit_topup_orders select failed");
    throw AppError.internal("Failed to load topup order");
  }

  return (data as CreditTopupOrderRow | null) ?? null;
}

export async function findCreditTopupOrderForWebhook(
  bindings: AppBindings,
  input: {
    orderId?: string | null;
    providerInvoiceId?: string | null;
    providerTransactionId?: string | null;
  },
): Promise<CreditTopupOrderRow | null> {
  if (input.orderId) {
    const byId = await loadTopupOrderRow(bindings, input.orderId);
    if (byId) return byId;
  }

  const admin = createServiceRoleClient(bindings);

  if (input.providerInvoiceId) {
    const { data, error } = await admin
      .from("credit_topup_orders")
      .select(
        "id, user_id, product_id, provider, provider_invoice_id, provider_transaction_id, payment_url, amount_idr, credits_to_grant, status, idempotency_key, provider_payload_safe, paid_at, expires_at, metadata, created_at, updated_at",
      )
      .eq("provider_invoice_id", input.providerInvoiceId)
      .maybeSingle();
    if (error) {
      console.error("credit_topup_orders invoice lookup failed");
      throw AppError.internal("Failed to resolve topup order by invoice id");
    }
    if (data) return data as CreditTopupOrderRow;
  }

  if (input.providerTransactionId) {
    const { data, error } = await admin
      .from("credit_topup_orders")
      .select(
        "id, user_id, product_id, provider, provider_invoice_id, provider_transaction_id, payment_url, amount_idr, credits_to_grant, status, idempotency_key, provider_payload_safe, paid_at, expires_at, metadata, created_at, updated_at",
      )
      .eq("provider_transaction_id", input.providerTransactionId)
      .maybeSingle();
    if (error) {
      console.error("credit_topup_orders transaction lookup failed");
      throw AppError.internal("Failed to resolve topup order by transaction id");
    }
    if (data) return data as CreditTopupOrderRow;
  }

  return null;
}

function mapRpcFailureToAppError(reason: string): AppError {
  switch (reason) {
    case "unknown_order":
      return AppError.notFound("Topup order not found");
    case "amount_mismatch":
      return new AppError(
        "PAYMENT_WEBHOOK_AMOUNT_MISMATCH",
        "Webhook amount does not match order amount",
        422,
      );
    case "provider_mismatch":
      return new AppError(
        "PAYMENT_WEBHOOK_VALIDATION_FAILED",
        "Provider does not match order",
        422,
      );
    case "paid_without_ledger":
      return new AppError(
        "CREDIT_TOPUP_ALREADY_PAID",
        "Order is paid but no topup ledger entry was found",
        409,
      );
    case "invalid_status":
      return new AppError(
        "CREDIT_TOPUP_NOT_ELIGIBLE",
        "Order status is not eligible for credit grant",
        422,
      );
    case "invalid_credits":
      return new AppError(
        "CREDIT_TOPUP_NOT_ELIGIBLE",
        "Order credits_to_grant is invalid",
        422,
      );
    default:
      return AppError.internal("Atomic credit topup grant failed");
  }
}

async function callAtomicGrantRpc(
  bindings: AppBindings,
  input: {
    orderId: string;
    provider: string;
    providerInvoiceId: string | null;
    providerTransactionId: string | null;
    amountIdr: number;
    webhookEventId?: string;
    correlationId?: string;
    productId: string;
  },
): Promise<AtomicGrantRpcResult> {
  const admin = createServiceRoleClient(bindings);
  const metadata = sanitizeAuditMetadata({
    orderId: input.orderId,
    productId: input.productId,
    provider: input.provider,
    providerInvoiceId: input.providerInvoiceId,
    providerTransactionId: input.providerTransactionId,
    webhookEventId: input.webhookEventId ?? null,
    correlationId: input.correlationId ?? null,
  });

  const { data, error } = await admin.rpc("grant_paid_credit_topup_atomic", {
    p_order_id: input.orderId,
    p_provider: input.provider,
    p_provider_invoice_id: input.providerInvoiceId,
    p_provider_transaction_id: input.providerTransactionId,
    p_amount_idr: input.amountIdr,
    p_webhook_event_id: input.webhookEventId ?? null,
    p_metadata: metadata,
  });

  if (error) {
    console.error("grant_paid_credit_topup_atomic rpc failed", error.code);
    throw AppError.internal("Atomic credit topup grant failed");
  }

  return data as AtomicGrantRpcResult;
}

function validateProviderIds(
  order: CreditTopupOrderRow,
  input: GrantCreditsForPaymentSessionInput,
): void {
  if (
    input.validateProviderInvoiceId &&
    order.provider_invoice_id &&
    input.validateProviderInvoiceId !== order.provider_invoice_id
  ) {
    throw new AppError(
      "PAYMENT_WEBHOOK_VALIDATION_FAILED",
      "Provider invoice id does not match order",
      422,
    );
  }

  if (
    input.validateProviderTransactionId &&
    order.provider_transaction_id &&
    input.validateProviderTransactionId !== order.provider_transaction_id
  ) {
    throw new AppError(
      "PAYMENT_WEBHOOK_VALIDATION_FAILED",
      "Provider transaction id does not match order",
      422,
    );
  }
}

/**
 * Grant credits for a paid topup order — webhook-only entry point.
 * Atomic DB RPC: order paid + ledger + balance in one Postgres transaction.
 */
export async function grantCreditsForPaymentSession(
  bindings: AppBindings,
  input: GrantCreditsForPaymentSessionInput,
): Promise<GrantCreditsForPaymentSessionResult> {
  const orderRow = await loadTopupOrderRow(bindings, input.orderId);
  if (!orderRow) {
    throw AppError.notFound("Topup order not found");
  }

  const order = mapCreditTopupOrderRow(orderRow);
  const userId = order.userId;

  if (!order.paymentUrl) {
    throw new AppError(
      "CREDIT_TOPUP_NOT_ELIGIBLE",
      "Order has no payment URL — checkout was not completed",
      422,
    );
  }

  if (
    input.validateAmountIdr !== undefined &&
    input.validateAmountIdr !== order.amountIdr
  ) {
    throw new AppError(
      "PAYMENT_WEBHOOK_AMOUNT_MISMATCH",
      "Webhook amount does not match order amount",
      422,
    );
  }

  validateProviderIds(orderRow, input);

  let rpcResult: AtomicGrantRpcResult;
  try {
    rpcResult = await callAtomicGrantRpc(bindings, {
      orderId: order.id,
      provider: order.provider,
      providerInvoiceId: order.providerInvoiceId,
      providerTransactionId: order.providerTransactionId,
      amountIdr: order.amountIdr,
      webhookEventId: input.webhookEventId,
      correlationId: input.correlationId,
      productId: order.productId,
    });
  } catch (err) {
    await writeAuditLog(bindings, {
      userId,
      action: AUDIT_ACTIONS.credit_topup_grant_failed,
      entityType: AUDIT_ENTITY_TYPES.credit_topup_order,
      entityId: order.id,
      metadata: {
        orderId: order.id,
        webhookEventId: input.webhookEventId ?? null,
        reason: err instanceof AppError ? err.code : "internal_error",
      },
    });
    if (err instanceof AppError) throw err;
    throw AppError.internal("Credit topup grant failed");
  }

  if (rpcResult.already_granted && rpcResult.ledger_id && rpcResult.user_id) {
    return {
      orderId: rpcResult.order_id ?? order.id,
      userId: rpcResult.user_id,
      creditsGranted: rpcResult.credits ?? order.creditsToGrant,
      balanceAfter: rpcResult.new_balance ?? 0,
      ledgerEntryId: rpcResult.ledger_id,
      alreadyGranted: true,
    };
  }

  if (!rpcResult.granted) {
    const reason = rpcResult.reason ?? "grant_failed";
    await writeAuditLog(bindings, {
      userId,
      action: AUDIT_ACTIONS.credit_topup_grant_failed,
      entityType: AUDIT_ENTITY_TYPES.credit_topup_order,
      entityId: order.id,
      metadata: {
        orderId: order.id,
        webhookEventId: input.webhookEventId ?? null,
        reason,
      },
    });
    throw mapRpcFailureToAppError(reason);
  }

  if (
    !rpcResult.ledger_id ||
    rpcResult.user_id === undefined ||
    rpcResult.new_balance === undefined ||
    rpcResult.new_balance === null
  ) {
    throw AppError.internal("Atomic grant RPC returned incomplete success payload");
  }

  const balanceAfter = rpcResult.new_balance;
  const creditsGranted = rpcResult.credits ?? order.creditsToGrant;

  await writeAuditLog(bindings, {
    userId,
    action: AUDIT_ACTIONS.credit_topup_granted,
    entityType: AUDIT_ENTITY_TYPES.credit_topup_order,
    entityId: order.id,
    metadata: {
      orderId: order.id,
      creditsGranted,
      balanceAfter,
      ledgerEntryId: rpcResult.ledger_id,
      webhookEventId: input.webhookEventId ?? null,
      grantPath: "atomic_rpc",
    },
  });

  return {
    orderId: order.id,
    userId,
    creditsGranted,
    balanceAfter,
    ledgerEntryId: rpcResult.ledger_id,
    alreadyGranted: false,
  };
}