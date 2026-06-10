import { PAYMENT_WEBHOOK_PROCESSING_STATUSES } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { isCreditTopupEnabled } from "../env.js";
import { AppError } from "../errors.js";
import { grantCreditsForPaymentSession, findCreditTopupOrderForWebhook } from "./credit-topup-grant.js";
import {
  isGrantEligiblePaymentEvent,
  parseMayarWebhookPayload,
  resolveMayarWebhookRoute,
} from "./mayar-webhook.js";
import {
  markPaymentWebhookEventStatus,
  persistPaymentWebhookEvent,
} from "./payment-webhook-event.js";

export interface MayarWebhookProcessResult {
  ok: boolean;
  duplicate: boolean;
  granted: boolean;
  alreadyGranted: boolean;
  ignored: boolean;
  failed: boolean;
  orderId: string | null;
  reason: string | null;
  webhookEventId: string;
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

export async function processMayarPaymentWebhook(
  bindings: AppBindings,
  rawBody: unknown,
): Promise<MayarWebhookProcessResult> {
  assertTopupWebhookEnabled(bindings);

  const parsed = await parseMayarWebhookPayload(rawBody);

  const orderForAudit = await findCreditTopupOrderForWebhook(bindings, {
    orderId: parsed.orderId,
    providerInvoiceId: parsed.providerInvoiceId,
    providerTransactionId: parsed.providerTransactionId,
  });

  const persisted = await persistPaymentWebhookEvent(bindings, {
    providerEventId: parsed.providerEventId,
    providerTransactionId: parsed.providerTransactionId,
    providerInvoiceId: parsed.providerInvoiceId,
    eventType: parsed.eventType,
    payloadHash: parsed.payloadHash,
    payloadSafeJson: parsed.payloadSafe,
  }, orderForAudit?.user_id ?? null);

  const baseResult = {
    ok: true,
    duplicate: persisted.isDuplicate,
    granted: false,
    alreadyGranted: false,
    ignored: false,
    failed: false,
    orderId: null as string | null,
    reason: null as string | null,
    webhookEventId: persisted.event.id,
  };

  if (persisted.isDuplicate && persisted.alreadyTerminal) {
    return {
      ...baseResult,
      duplicate: true,
      reason: persisted.event.processingStatus,
    };
  }

  if (!parsed.isPaymentReceived) {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.ignored,
      errorMessageSafe: "event_not_payment_received",
    });
    return {
      ...baseResult,
      ignored: true,
      reason: "event_not_payment_received",
    };
  }

  if (!isGrantEligiblePaymentEvent(parsed)) {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.ignored,
      errorMessageSafe: "payment_not_paid",
    });
    return {
      ...baseResult,
      ignored: true,
      reason: "payment_not_paid",
    };
  }

  const route = resolveMayarWebhookRoute(parsed);
  if (route.action === "ignore_foreign") {
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: PAYMENT_WEBHOOK_PROCESSING_STATUSES.ignored,
      errorMessageSafe: route.reason,
    });
    return {
      ...baseResult,
      ignored: true,
      reason: route.reason,
    };
  }

  const orderRow = orderForAudit;

  if (!orderRow) {
    const isLegacyForeign = !parsed.app;
    await markPaymentWebhookEventStatus(bindings, persisted.event.id, {
      processingStatus: isLegacyForeign
        ? PAYMENT_WEBHOOK_PROCESSING_STATUSES.ignored
        : PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
      errorMessageSafe: isLegacyForeign ? "legacy_no_vibenovel_order" : "order_not_found",
    });
    return {
      ...baseResult,
      ignored: isLegacyForeign,
      failed: !isLegacyForeign,
      reason: isLegacyForeign ? "legacy_no_vibenovel_order" : "order_not_found",
    };
  }

  const orderId = orderRow.id;
  const userId = orderRow.user_id;

  if (parsed.amountIdr !== null && parsed.amountIdr !== orderRow.amount_idr) {
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

  try {
    const grant = await grantCreditsForPaymentSession(bindings, {
      orderId,
      webhookEventId: persisted.event.id,
      validateAmountIdr: parsed.amountIdr ?? orderRow.amount_idr,
      validateProviderInvoiceId: parsed.providerInvoiceId,
      validateProviderTransactionId: parsed.providerTransactionId,
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