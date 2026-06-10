import type { CreditBalance, CreditTopupOrderStatus, CreditTopupProduct } from "@vibenovel/shared";
import { apiRequest, ApiClientError } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/env";

export type CreditTopupProductSlug = "starter" | "creator" | "pro" | "studio";

export interface CreditTopupOrderSummary {
  id: string;
  productSlug?: string;
  productName?: string;
  amountIdr: number;
  creditsToGrant: number;
  status: CreditTopupOrderStatus | string;
  provider: string;
  providerInvoiceId: string | null;
  providerTransactionId: string | null;
  paymentUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreditTopupCheckoutInput {
  productSlug: CreditTopupProductSlug;
  idempotencyKey: string;
}

export interface CreditTopupCheckoutResult {
  order: CreditTopupOrderSummary;
  paymentUrl: string;
  provider: string;
  idempotentReplay?: boolean;
}

interface CreditBalanceResponse {
  creditBalance: CreditBalance | null;
}

interface CreditTopupProductsResponse {
  products: CreditTopupProduct[];
}

interface CreditTopupCheckoutResponse {
  order: CreditTopupOrderSummary;
  paymentUrl: string;
  provider: string;
  idempotentReplay?: boolean;
}

export interface ApiHealthFlags {
  creditTopupEnabled: boolean;
  paymentProviderMock: boolean;
  aiGenerationEnabled: boolean;
}

interface ApiHealthResponse {
  env: {
    creditTopupEnabled?: boolean;
    paymentProviderMock?: boolean;
    aiGenerationEnabled?: boolean;
  };
}

export function mapCreditTopupErrorCode(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "TOPUP_DISABLED":
      return "Top up kredit belum aktif.";
    case "PAYMENT_PROVIDER_ERROR":
      return "Payment provider sedang bermasalah.";
    case "PAYMENT_PROVIDER_NOT_CONFIGURED":
      return "Pembayaran belum dikonfigurasi.";
    case "PAYMENT_PROVIDER_TIMEOUT":
      return "Payment provider timeout.";
    case "PAYMENT_PROVIDER_INVALID_RESPONSE":
      return "Respons pembayaran tidak valid.";
    case "UNAUTHORIZED":
      return "Silakan login ulang.";
    case "NETWORK_ERROR":
      return "Tidak dapat terhubung ke server. Coba lagi.";
    case "BAD_REQUEST":
      return fallbackMessage?.trim() || "Permintaan top up tidak valid.";
    default:
      return fallbackMessage?.trim() || "Gagal memproses top up kredit.";
  }
}

export function toCreditTopupUserMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) {
      return mapCreditTopupErrorCode("UNAUTHORIZED");
    }
    return mapCreditTopupErrorCode(error.code, error.message);
  }
  return mapCreditTopupErrorCode("NETWORK_ERROR");
}

export async function fetchApiHealthFlags(): Promise<ApiHealthFlags> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    return { creditTopupEnabled: false, paymentProviderMock: false, aiGenerationEnabled: false };
  }

  try {
    const payload = (await response.json()) as { ok?: boolean; data?: ApiHealthResponse };
    const env = payload.data?.env;
    return {
      creditTopupEnabled: Boolean(env?.creditTopupEnabled),
      paymentProviderMock: Boolean(env?.paymentProviderMock),
      aiGenerationEnabled: Boolean(env?.aiGenerationEnabled),
    };
  } catch {
    return { creditTopupEnabled: false, paymentProviderMock: false, aiGenerationEnabled: false };
  }
}

export async function fetchCreditBalance(
  token?: string | null,
): Promise<CreditBalance | null> {
  const data = await apiRequest<CreditBalanceResponse>("/api/credits/balance", { token });
  return data.creditBalance;
}

export async function fetchCreditTopupProducts(
  token?: string | null,
): Promise<CreditTopupProduct[]> {
  const data = await apiRequest<CreditTopupProductsResponse>("/api/credits/topup/products", {
    token,
  });
  return data.products ?? [];
}

export async function createCreditTopupCheckout(
  input: CreditTopupCheckoutInput,
  token?: string | null,
): Promise<CreditTopupCheckoutResult> {
  const data = await apiRequest<CreditTopupCheckoutResponse>("/api/credits/topup/checkout", {
    method: "POST",
    token,
    body: {
      productSlug: input.productSlug,
      idempotencyKey: input.idempotencyKey,
    },
  });

  return {
    order: data.order,
    paymentUrl: data.paymentUrl,
    provider: data.provider,
    idempotentReplay: data.idempotentReplay,
  };
}

export function buildTopupIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `topup-${crypto.randomUUID()}`;
  }
  return `topup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}