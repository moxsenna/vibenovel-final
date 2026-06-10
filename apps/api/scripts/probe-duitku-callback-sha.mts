import { readFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../../../.env.staging.duitku");
let key = "";
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^DUITKU_MERCHANT_KEY=(.*)$/);
  if (m) key = m[1].trim();
}
if (!key) {
  console.error("missing key");
  process.exit(1);
}

const code = "DS31576";
const amount = "39000";
const orderId = "b98dfc22-1f0b-41fb-a68b-3874b2a356fe";
const ref = "DS3157626KVUR723DNXVWUTB";
const target = "4f0ae309";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");
const hmac = (s: string, k: string) => createHmac("sha256", k).update(s, "utf8").digest("hex");

const candidates: Array<{ name: string; hex: string }> = [
  { name: "md5_std", hex: md5(`${code}${amount}${orderId}${key}`) },
  { name: "sha256_std", hex: sha(`${code}${amount}${orderId}${key}`) },
  { name: "hmac_sha256_std", hex: hmac(`${code}${amount}${orderId}${key}`, key) },
  { name: "hmac_sha256_concat", hex: hmac(`${code}${amount}${orderId}`, key) },
  { name: "sha256_ref", hex: sha(`${code}${amount}${ref}${key}`) },
  { name: "sha256_order_ref", hex: sha(`${code}${amount}${orderId}${ref}${key}`) },
  { name: "hmac_pop_create_style", hex: hmac(`${code}${amount}${orderId}${key}`, key) },
  { name: "sha256_upper", hex: sha(`${code}${amount}${orderId}${key}`).toUpperCase() },
];

let any = false;
for (const c of candidates) {
  const match = c.hex.toLowerCase().startsWith(target);
  if (match) any = true;
  console.log(`${c.name} prefix=${c.hex.slice(0, 8)} len=${c.hex.length}${match ? " MATCH" : ""}`);
}
process.exit(any ? 0 : 2);