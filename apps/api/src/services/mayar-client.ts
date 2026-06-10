import type { JsonObject } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  getMayarApiKey,
  getMayarBaseUrl,
  getMayarEnv,
  getPaymentTimeoutMs,
} from "../env.js";
import { AppError } from "../errors.js";
import type {
  PaymentProviderCreateInvoiceInput,
  PaymentProviderCreateInvoiceResult,
} from "./payment-provider-types.js";

interface MayarInvoiceCreateRequest {
  name: string;
  email: string;
  mobile: string;
  redirectUrl: string;
  description: string;
  expiredAt: string;
  items: Array<{
    quantity: number;
    rate: number;
    description: string;
  }>;
  extraData: {
    app: string;
    flow: string;
    orderId: string;
    userId: string;
    productSlug: string;
    credits: number;
    environment: string;
    noCustomer: string;
    idProd: string;
  };
}

interface MayarInvoiceCreateResponse {
  statusCode?: number;
  messages?: string;
  data?: {
    id?: string;
    transactionId?: string;
    link?: string;
    expiredAt?: number | string;
    extraData?: JsonObject;
  };
}

function mapMayarHttpError(status: number): AppError {
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

function parseMayarExpiredAt(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 1_000_000_000_000) {
      return new Date(asNum).toISOString();
    }
    return value;
  }
  return undefined;
}

function extractPaymentUrlDomain(paymentUrl: string): string | undefined {
  try {
    return new URL(paymentUrl).hostname;
  } catch {
    return undefined;
  }
}

function buildPayloadSafe(
  data: NonNullable<MayarInvoiceCreateResponse["data"]>,
): JsonObject {
  const link = typeof data.link === "string" ? data.link : "";
  const payload: JsonObject = {
    provider: "mayar",
    providerInvoiceId: data.id ?? null,
    providerTransactionId: data.transactionId ?? null,
  };
  const domain = extractPaymentUrlDomain(link);
  if (domain) payload.paymentUrlDomain = domain;
  const expiredAt = parseMayarExpiredAt(data.expiredAt);
  if (expiredAt) payload.expiredAt = expiredAt;
  return payload;
}

/**
 * Mayar invoice create — Worker-only, never logs API key or raw response body.
 */
export async function createMayarInvoice(
  bindings: AppBindings,
  input: PaymentProviderCreateInvoiceInput,
): Promise<PaymentProviderCreateInvoiceResult> {
  const apiKey = getMayarApiKey(bindings);
  if (!apiKey) {
    throw new AppError(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Mayar API key is not configured",
      503,
    );
  }

  if (!input.customerMobile?.trim()) {
    throw new AppError(
      "MOBILE_REQUIRED",
      "Customer mobile number is required for Mayar invoice create",
      400,
    );
  }

  const baseUrl = getMayarBaseUrl(bindings).replace(/\/$/, "");
  const url = `${baseUrl}/invoice/create`;
  const body: MayarInvoiceCreateRequest = {
    name: input.customerName,
    email: input.customerEmail,
    mobile: input.customerMobile.trim(),
    redirectUrl: input.redirectUrl,
    description: `VibeNovel Credit Pack - ${input.productName}`,
    expiredAt: input.expiresAt,
    items: [
      {
        quantity: 1,
        rate: input.amountIdr,
        description: `${input.productName} - ${input.creditsToGrant} kredit`,
      },
    ],
    extraData: {
      app: "vibenovel",
      flow: "credit_topup",
      orderId: input.orderId,
      userId: input.userId,
      productSlug: input.productSlug,
      credits: input.creditsToGrant,
      environment: getMayarEnv(bindings),
      noCustomer: input.orderId,
      idProd: input.productSlug,
    },
  };

  const controller = new AbortController();
  const timeoutMs = getPaymentTimeoutMs(bindings);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let timedOut = false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw mapMayarHttpError(response.status);
    }

    let parsed: MayarInvoiceCreateResponse;
    try {
      parsed = (await response.json()) as MayarInvoiceCreateResponse;
    } catch {
      throw new AppError(
        "PAYMENT_PROVIDER_INVALID_RESPONSE",
        "Payment provider returned an invalid response",
        502,
      );
    }

    const data = parsed.data;
    const invoiceId = data?.id?.trim();
    const transactionId = data?.transactionId?.trim();
    const link = data?.link?.trim();

    if (!invoiceId || !transactionId || !link) {
      throw new AppError(
        "PAYMENT_PROVIDER_INVALID_RESPONSE",
        "Payment provider response is missing required invoice fields",
        502,
      );
    }

    return {
      provider: "mayar",
      providerInvoiceId: invoiceId,
      providerTransactionId: transactionId,
      paymentUrl: link,
      expiresAt: parseMayarExpiredAt(data?.expiredAt) ?? input.expiresAt,
      payloadSafe: buildPayloadSafe(data!),
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