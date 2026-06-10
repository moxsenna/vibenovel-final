import { PAYMENT_WEBHOOK_PROCESSING_STATUSES } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  getDuitkuCallbackMerchantCode,
  getDuitkuCallbackMerchantKey,
  isCreditTopupEnabled,
} from "../env.js";
import { AppError } from "../errors.js";
import { grantCreditsForPaymentSession, findCreditTopupOrderForWebhook } from "./credit-topup-grant.js";
import type { JsonObject } from "@vibenovel/shared";
import {
  buildDuitkuSignatureDiagnostics,
  normalizeDuitkuCallback,
  parseDuitkuCallbackRequest,
  validateDuitkuCallbackSignature,
  type DuitkuCallbackFormFields,
} from "./duitku-callback.js";
import {
  markPaymentWebhookEventStatus,
  persistPaymentWebhookEvent,
} from "./payment-webhook-event.js";

export interface DuitkuCallbackProcessResult {
  ok: boolean;
  duplicate: boolean;
  granted: boolean;
  alreadyGranted: boolean;
  ignored: boolean;
  failed: boolean;
  orderId: string | null;
  reason: string | null;
  webhookEventId: string | null;
}

function assertTopupWebhookEnabled(bindings: AppBindings): void {
  if (!isCreditTopupEnabled(bindings)) {
    throw new AppError(
      "TOPUP_DISABLED",
      "Credit topup webhook processing is disabled",
      503,
    );
  }
}

async function persistAndFail(
  bindings: AppBindings,
  parsed: DuitkuCallbackFormFields,
  reason: string,
  auditUserId: string | null,
  orderId: string | null,
  extraPayloadSafe: JsonObject = {},
): Promise<DuitkuCallbackProcessResult> {
  const normalized = await normalizeDuitkuCallback(parsed, extraPayloadSafe);
  const persisted = await persistPaymentWebhookEvent(
    bindings,
    {
      provider: "duitku",
      providerEventId: normalized.providerEventId,
      providerTransactionId: normalized.providerTransactionId,
      providerInvoiceId: normalized.providerInvoiceId,
      eventType: normalized.eventType,
      payloadHash: normalized.payloadHash,
      payloadSafeJson: normalized.payloadSafe,
    },
    auditUserId,
  );

  await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
    processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
    errorMessageSafe: reason,
    userId: auditUserId,
    orderId,
  });

  return {
    ok: true,
    duplicate: persisted.isDuplicate,
    granted: false,
    alreadyGranted: false,
    ignored: false,
    failed: true,
    orderId,
    reason,
    webhookEventId: persisted.event.id,
  };
}

export async function processDuitkuPaymentCallback(
  bindings: AppBindings,
  request: Request,
): Promise<DuitkuCallbackProcessResult> {
  assertTopupWebhookEnabled(bindings);

  const configuredCode = getDuitkuCallbackMerchantCode(bindings);
  const configuredKey = getDuitkuCallbackMerchantKey(bindings);
  if (!configuredCode || !configuredKey) {
    throw new AppError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Duitku callback credentials are not configured",
      503,
    );
  }

  const parsed = await parseDuitkuCallbackRequest(request);

  if (parsed.merchantCode !== configuredCode) {
    return persistAndFail(bindings, parsed, "merchant_code_mismatch", null, null);
  }

  if (!(await validateDuitkuCallbackSignature(parsed, configuredKey))) {
    const diagnostic = await buildDuitkuSignatureDiagnostics(parsed, configuredKey);
    return persistAndFail(bindings, parsed, "invalid_signature", null, null, {
      signatureDiagnostic: diagnostic as unknown as JsonObject,
    });
  }

  const normalized = await normalizeDuitkuCallback(parsed);

  const orderForAudit = await findCreditTopupOrderForWebhook(bindings, {
    orderId: normalized.orderId,
    providerInvoiceId: normalized.providerInvoiceId,
    providerTransactionId: normalized.providerTransactionId,
  });

  const persisted = await persistPaymentWebhookEvent(
    bindings,
    {
      provider: "duitku",
      providerEventId: normalized.providerEventId,
      providerTransactionId: normalized.providerTransactionId,
      providerInvoiceId: normalized.providerInvoiceId,
      eventType: normalized.eventType,
      payloadHash: normalized.payloadHash,
      payloadSafeJson: normalized.payloadSafe,
    },
    orderForAudit?.user_id ?? null,
  );

  const baseResult: DuitkuCallbackProcessResult = {
    ok: true,
    duplicate: persisted.isDuplicate,
    granted: false,
    alreadyGranted: false,
    ignored: false,
    failed: false,
    orderId: null,
    reason: null,
    webhookEventId: persisted.event.id,
  };

  if (persisted.isDuplicate && persisted.alreadyTerminal) {
    return {
      ...baseResult,
      duplicate: true,
      reason: persisted.event.processingStatus,
    };
  }

  if (!normalized.isPaid) {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.ignored,
      errorMessageSafe: "payment_not_paid",
      userId: orderForAudit?.user_id ?? null,
      orderId: orderForAudit?.id ?? null,
    });
    return {
      ...baseResult,
      ignored: true,
      orderId: orderForAudit?.id ?? null,
      reason: "payment_not_paid",
    };
  }

  const orderRow = orderForAudit;

  if (!orderRow) {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
      errorMessageSafe: "order_not_found",
    });
    return {
      ...baseResult,
      failed: true,
      reason: "order_not_found",
    };
  }

  const orderId = orderRow.id;
  const userId = orderRow.user_id;

  if (orderRow.provider !== "duitku") {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
      errorMessageSafe: "provider_mismatch",
      userId,
      orderId,
    });
    return {
      ...baseResult,
      failed: true,
      orderId,
      reason: "provider_mismatch",
    };
  }

  if (normalized.amountIdr !== orderRow.amount_idr) {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
      errorMessageSafe: "amount_mismatch",
      userId,
      orderId,
    });
    return {
      ...baseResult,
      failed: true,
      orderId,
      reason: "amount_mismatch",
    };
  }

  if (
    normalized.providerTransactionId &&
    orderRow.provider_transaction_id &&
    normalized.providerTransactionId !== orderRow.provider_transaction_id
  ) {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
      errorMessageSafe: "reference_mismatch",
      userId,
      orderId,
    });
    return {
      ...baseResult,
      failed: true,
      orderId,
      reason: "reference_mismatch",
    };
  }

  try {
    const grant = await grantCreditsForPaymentSession(bindings, {
      orderId,
      webhookEventId: persisted.event.id,
      validateAmountIdr: normalized.amountIdr,
      validateProviderInvoiceId: normalized.providerInvoiceId,
      validateProviderTransactionId: normalized.providerTransactionId,
    });

    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.processed,
      userId,
      orderId,
      granted: !grant.alreadyGranted,
      duplicate: grant.alreadyGranted,
    });

    return {
      ...baseResult,
      granted: !grant.alreadyGranted,
      alreadyGranted: grant.alreadyGranted,
      orderId,
      reason: grant.alreadyGranted ? "already_granted" : null,
    };
  } catch (err) {
    const reason =
      err instanceof AppError ? err.code : "credit_topup_grant_failed";

    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
      errorMessageSafe: reason,
      userId,
      orderId,
    });

    return {
      ...baseResult,
      failed: true,
      orderId,
      reason,
    };
  }
}