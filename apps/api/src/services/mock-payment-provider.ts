import type { JsonObject } from "@vibenovel/shared";
import { AppError } from "../errors.js";
import type {
  PaymentProviderCreateInvoiceInput,
  PaymentProviderCreateInvoiceResult,
  PaymentProviderMockMode,
} from "./payment-provider-types.js";

const MOCK_RETURN_BASE = "http://localhost:5173/credits/topup/mock-return";

function orderIdPrefix(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8);
}

/**
 * Deterministic local payment provider — no network. Used when PAYMENT_PROVIDER_MOCK=true.
 */
export async function createMockPaymentInvoice(
  input: PaymentProviderCreateInvoiceInput,
  mode: PaymentProviderMockMode,
): Promise<PaymentProviderCreateInvoiceResult> {
  if (mode === "fail_provider") {
    throw new AppError(
      "PAYMENT_PROVIDER_ERROR",
      "Mock payment provider simulated a provider failure",
      502,
    );
  }

  if (mode === "invalid_response") {
    throw new AppError(
      "PAYMENT_PROVIDER_INVALID_RESPONSE",
      "Mock payment provider simulated an invalid response",
      502,
    );
  }

  const prefix = orderIdPrefix(input.orderId);
  const paymentUrl = `${MOCK_RETURN_BASE}?orderId=${encodeURIComponent(input.orderId)}`;
  const payloadSafe: JsonObject = {
    mockProvider: true,
    providerInvoiceId: `mock_inv_${prefix}`,
    providerTransactionId: `mock_trx_${prefix}`,
    orderId: input.orderId,
  };

  return {
    provider: "mock",
    providerInvoiceId: `mock_inv_${prefix}`,
    providerTransactionId: `mock_trx_${prefix}`,
    paymentUrl,
    expiresAt: input.expiresAt,
    payloadSafe,
  };
}