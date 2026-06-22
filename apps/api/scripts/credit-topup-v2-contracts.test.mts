import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath =
  "../../supabase/migrations/00021_credit_scale_v2_topup_products.sql";
const migration = readFileSync(migrationPath, "utf8");

assert.match(migration, /\bbegin\s*;/i);
assert.match(migration, /\bcommit\s*;/i);
assert.match(migration, /on\s+conflict\s*\(\s*slug\s*\)\s+do\s+update/i);
assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
assert.doesNotMatch(migration, /\bcredit_balances\b/i);
assert.doesNotMatch(migration, /\bcredit_topup_orders\b/i);

for (const expected of [
  ["starter", 49_000, 20_000, 0],
  ["creator", 99_000, 50_000, 5_000],
  ["pro", 199_000, 120_000, 10_000],
  ["studio", 399_000, 270_000, 30_000],
] as const) {
  const [slug, price, credits, bonus] = expected;
  const rowPattern = new RegExp(
    String.raw`'${slug}'[\s\S]*?${price}[\s\S]*?${credits}[\s\S]*?${bonus}`,
    "i",
  );
  assert.match(migration, rowPattern, `${slug} v2 values must be present`);
}

assert.match(migration, /creditScaleVersion/i);
assert.match(migration, /'v2'/i);

const wrangler = readFileSync("wrangler.toml", "utf8");
const productionVars = wrangler.split("[env.production.vars]")[1] ?? "";
assert.match(
  productionVars,
  /CREDIT_TOPUP_ENABLED\s*=\s*"false"/,
  "production payment must remain off until Phase 10 go-live",
);

console.log("PASS credit top-up v2 Phase 4 contracts");
