import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildDuitkuSignatureDiagnostics,
  DUITKU_POP_CALLBACK_FORMULA,
  DUITKU_POP_CALLBACK_HMAC_FORMULA,
  validateDuitkuCallbackSignature,
  type DuitkuCallbackFormFields,
} from "../src/services/duitku-callback.ts";
import { md5HexLower } from "../src/lib/md5.ts";

const TEST_KEY = "test-merchant-key-32chars!!!!!!";

function signHmac(parsed: DuitkuCallbackFormFields, key: string): string {
  return createHmac("sha256", key)
    .update(`${parsed.merchantCode}${parsed.amount}${parsed.merchantOrderId}`, "utf8")
    .digest("hex");
}

function signMd5(parsed: DuitkuCallbackFormFields, key: string): string {
  return md5HexLower(
    `${parsed.merchantCode}${parsed.amount}${parsed.merchantOrderId}${key}`,
  );
}

function realBcaVaShape(orderId: string, reference: string): DuitkuCallbackFormFields {
  return {
    merchantCode: "DS31576",
    amount: "39000",
    merchantOrderId: orderId,
    productDetail: "Top Up Kredit VibeNovel - Paket Starter",
    additionalParam: null,
    paymentCode: "BC",
    resultCode: "00",
    reference,
    signature: "",
    merchantUserId: null,
    spUserHash: null,
    fieldNames: [
      "amount",
      "merchantCode",
      "merchantOrderId",
      "paymentCode",
      "productDetail",
      "reference",
      "resultCode",
      "signature",
    ],
  };
}

const orderId = "b98dfc22-1f0b-41fb-a68b-3874b2a356fe";
const reference = "DS3157626KVUR723DNXVWUTB";

const hmacShape = realBcaVaShape(orderId, reference);
hmacShape.signature = signHmac(hmacShape, TEST_KEY);
assert.equal(await validateDuitkuCallbackSignature(hmacShape, TEST_KEY), true);

const md5Shape = realBcaVaShape(orderId, reference);
md5Shape.signature = signMd5(md5Shape, TEST_KEY);
assert.equal(await validateDuitkuCallbackSignature(md5Shape, TEST_KEY), true);

const bad = { ...hmacShape, signature: "0".repeat(64) };
assert.equal(await validateDuitkuCallbackSignature(bad, TEST_KEY), false);

const diag = await buildDuitkuSignatureDiagnostics(bad, TEST_KEY);
assert.equal(diag.reason, "invalid_signature");
assert.equal(diag.paymentCode, "BC");
assert.equal(diag.signatureReceivedLength, 64);
assert.ok(diag.formulaCandidates.some((c) => c.formulaName === DUITKU_POP_CALLBACK_HMAC_FORMULA));
assert.ok(diag.formulaCandidates.some((c) => c.formulaName === DUITKU_POP_CALLBACK_FORMULA));
assert.ok(!JSON.stringify(diag).includes(TEST_KEY));

console.log("duitku-callback-signature.test: PASS");