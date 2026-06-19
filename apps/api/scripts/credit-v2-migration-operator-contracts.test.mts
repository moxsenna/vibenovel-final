import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../../scripts/operator-credit-v2-migrations.ps1", import.meta.url),
  "utf8",
);

assert.match(source, /ValidateSet\("local",\s*"staging",\s*"production"\)/);
assert.match(source, /\[switch\]\$Apply/);
assert.match(source, /\$ApprovalPhrase/);
assert.match(source, /"db",\s*"push"[\s\S]{0,160}"--dry-run"/);
assert.match(source, /00017[\s\S]+00018[\s\S]+00019[\s\S]+00020[\s\S]+00021/);
assert.match(source, /CREDIT_TOPUP_ENABLED/);
assert.match(source, /git\s+status\s+--porcelain/);
assert.match(source, /historicalOrderCount/);
assert.match(source, /credit_topup_products/);
assert.match(source, /credit_topup_orders/);
assert.match(source, /APPLY credit-v2 \$Environment \$targetRef/);
assert.match(source, /docs\\audit\\21-credit-v2-migration-preflight-2026-06-19\.md/);

console.log("PASS Credit v2 migration operator contracts");
