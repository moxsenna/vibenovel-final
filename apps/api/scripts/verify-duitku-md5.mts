import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { md5HexLower } from "../src/lib/md5.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const node = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

const vectors = ["", "hello", "The quick brown fox jumps over the lazy dog"];
let ok = true;
for (const v of vectors) {
  const a = md5HexLower(v);
  const b = node(v);
  const match = a === b;
  if (!match) ok = false;
  console.log(`vector=${JSON.stringify(v)} match=${match}`);
}

const envPath = join(__dirname, "../../../.env.staging.duitku");
let key = "";
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^DUITKU_MERCHANT_KEY=(.*)$/);
  if (m) key = m[1].trim();
}
const code = "DS31576";
const amount = "39000";
const orderId = "2fbe48f5-de17-4f5b-850a-23d1d07179c8";
const ref = "DS3157626EIZETCR5Q2OD3SP";
const formulas: Record<string, string> = {
  pop_std: `${code}${amount}${orderId}${key}`,
  pop_ref: `${code}${amount}${ref}${key}`,
  pop_order_only: `${code}${orderId}${key}`,
  pop_amount_order_swap: `${code}${orderId}${amount}${key}`,
};
for (const [name, s] of Object.entries(formulas)) {
  const a = md5HexLower(s);
  const b = node(s);
  console.log(`${name} custom==node ${a === b} prefix=${a.slice(0, 8)}`);
}
process.exit(ok ? 0 : 1);