import type { JsonObject } from "@vibenovel/shared";
import { AppError } from "../errors.js";
import { md5HexLower } from "../lib/md5.js";

export interface DuitkuCallbackFormFields {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  productDetail: string | null;
  additionalParam: string | null;
  paymentCode: string | null;
  resultCode: string;
  reference: string | null;
  signature: string;
  merchantUserId: string | null;
  spUserHash: string | null;
  /** Form field names present in callback body (for diagnostics). */
  fieldNames: string[];
}

export interface DuitkuCallbackSignatureDiagnostic {
  reason: "invalid_signature";
  signatureReceivedPrefix: string;
  signatureReceivedLength: number;
  merchantCodeUsed: string;
  amountUsed: string;
  merchantOrderIdUsed: string;
  referencePresent: boolean;
  paymentCode: string | null;
  fieldNames: string[];
  formulaCandidates: Array<{
    formulaName: string;
    computedSignaturePrefix: string;
  }>;
}

export interface NormalizedDuitkuCallback {
  provider: "duitku";
  eventType: "duitku.callback";
  providerInvoiceId: string;
  providerTransactionId: string | null;
  providerEventId: string | null;
  orderId: string;
  amountIdr: number;
  isPaid: boolean;
  resultCode: string;
  paymentCode: string | null;
  payloadSafe: JsonObject;
  payloadHash: string;
}

function readFormString(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readPositiveAmount(value: string | null): number | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Parse Duitku POP callback — application/x-www-form-urlencoded only.
 */
export async function parseDuitkuCallbackRequest(
  request: Request,
): Promise<DuitkuCallbackFormFields> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    throw AppError.badRequest("Duitku callback requires application/x-www-form-urlencoded");
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    throw AppError.badRequest("Failed to read Duitku callback body");
  }

  if (!bodyText.trim()) {
    throw AppError.badRequest("Duitku callback body is empty");
  }

  const params = new URLSearchParams(bodyText);
  const fieldNames = [...new Set([...params.keys()].sort())];
  const merchantCode = readFormString(params, "merchantCode");
  const amount = readFormString(params, "amount");
  const merchantOrderId = readFormString(params, "merchantOrderId");
  const resultCode = readFormString(params, "resultCode");
  const signature = readFormString(params, "signature");
  const reference = readFormString(params, "reference");

  if (!merchantCode) {
    throw AppError.badRequest("Duitku callback merchantCode is required");
  }
  if (!amount || readPositiveAmount(amount) === null) {
    throw AppError.badRequest("Duitku callback amount is invalid");
  }
  if (!merchantOrderId) {
    throw AppError.badRequest("Duitku callback merchantOrderId is required");
  }
  if (!resultCode) {
    throw AppError.badRequest("Duitku callback resultCode is required");
  }
  if (!signature) {
    throw AppError.badRequest("Duitku callback signature is required");
  }
  if (resultCode === "00" && !reference) {
    throw AppError.badRequest("Duitku paid callback reference is required");
  }

  return {
    merchantCode,
    amount,
    merchantOrderId,
    productDetail: readFormString(params, "productDetail"),
    additionalParam: readFormString(params, "additionalParam"),
    paymentCode: readFormString(params, "paymentCode"),
    resultCode,
    reference,
    signature,
    merchantUserId: readFormString(params, "merchantUserId"),
    spUserHash: readFormString(params, "spUserHash"),
    fieldNames,
  };
}

/**
 * Legacy POP callback (32 hex) — md5(merchantCode + amount + merchantOrderId + merchantKey).
 * Real Duitku sandbox callbacks use HMAC-SHA256 (64 hex) — see DUITKU_POP_CALLBACK_HMAC_FORMULA.
 */
export const DUITKU_POP_CALLBACK_FORMULA = "pop_md5_merchantCode_amount_merchantOrderId_merchantKey";

/** Current Duitku server callback: HMAC_SHA256(merchantCode + amount + merchantOrderId, merchantKey). */
export const DUITKU_POP_CALLBACK_HMAC_FORMULA =
  "pop_hmac_sha256_merchantCode_amount_merchantOrderId";

function buildPopCallbackStringToSign(parsed: DuitkuCallbackFormFields): string {
  return `${parsed.merchantCode}${parsed.amount}${parsed.merchantOrderId}`;
}

