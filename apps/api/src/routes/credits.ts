import type { Hono } from "hono";
import type { CreditBalance, CreditTopupProduct } from "@vibenovel/shared";
import { authMiddleware } from "../middleware/auth.js";
import { AppError } from "../errors.js";
import { jsonSuccess } from "../response.js";
import { getCreditBalanceForUser } from "../services/credit.js";
import {
  createCreditTopupCheckout,
  listActiveCreditTopupProducts,
  type CreditTopupCheckoutResult,
} from "../services/credit-topup.js";
import type { CreditTopupOrderSummary } from "../lib/mappers.js";
import type { AppEnv } from "../types.js";

export interface CreditBalanceResponseData {
  creditBalance: CreditBalance | null;
}

export interface CreditTopupProductsResponseData {
  products: CreditTopupProduct[];
}

export interface CreditTopupCheckoutResponseData {
  order: CreditTopupOrderSummary;
  paymentUrl: string;
  provider: string;
  idempotentReplay: boolean;
}

const FORBIDDEN_CHECKOUT_BODY_KEYS = new Set([
  "amountIdr",
  "amount_idr",
  "credits",
  "bonusCredits",
  "bonus_credits",
  "provider",
  "providerInvoiceId",
  "provider_invoice_id",
  "providerTransactionId",
  "provider_transaction_id",
  "status",
  "paymentUrl",
  "payment_url",
  "userId",
  "user_id",
  "MAYAR_API_KEY",
  "mayar_api_key",
  "DUITKU_MERCHANT_CODE",
  "DUITKU_MERCHANT_KEY",
  "duitku_merchant_code",
  "duitku_merchant_key",
  "apiKey",
  "api_key",
]);

function assertNoForbiddenCheckoutFields(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_CHECKOUT_BODY_KEYS.has(key)) {
      throw AppError.badRequest(`Client must not supply field: ${key}`);
    }
  }
}

function resolveIdempotencyKey(
  headerValue: string | undefined,
  bodyValue: unknown,
): string {
  const fromHeader = headerValue?.trim();
  if (fromHeader) return fromHeader;
  if (typeof bodyValue === "string" && bodyValue.trim()) {
    return bodyValue.trim();
  }
  throw AppError.badRequest("idempotencyKey is required (body or Idempotency-Key header)");
}

export function registerCreditRoutes(app: Hono<AppEnv>): void {
  app.get("/api/credits/balance", authMiddleware, async (c) => {
    const userId = c.get("userId");
    const creditBalance = await getCreditBalanceForUser(c.env, userId);

    const body: CreditBalanceResponseData = { creditBalance };
    return jsonSuccess(c, body);
  });

  app.get("/api/credits/topup/products", authMiddleware, async (c) => {
    const products = await listActiveCreditTopupProducts(c.env);
    const body: CreditTopupProductsResponseData = { products };
    return jsonSuccess(c, body);
  });

  app.post("/api/credits/topup/checkout", authMiddleware, async (c) => {
    let rawBody: Record<string, unknown>;
    try {
      rawBody = (await c.req.json()) as Record<string, unknown>;
    } catch {
      throw AppError.badRequest("Invalid JSON body");
    }

    assertNoForbiddenCheckoutFields(rawBody);

    const productSlug =
      typeof rawBody.productSlug === "string" ? rawBody.productSlug.trim() : "";
    if (!productSlug) {
      throw AppError.badRequest("productSlug is required");
    }

    const idempotencyKey = resolveIdempotencyKey(
      c.req.header("Idempotency-Key"),
      rawBody.idempotencyKey,
    );

    const result: CreditTopupCheckoutResult = await createCreditTopupCheckout(c.env, {
      user: c.get("authUser"),
      productSlug,
      idempotencyKey,
    });

    const body: CreditTopupCheckoutResponseData = {
      order: result.order,
      paymentUrl: result.paymentUrl,
      provider: result.provider,
      idempotentReplay: result.idempotentReplay,
    };

    return jsonSuccess(c, body, result.idempotentReplay ? 200 : 201);
  });
}