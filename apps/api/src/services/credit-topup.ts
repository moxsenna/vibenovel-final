import type { User } from "@supabase/supabase-js";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  CREDIT_TOPUP_ORDER_STATUSES,
  type CreditTopupOrder,
  type CreditTopupProduct,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  getPaymentReturnBaseUrl,
  isCreditTopupEnabled,
  isPaymentSandboxMode,
} from "../env.js";
import { AppError } from "../errors.js";
import {
  mapCreditTopupOrderRow,
  mapCreditTopupProductRow,
  mapCreditTopupOrderSummary,
  type CreditTopupOrderRow,
  type CreditTopupProductRow,
  type CreditTopupOrderSummary,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import { createPaymentProviderInvoice } from "./payment-provider.js";
import type { PaymentProviderCreateInvoiceInput } from "./payment-provider-types.js";

const DEFAULT_ORDER_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_KEY_MIN = 8;
const IDEMPOTENCY_KEY_MAX = 128;
const SANDBOX_MOBILE_PLACEHOLDER = "081000000000";

export interface CreditTopupCheckoutResult {
  order: CreditTopupOrderSummary;
  paymentUrl: string;
  provider: string;
  idempotentReplay: boolean;
}

export interface CreateCreditTopupCheckoutInput {
  user: User;
  productSlug: string;
  idempotencyKey: string;
}

function assertTopupEnabled(bindings: AppBindings): void {
  if (!isCreditTopupEnabled(bindings)) {
    throw new AppError(
      "TOPUP_DISABLED",
      "Credit topup checkout is disabled",
      503,
    );
  }
}

function normalizeIdempotencyKey(raw: string): string {
  const key = raw.trim();
  if (key.length < IDEMPOTENCY_KEY_MIN || key.length > IDEMPOTENCY_KEY_MAX) {
    throw AppError.badRequest(
      `idempotencyKey must be between ${IDEMPOTENCY_KEY_MIN} and ${IDEMPOTENCY_KEY_MAX} characters`,
    );
  }
  return key;
}

function resolveCustomerName(user: User): string {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.display_name === "string" && meta.display_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim());
  if (fromMeta) return fromMeta;
  return "VibeNovel User";
}

function resolveCustomerEmail(user: User): string {
  const email = user.email?.trim();
  if (!email) {
    throw AppError.badRequest("Authenticated user email is required for checkout");
  }
  return email;
}

function resolveCustomerMobile(
  user: User,
  bindings: AppBindings,
): string | null {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.mobile === "string" && meta.mobile.trim()) ||
    (typeof meta.phone === "string" && meta.phone.trim());
  if (fromMeta) return fromMeta;

  if (isPaymentSandboxMode(bindings)) {
    return SANDBOX_MOBILE_PLACEHOLDER;
  }

  return null;
}

function computeExpiresAt(): string {
  return new Date(Date.now() + DEFAULT_ORDER_TTL_MS).toISOString();
}

function buildRedirectUrl(bindings: AppBindings, orderId: string): string {
  const base = getPaymentReturnBaseUrl(bindings);
  return `${base}/credits/topup/return?orderId=${encodeURIComponent(orderId)}`;
}

type OrderRowWithProduct = CreditTopupOrderRow & {
  credit_topup_products?: { slug: string; name: string } | Array<{ slug: string; name: string }>;
};

function resolveJoinedProduct(
  joined: OrderRowWithProduct["credit_topup_products"],
): { slug: string; name: string } | undefined {
  if (!joined) return undefined;
  if (Array.isArray(joined)) return joined[0];
  return joined;
}

