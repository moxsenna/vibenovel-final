import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  PAYMENT_WEBHOOK_PROCESSING_STATUSES,
  type JsonObject,
  type PaymentWebhookEvent,
  type PaymentWebhookProcessingStatus,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import {
  mapPaymentWebhookEventRow,
  type PaymentWebhookEventRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";

export interface PersistPaymentWebhookEventInput {
  provider?: string;
  providerEventId?: string | null;
  providerTransactionId?: string | null;
  providerInvoiceId?: string | null;
  eventType?: string | null;
  payloadHash: string;
  payloadSafeJson: JsonObject;
}

export interface PersistPaymentWebhookEventResult {
  event: PaymentWebhookEvent;
  isDuplicate: boolean;
  alreadyTerminal: boolean;
}

const TERMINAL_STATUSES = new Set<PaymentWebhookProcessingStatus>([
  PAYMENT_WEBHOOK_PROCESSING_STATUSES.processed,
  PAYMENT_WEBHOOK_PROCESSING_STATUSES.ignored,
  PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed,
]);

export async function persistPaymentWebhookEvent(
  bindings: AppBindings,
  input: PersistPaymentWebhookEventInput,
  auditUserId?: string | null,
): Promise<PersistPaymentWebhookEventResult> {
  const admin = createServiceRoleClient(bindings);
  const provider = input.provider?.trim() || "mayar";

  const insertRow = {
    provider,
    provider_event_id: input.providerEventId ?? null,
    provider_transaction_id: input.providerTransactionId ?? null,
    provider_invoice_id: input.providerInvoiceId ?? null,
    event_type: input.eventType ?? null,
    payload_hash: input.payloadHash,
    payload_safe_json: input.payloadSafeJson,
    processing_status: PAYMENT_WEBHOOK_PROCESSING_STATUSES.received,
  };

  const { data: inserted, error: insertError } = await admin
    .from("payment_webhook_events")
    .insert(insertRow)
    .select(
      "id, provider, provider_event_id, provider_transaction_id, provider_invoice_id, event_type, payload_hash, payload_safe_json, processed_at, processing_status, error_message_safe, metadata, created_at",
    )
    .maybeSingle();

  if (!insertError && inserted) {
    const event = mapPaymentWebhookEventRow(inserted as PaymentWebhookEventRow);
    await writeAuditLog(bindings, {
      userId: auditUserId ?? null,
      action: AUDIT_ACTIONS.payment_webhook_received,
      entityType: AUDIT_ENTITY_TYPES.payment_webhook_event,
      entityId: event.id,
      metadata: {
        eventType: event.eventType,
        providerInvoiceId: event.providerInvoiceId,
        providerTransactionId: event.providerTransactionId,
        processingStatus: event.processingStatus,
      },
    });
    return { event, isDuplicate: false, alreadyTerminal: false };
  }

  if (insertError?.code !== "23505") {
    console.error("payment_webhook_events insert failed");
    throw AppError.internal("Failed to persist payment webhook event");
  }

  const { data: existing, error: selectError } = await admin
    .from("payment_webhook_events")
    .select(
      "id, provider, provider_event_id, provider_transaction_id, provider_invoice_id, event_type, payload_hash, payload_safe_json, processed_at, processing_status, error_message_safe, metadata, created_at",
    )
    .eq("provider", provider)
    .eq("payload_hash", input.payloadHash)
    .maybeSingle();

  if (selectError || !existing) {
    console.error("payment_webhook_events duplicate lookup failed");
    throw AppError.internal("Failed to resolve duplicate webhook event");
  }

  const event = mapPaymentWebhookEventRow(existing as PaymentWebhookEventRow);
  return {
    event,
    isDuplicate: true,
    alreadyTerminal: TERMINAL_STATUSES.has(event.processingStatus),
  };
}

export async function markPaymentWebhookEventStatus(
  bindings: AppBindings,
  eventId: string,
  input: {
    processingStatus: PaymentWebhookProcessingStatus;
    errorMessageSafe?: string | null;
    userId?: string | null;
    orderId?: string | null;
    granted?: boolean;
    duplicate?: boolean;
  },
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const processedAt =
    input.processingStatus === PAYMENT_WEBHOOK_PROCESSING_STATUSES.received
      ? null
      : new Date().toISOString();

  const { error } = await admin
    .from("payment_webhook_events")
    .update({
      processing_status: input.processingStatus,
      processed_at: processedAt,
      error_message_safe: input.errorMessageSafe ?? null,
    })
    .eq("id", eventId);

  if (error) {
    console.error("payment_webhook_events status update failed");
    throw AppError.internal("Failed to update payment webhook event status");
  }

  if (input.processingStatus === PAYMENT_WEBHOOK_PROCESSING_STATUSES.processed) {
    await writeAuditLog(bindings, {
      userId: input.userId ?? null,
      action: AUDIT_ACTIONS.payment_webhook_processed,
      entityType: AUDIT_ENTITY_TYPES.payment_webhook_event,
      entityId: eventId,
      metadata: {
        orderId: input.orderId ?? null,
        granted: input.granted ?? false,
        duplicate: input.duplicate ?? false,
      },
    });
    return;
  }

  if (input.processingStatus === PAYMENT_WEBHOOK_PROCESSING_STATUSES.failed) {
    await writeAuditLog(bindings, {
      userId: input.userId ?? null,
      action: AUDIT_ACTIONS.payment_webhook_failed,
      entityType: AUDIT_ENTITY_TYPES.payment_webhook_event,
      entityId: eventId,
      metadata: {
        orderId: input.orderId ?? null,
        reason: input.errorMessageSafe ?? "webhook_failed",
      },
    });
  }
}