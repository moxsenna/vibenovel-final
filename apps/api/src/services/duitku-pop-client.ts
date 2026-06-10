import type { JsonObject } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  getDuitkuCallbackUrl,
  getDuitkuMerchantCode,
  getDuitkuMerchantKey,
  getDuitkuPopBaseUrl,
  getPaymentTimeoutMs,
} from "../env.js";
import { AppError } from "../errors.js";
import type {
  PaymentProviderCreateInvoiceInput,
  PaymentProviderCreateInvoiceResult,
} from "./payment-provider-types.js";

interface DuitkuPopCreateInvoiceRequest {
  paymentAmount: number;
  merchantOrderId: string;
  productDetails: string;
  additionalParam: string;
  merchantUserInfo: string;
  paymentMethod: string;
  customerVaName: string;
  email: string;
  phoneNumber: string;
  itemDetails: Array<{ name: string; price: number; quantity: number }>;
  callbackUrl: string;
  returnUrl: string;
  expiryPeriod: number;
}

interface DuitkuPopCreateInvoiceResponse {
  merchantCode?: string;
  reference?: string;
  paymentUrl?: string;
  statusCode?: string;
  statusMessage?: string;
}

const CUSTOMER_VA_NAME_MAX = 20;
const DEFAULT_EXPIRY_PERIOD_MINUTES = 60;
const MIN_EXPIRY_PERIOD_MINUTES = 10;

function mapDuitkuHttpError(status: number): AppError {
  if (status >= 500) {
    return new AppError(
      "PAYMENT_PROVIDER_ERROR",
      "Payment provider returned a server error",
      502,
    );
  }
  return new AppError(
    "PAYMENT_PROVIDER_ERROR",
    "Payment provider rejected the request",
    502,
  );
}

function mapFetchError(err: unknown, timedOut: boolean): AppError {
  if (timedOut) {
    return new AppError(
      "PAYMENT_PROVIDER_TIMEOUT",
      "Payment provider request timed out",
      504,
    );
  }
  if (err instanceof AppError) return err;
  return new AppError(
    "PAYMENT_PROVIDER_ERROR",
    "Payment provider request failed",
    502,
  );
}

function truncateCustomerVaName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= CUSTOMER_VA_NAME_MAX) return trimmed;
  return trimmed.slice(0, CUSTOMER_VA_NAME_MAX);
}

function deriveExpiryPeriodMinutes(expiresAt: string): number {
  const targetMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(targetMs) || targetMs <= 0) {
    return DEFAULT_EXPIRY_PERIOD_MINUTES;
  }
  const minutes = Math.ceil(targetMs / 60_000);
  return Math.min(DEFAULT_EXPIRY_PERIOD_MINUTES, Math.max(MIN_EXPIRY_PERIOD_MINUTES, minutes));
}

function extractPaymentUrlDomain(paymentUrl: string): string | undefined {
  try {
    return new URL(paymentUrl).hostname;
  } catch {
    return undefined;
  }
}

function buildPayloadSafe(
  orderId: string,
  reference: string,
  statusCode: string,
  statusMessage: string | undefined,
  paymentUrl: string,
): JsonObject {
  const payload: JsonObject = {
    provider: "duitku",
    merchantOrderId: orderId,
    reference,
    statusCode,
  };
  if (statusMessage) payload.statusMessage = statusMessage;
  const domain = extractPaymentUrlDomain(paymentUrl);
  if (domain) payload.paymentUrlDomain = domain;
  return payload;
}

/**
 * Duitku POP create-invoice signature per official docs:
 * stringToSign = merchantCode + timestamp
 * signature = HMAC_SHA256(stringToSign, merchantKey) hex lowercase
 */
export async function generateDuitkuPopCreateSignature(
  merchantCode: string,
  timestamp: string,
  merchantKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(merchantKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const stringToSign = `${merchantCode}${timestamp}`;
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Duitku POP invoice create — Worker-only, never logs merchant key or raw response body.
 */
export async function createDuitkuPopInvoice(
  bindings: AppBindings,
  input: PaymentProviderCreateInvoiceInput,
): Promise<PaymentProviderCreateInvoiceResult> {
  const merchantCode = getDuitkuMerchantCode(bindings);
  const merchantKey = getDuitkuMerchantKey(bindings);
  if (!merchantCode || !merchantKey) {
    throw new AppError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Duitku merchant credentials are not configured",
      503,
    );
  }

  const callbackUrl = getDuitkuCallbackUrl(bindings);
  if (!callbackUrl) {
    throw new AppError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Duitku callback URL is not configured",
      503,
    );
  }

  if (!input.customerMobile?.trim()) {
    throw new AppError(
      "MOBILE_REQUIRED",
      "Customer mobile number is required for Duitku invoice create",
      400,
    );
  }

  const baseUrl = getDuitkuPopBaseUrl(bindings).replace(/\/$/, "");
  const url = `${baseUrl}/api/merchant/createInvoice`;
  const timestamp = String(Date.now());
  const signature = await generateDuitkuPopCreateSignature(
    merchantCode,
    timestamp,
    merchantKey,
  );

  const productDetails = `Top Up Kredit VibeNovel - ${input.productName}`;
  const body: DuitkuPopCreateInvoiceRequest = {
    paymentAmount: input.amountIdr,
    merchantOrderId: input.orderId,
    productDetails,
    additionalParam: "",
    merchantUserInfo: input.customerEmail,
    paymentMethod: "",
    customerVaName: truncateCustomerVaName(input.customerName),
    email: input.customerEmail,
    phoneNumber: input.customerMobile.trim(),
    itemDetails: [
      {
        name: input.productName,
        price: input.amountIdr,
        quantity: 1,
      },
    ],
    callbackUrl,
    returnUrl: input.redirectUrl,
    expiryPeriod: deriveExpiryPeriodMinutes(input.expiresAt),
  };

  const controller = new AbortController();
  const timeoutMs = getPaymentTimeoutMs(bindings);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let timedOut = false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-duitku-merchantcode": merchantCode,
        "x-duitku-timestamp": timestamp,
        "x-duitku-signature": signature,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw mapDuitkuHttpError(response.status);
    }

    let parsed: DuitkuPopCreateInvoiceResponse;
    try {
      parsed = (await response.json()) as DuitkuPopCreateInvoiceResponse;
    } catch {
      throw new AppError(
        "PAYMENT_PROVIDER_INVALID_RESPONSE",
        "Payment provider returned an invalid response",
        502,
      );
    }

    const statusCode = parsed.statusCode?.trim();
    const reference = parsed.reference?.trim();
    const paymentUrl = parsed.paymentUrl?.trim();

    if (statusCode !== "00" || !reference || !paymentUrl) {
      throw new AppError(
        "PAYMENT_PROVIDER_INVALID_RESPONSE",
        "Payment provider response is missing required invoice fields",
        502,
      );
    }

    return {
      provider: "duitku",
      providerInvoiceId: input.orderId,
      providerTransactionId: reference,
      paymentUrl,
      expiresAt: input.expiresAt,
      payloadSafe: buildPayloadSafe(
        input.orderId,
        reference,
        statusCode,
        parsed.statusMessage?.trim(),
        paymentUrl,
      ),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      timedOut = true;
    }
    throw mapFetchError(err, timedOut);
  } finally {
    clearTimeout(timeoutId);
  }
}