async function loadOrderWithProduct(
  bindings: AppBindings,
  orderId: string,
): Promise<{ order: CreditTopupOrder; productSlug: string; productName: string }> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_topup_orders")
    .select(
      `
      id, user_id, product_id, provider, provider_invoice_id, provider_transaction_id,
      payment_url, amount_idr, credits_to_grant, status, idempotency_key,
      provider_payload_safe, paid_at, expires_at, metadata, created_at, updated_at,
      credit_topup_products!inner ( slug, name )
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("credit_topup_orders select failed");
    throw AppError.internal("Failed to load topup order");
  }
  if (!data) {
    throw AppError.notFound("Topup order not found");
  }

  const row = data as OrderRowWithProduct;
  const product = resolveJoinedProduct(row.credit_topup_products);
  if (!product) {
    throw AppError.internal("Topup order product join missing");
  }
  return {
    order: mapCreditTopupOrderRow(row),
    productSlug: product.slug,
    productName: product.name,
  };
}

/** Active catalog — read-only; allowed even when CREDIT_TOPUP_ENABLED=false. */
export async function listActiveCreditTopupProducts(
  bindings: AppBindings,
): Promise<CreditTopupProduct[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_topup_products")
    .select(
      "id, slug, name, description, price_idr, credits, bonus_credits, is_active, sort_order, metadata, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("credit_topup_products select failed");
    throw AppError.internal("Failed to load credit topup products");
  }

  return (data ?? []).map((row) =>
    mapCreditTopupProductRow(row as CreditTopupProductRow),
  );
}

export async function getCreditTopupProductBySlug(
  bindings: AppBindings,
  slug: string,
): Promise<CreditTopupProduct | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_topup_products")
    .select(
      "id, slug, name, description, price_idr, credits, bonus_credits, is_active, sort_order, metadata, created_at, updated_at",
    )
    .eq("slug", slug.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("credit_topup_products select failed");
    throw AppError.internal("Failed to load credit topup product");
  }

  if (!data) return null;
  return mapCreditTopupProductRow(data as CreditTopupProductRow);
}

async function findOrderByIdempotencyKey(
  bindings: AppBindings,
  userId: string,
  idempotencyKey: string,
): Promise<OrderRowWithProduct | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_topup_orders")
    .select(
      `
      id, user_id, product_id, provider, provider_invoice_id, provider_transaction_id,
      payment_url, amount_idr, credits_to_grant, status, idempotency_key,
      provider_payload_safe, paid_at, expires_at, metadata, created_at, updated_at,
      credit_topup_products ( slug, name )
    `,
    )
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    console.error("credit_topup_orders idempotency select failed");
    throw AppError.internal("Failed to check idempotency");
  }

  return (data as OrderRowWithProduct) ?? null;
}

function buildCheckoutResultFromRow(
  row: OrderRowWithProduct,
  idempotentReplay: boolean,
): CreditTopupCheckoutResult {
  const order = mapCreditTopupOrderRow(row);
  const product = resolveJoinedProduct(row.credit_topup_products);
  const summary = mapCreditTopupOrderSummary(order, {
    productSlug: product?.slug,
    productName: product?.name,
  });
  if (!order.paymentUrl) {
    throw AppError.internal("Checkout order is missing payment URL");
  }
  return {
    order: summary,
    paymentUrl: order.paymentUrl,
    provider: order.provider,
    idempotentReplay,
  };
}

async function writeCheckoutAuditLogs(
  bindings: AppBindings,
  userId: string,
  order: CreditTopupOrder,
  productSlug: string,
  providerInvoiceId: string,
  providerTransactionId: string,
  idempotentReplay: boolean,
): Promise<void> {
  const checkoutMetadata = {
    productSlug,
    amountIdr: order.amountIdr,
    creditsToGrant: order.creditsToGrant,
    idempotentReplay,
  };

  await writeAuditLog(bindings, {
    userId,
    action: AUDIT_ACTIONS.credit_topup_checkout_created,
    entityType: AUDIT_ENTITY_TYPES.credit_topup_order,
    entityId: order.id,
    metadata: checkoutMetadata,
    afterData: {
      orderId: order.id,
      status: order.status,
      productSlug,
      amountIdr: order.amountIdr,
      creditsToGrant: order.creditsToGrant,
    },
  });

  await writeAuditLog(bindings, {
    userId,
    action: AUDIT_ACTIONS.payment_invoice_created,
    entityType: AUDIT_ENTITY_TYPES.credit_topup_order,
    entityId: order.id,
    metadata: {
      provider: order.provider,
      providerInvoiceId,
      providerTransactionId,
      productSlug,
    },
    afterData: {
      orderId: order.id,
      providerInvoiceId,
      providerTransactionId,
    },
  });
}

export async function createCreditTopupCheckout(
  bindings: AppBindings,
  input: CreateCreditTopupCheckoutInput,
): Promise<CreditTopupCheckoutResult> {
  assertTopupEnabled(bindings);

  const userId = input.user.id;
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const productSlug = input.productSlug.trim();

  if (!productSlug) {
    throw AppError.badRequest("productSlug is required");
  }

  const existing = await findOrderByIdempotencyKey(bindings, userId, idempotencyKey);
  if (existing) {
    if (existing.payment_url && existing.status === CREDIT_TOPUP_ORDER_STATUSES.pending) {
      return buildCheckoutResultFromRow(existing, true);
    }
    throw AppError.conflict(
      "A checkout attempt already exists for this idempotency key without a completed payment URL. Use a new idempotencyKey to retry.",
      { orderId: existing.id, status: existing.status },
    );
  }

  const product = await getCreditTopupProductBySlug(bindings, productSlug);
  if (!product) {
    throw AppError.notFound(`Credit topup product not found: ${productSlug}`);
  }

  const creditsToGrant = product.credits + product.bonusCredits;
  const expiresAt = computeExpiresAt();
  const customerEmail = resolveCustomerEmail(input.user);
  const customerName = resolveCustomerName(input.user);
  const customerMobile = resolveCustomerMobile(input.user, bindings);

  if (!customerMobile) {
    throw new AppError(
      "MOBILE_REQUIRED",
      "Customer mobile number is required for payment checkout",
      400,
    );
  }

  const admin = createServiceRoleClient(bindings);
  const { data: inserted, error: insertError } = await admin
    .from("credit_topup_orders")
    .insert({
      user_id: userId,
      product_id: product.id,
      amount_idr: product.priceIdr,
      credits_to_grant: creditsToGrant,
      status: CREDIT_TOPUP_ORDER_STATUSES.pending,
      idempotency_key: idempotencyKey,
      expires_at: expiresAt,
      metadata: {
        productSlug: product.slug,
        proposalPricing: product.metadata.proposalPricing === true,
      },
    })
    .select(
      "id, user_id, product_id, provider, provider_invoice_id, provider_transaction_id, payment_url, amount_idr, credits_to_grant, status, idempotency_key, provider_payload_safe, paid_at, expires_at, metadata, created_at, updated_at",
    )
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      const replay = await findOrderByIdempotencyKey(bindings, userId, idempotencyKey);
      if (replay?.payment_url) {
        return buildCheckoutResultFromRow(replay, true);
      }
      throw AppError.conflict(
        "Checkout idempotency conflict — use a new idempotencyKey to retry",
      );
    }
    console.error("credit_topup_orders insert failed");
    throw AppError.internal("Failed to create topup order");
  }

  const orderId = (inserted as CreditTopupOrderRow).id;
  const providerInput: PaymentProviderCreateInvoiceInput = {
    orderId,
    productSlug: product.slug,
    productName: product.name,
    amountIdr: product.priceIdr,
    creditsToGrant,
    userId,
    customerName,
    customerEmail,
    customerMobile,
    redirectUrl: buildRedirectUrl(bindings, orderId),
    expiresAt,
  };

  try {
    const invoice = await createPaymentProviderInvoice(bindings, providerInput);

    const { data: updated, error: updateError } = await admin
      .from("credit_topup_orders")
      .update({
        provider: invoice.provider,
        provider_invoice_id: invoice.providerInvoiceId,
        provider_transaction_id: invoice.providerTransactionId,
        payment_url: invoice.paymentUrl,
        expires_at: invoice.expiresAt ?? expiresAt,
        provider_payload_safe: invoice.payloadSafe,
      })
      .eq("id", orderId)
      .select(
        `
        id, user_id, product_id, provider, provider_invoice_id, provider_transaction_id,
        payment_url, amount_idr, credits_to_grant, status, idempotency_key,
        provider_payload_safe, paid_at, expires_at, metadata, created_at, updated_at,
        credit_topup_products ( slug, name )
      `,
      )
      .single();

    if (updateError || !updated) {
      console.error("credit_topup_orders provider update failed");
      throw AppError.internal("Failed to update topup order with payment details");
    }

    const loaded = await loadOrderWithProduct(bindings, orderId);
    await writeCheckoutAuditLogs(
      bindings,
      userId,
      loaded.order,
      loaded.productSlug,
      invoice.providerInvoiceId,
      invoice.providerTransactionId,
      false,
    );

    return buildCheckoutResultFromRow(updated as OrderRowWithProduct, false);
  } catch (err) {
    console.error("payment provider invoice create failed");
    throw err;
  }
}