import type { JsonObject } from "@vibenovel/shared";

export type MayarWebhookParseConfidence = "high" | "low" | "invalid";

export const VIBENOVEL_WEBHOOK_APP = "vibenovel";
export const VIBENOVEL_WEBHOOK_FLOW_CREDIT_TOPUP = "credit_topup";

export interface ParsedMayarWebhook {
  eventType: string | null;
  providerEventId: string | null;
  providerInvoiceId: string | null;
  providerTransactionId: string | null;
  amountIdr: number | null;
  isPaid: boolean;
  orderId: string | null;
  productSlug: string | null;
  app: string | null;
  flow: string | null;
  payloadSafe: JsonObject;
  payloadHash: string;
  parseConfidence: MayarWebhookParseConfidence;
  isPaymentReceived: boolean;
}

export type MayarWebhookRouteDecision =
  | { action: "process_vibenovel" }
  | { action: "ignore_foreign"; reason: string };

function normalizeRouteToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "authorization",
  "Authorization",
  "api_key",
  "apiKey",
  "MAYAR_API_KEY",
  "mayar_api_key",
  "token",
  "secret",
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function readPaidStatus(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "paid" || normalized === "success" || normalized === "true";
  }
  return false;
}

function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[depth_truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizePayload(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (FORBIDDEN_PAYLOAD_KEYS.has(key)) continue;
      if (key === "customerEmail" || key === "customerMobile" || key === "customerName") {
        continue;
      }
      out[key] = sanitizePayload(child, depth + 1) as JsonObject[keyof JsonObject];
    }
    return out;
  }
  return null;
}

function extractExtraData(root: Record<string, unknown>, data: Record<string, unknown> | null): {
  orderId: string | null;
  productSlug: string | null;
  app: string | null;
  flow: string | null;
} {
  const extraCandidates = [
    data?.extraData,
    data?.extra_data,
    root.extraData,
    root.extra_data,
  ];

  let orderId: string | null = null;
  let productSlug: string | null = null;
  let app: string | null = null;
  let flow: string | null = null;

  for (const candidate of extraCandidates) {
    const extra = asRecord(candidate);
    if (!extra) continue;
    orderId =
      orderId ??
      readString(extra.orderId) ??
      readString(extra.order_id);
    productSlug =
      productSlug ??
      readString(extra.productSlug) ??
      readString(extra.idProd) ??
      readString(extra.product_slug);
    app = app ?? normalizeRouteToken(extra.app);
    flow = flow ?? normalizeRouteToken(extra.flow);
  }

  return { orderId, productSlug, app, flow };
}

function resolveEventType(root: Record<string, unknown>): string | null {
  return (
    readString(root.event) ??
    readString(root.eventType) ??
    readString(root.event_type) ??
    readString(root.type)
  );
}

/**
 * Conservative Mayar webhook parser — tolerant of docs vs mock/sandbox shapes.
 */
export async function parseMayarWebhookPayload(
  rawBody: unknown,
): Promise<ParsedMayarWebhook> {
  const root = asRecord(rawBody);
  if (!root) {
    const emptySafe: JsonObject = { parseError: "invalid_json_object" };
    return {
      eventType: null,
      providerEventId: null,
      providerInvoiceId: null,
      providerTransactionId: null,
      amountIdr: null,
      isPaid: false,
      orderId: null,
      productSlug: null,
      app: null,
      flow: null,
      payloadSafe: emptySafe,
      payloadHash: await sha256Hex(stableStringify(emptySafe)),
      parseConfidence: "invalid",
      isPaymentReceived: false,
    };
  }

  const data = asRecord(root.data);
  const eventType = resolveEventType(root);
  const normalizedEvent = eventType?.toLowerCase() ?? "";
  const isPaymentReceived =
    normalizedEvent === "payment.received" ||
    normalizedEvent === "event.received" ||
    normalizedEvent === "payment_received";

  // Mayar docs label data.id as webhook row id — do not treat as invoice id.
  const providerEventId = readString(root.id) ?? readString(data?.id);
  const providerInvoiceId =
    readString(data?.invoiceId) ??
    readString(data?.invoice_id) ??
    readString(data?.paymentLinkId) ??
    readString(data?.payment_link_id);
  const providerTransactionId =
    readString(data?.transactionId) ??
    readString(data?.transaction_id);
  const amountIdr = readPositiveInt(data?.amount ?? data?.amountIdr ?? data?.amount_idr);

  const statusRaw = data?.status ?? data?.paymentStatus ?? data?.payment_status;
  let isPaid = readPaidStatus(statusRaw);
  // Mayar docs: payment.received fires after payment completion; boolean status may be sole paid signal.
  if (!isPaid && isPaymentReceived && statusRaw === undefined) {
    isPaid = true;
  }

  const { orderId, productSlug, app, flow } = extractExtraData(root, data);

  const payloadSafe = sanitizePayload({
    eventType,
    providerEventId,
    providerInvoiceId,
    providerTransactionId,
    amountIdr,
    isPaid,
    orderId,
    productSlug,
    app,
    flow,
  }) as JsonObject;

  const payloadHash = await sha256Hex(stableStringify(payloadSafe));

  let parseConfidence: MayarWebhookParseConfidence = "low";
  if (isPaymentReceived && (orderId || providerInvoiceId || providerTransactionId)) {
    parseConfidence = amountIdr !== null ? "high" : "low";
  }
  if (!eventType && !data) {
    parseConfidence = "invalid";
  }

  return {
    eventType,
    providerEventId,
    providerInvoiceId,
    providerTransactionId,
    amountIdr,
    isPaid,
    orderId,
    productSlug,
    app,
    flow,
    payloadSafe,
    payloadHash,
    parseConfidence,
    isPaymentReceived,
  };
}

export function isGrantEligiblePaymentEvent(parsed: ParsedMayarWebhook): boolean {
  return parsed.isPaymentReceived && parsed.isPaid;
}

/**
 * Multi-app Mayar router gate — VibeNovel must not claim foreign-app payloads.
 * Legacy payloads without `app` may still process only when a VibeNovel order matches.
 */
export function resolveMayarWebhookRoute(parsed: ParsedMayarWebhook): MayarWebhookRouteDecision {
  if (parsed.app && parsed.app !== VIBENOVEL_WEBHOOK_APP) {
    return { action: "ignore_foreign", reason: "foreign_app_payload" };
  }

  if (
    parsed.app === VIBENOVEL_WEBHOOK_APP &&
    parsed.flow &&
    parsed.flow !== VIBENOVEL_WEBHOOK_FLOW_CREDIT_TOPUP
  ) {
    return { action: "ignore_foreign", reason: "foreign_flow_payload" };
  }

  return { action: "process_vibenovel" };
}