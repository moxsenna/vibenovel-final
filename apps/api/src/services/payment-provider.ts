import type { AppBindings } from "../env.js";
import {
  getPaymentProvider,
  getPaymentProviderMockMode,
  isPaymentProviderMock,
} from "../env.js";
import { AppError } from "../errors.js";
import { createDuitkuPopInvoice } from "./duitku-pop-client.js";
import { createMayarInvoice } from "./mayar-client.js";
import { createMockPaymentInvoice } from "./mock-payment-provider.js";
import type {
  PaymentProviderCreateInvoiceInput,
  PaymentProviderCreateInvoiceResult,
} from "./payment-provider-types.js";

/**
 * Provider boundary — mock flag first, then PAYMENT_PROVIDER selector (mayar | duitku | mock).
 */
export async function createPaymentProviderInvoice(
  bindings: AppBindings,
  input: PaymentProviderCreateInvoiceInput,
): Promise<PaymentProviderCreateInvoiceResult> {
  if (isPaymentProviderMock(bindings)) {
    return createMockPaymentInvoice(input, getPaymentProviderMockMode(bindings));
  }

  const provider = getPaymentProvider(bindings);

  try {
    switch (provider) {
      case "mock":
        return createMockPaymentInvoice(input, "success");
      case "mayar":
        return await createMayarInvoice(bindings, input);
      case "duitku":
        return await createDuitkuPopInvoice(bindings, input);
      default:
        throw new AppError(
          "PAYMENT_PROVIDER_NOT_CONFIGURED",
          "Payment provider is not configured",
          503,
        );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      "PAYMENT_PROVIDER_ERROR",
      "Payment provider request failed",
      502,
    );
  }
}