async function hmacSha256HexLower(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function signaturePrefix(hex: string): string {
  return hex.slice(0, 8);
}

/** Safe diagnostic only — never logs merchant key or full signature. */
export async function buildDuitkuSignatureDiagnostics(
  parsed: DuitkuCallbackFormFields,
  merchantKey: string,
): Promise<DuitkuCallbackSignatureDiagnostic> {
  const ref = parsed.reference ?? "";
  const sp = parsed.spUserHash ?? "";
  const hmacStringToSign = buildPopCallbackStringToSign(parsed);
  const hmacExpected = await hmacSha256HexLower(hmacStringToSign, merchantKey);
  const candidates: Array<{ formulaName: string; stringToSign: string }> = [
    {
      formulaName: DUITKU_POP_CALLBACK_HMAC_FORMULA,
      stringToSign: hmacStringToSign,
    },
    {
      formulaName: DUITKU_POP_CALLBACK_FORMULA,
      stringToSign: `${parsed.merchantCode}${parsed.amount}${parsed.merchantOrderId}${merchantKey}`,
    },
    {
      formulaName: "pop_md5_merchantCode_amount_reference_merchantKey",
      stringToSign: `${parsed.merchantCode}${parsed.amount}${ref}${merchantKey}`,
    },
    {
      formulaName: "pop_md5_merchantCode_merchantOrderId_merchantKey",
      stringToSign: `${parsed.merchantCode}${parsed.merchantOrderId}${merchantKey}`,
    },
    {
      formulaName: "pop_md5_merchantCode_amount_merchantOrderId_reference_merchantKey",
      stringToSign: `${parsed.merchantCode}${parsed.amount}${parsed.merchantOrderId}${ref}${merchantKey}`,
    },
    {
      formulaName: "pop_md5_merchantCode_amount_merchantOrderId_spUserHash_merchantKey",
      stringToSign: `${parsed.merchantCode}${parsed.amount}${parsed.merchantOrderId}${sp}${merchantKey}`,
    },
  ];

  return {
    reason: "invalid_signature",
    signatureReceivedPrefix: signaturePrefix(parsed.signature.toLowerCase()),
    signatureReceivedLength: parsed.signature.length,
    merchantCodeUsed: parsed.merchantCode,
    amountUsed: parsed.amount,
    merchantOrderIdUsed: parsed.merchantOrderId,
    referencePresent: Boolean(parsed.reference),
    paymentCode: parsed.paymentCode,
    fieldNames: parsed.fieldNames,
    formulaCandidates: [
      {
        formulaName: DUITKU_POP_CALLBACK_HMAC_FORMULA,
        computedSignaturePrefix: signaturePrefix(hmacExpected),
      },
      ...candidates
        .filter((c) => c.formulaName !== DUITKU_POP_CALLBACK_HMAC_FORMULA)
        .map((c) => ({
          formulaName: c.formulaName,
          computedSignaturePrefix: signaturePrefix(md5HexLower(c.stringToSign)),
        })),
    ],
  };
}

export async function validateDuitkuCallbackSignature(
  parsed: DuitkuCallbackFormFields,
  merchantKey: string,
): Promise<boolean> {
  const received = parsed.signature.toLowerCase();
  if (received.length === 64) {
    const expected = await hmacSha256HexLower(buildPopCallbackStringToSign(parsed), merchantKey);
    return timingSafeEqualString(received, expected);
  }
  if (received.length === 32) {
    const stringToSign = `${parsed.merchantCode}${parsed.amount}${parsed.merchantOrderId}${merchantKey}`;
    const expected = md5HexLower(stringToSign);
    return timingSafeEqualString(received, expected);
  }
  return false;
}

export async function normalizeDuitkuCallback(
  parsed: DuitkuCallbackFormFields,
  extraPayloadSafe: JsonObject = {},
): Promise<NormalizedDuitkuCallback> {
  const amountIdr = readPositiveAmount(parsed.amount);
  if (amountIdr === null) {
    throw AppError.badRequest("Duitku callback amount is invalid");
  }

  const isPaid = parsed.resultCode === "00";
  const payloadSafe: JsonObject = {
    provider: "duitku",
    merchantCode: parsed.merchantCode,
    merchantOrderId: parsed.merchantOrderId,
    amount: parsed.amount,
    resultCode: parsed.resultCode,
  };
  if (parsed.reference) payloadSafe.reference = parsed.reference;
  if (parsed.paymentCode) payloadSafe.paymentCode = parsed.paymentCode;
  if (parsed.productDetail) {
    const detail =
      parsed.productDetail.length > 120
        ? `${parsed.productDetail.slice(0, 117)}...`
        : parsed.productDetail;
    payloadSafe.productDetail = detail;
  }
  if (parsed.spUserHash) {
    payloadSafe.spUserHashPresent = true;
  }
  for (const [key, value] of Object.entries(extraPayloadSafe)) {
    payloadSafe[key] = value;
  }

  const payloadHash = await sha256Hex(stableStringify(payloadSafe));

  return {
    provider: "duitku",
    eventType: "duitku.callback",
    providerInvoiceId: parsed.merchantOrderId,
    providerTransactionId: parsed.reference,
    providerEventId: parsed.reference,
    orderId: parsed.merchantOrderId,
    amountIdr,
    isPaid,
    resultCode: parsed.resultCode,
    paymentCode: parsed.paymentCode,
    payloadSafe,
    payloadHash,
  };
}