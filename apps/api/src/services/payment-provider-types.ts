import type { JsonObject } from "@vibenovel/shared";

export type PaymentProviderErrorCode =
  | "PAYMENT_PROVIDER_NOT_CONFIGURED"
  | "PAYMENT_PROVIDER_ERROR"
  | "PAYMENT_PROVIDER_TIMEOUT"
  | "PAYMENT_PROVIDER_INVALID_RESPONSE";

export type PaymentProviderMockMode = "success" | "fail_provider" | "invalid_response";

export interface PaymentProviderCreateInvoiceInput {
  orderId: string;
  productSlug: string;
  productName: string;
  amountIdr: number;
  creditsToGrant: number;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerMobile?: string;
  redirectUrl: string;
  expiresAt: string;
}

export interface PaymentProviderCreateInvoiceResult {
  provider: "mayar" | "mock" | "duitku";
  providerInvoiceId: string;
  providerTransactionId: string;
  paymentUrl: string;
  expiresAt?: string;
  payloadSafe: JsonObject;
}