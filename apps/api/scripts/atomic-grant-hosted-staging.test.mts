/**
 * Task 10.17 — Hosted staging atomic grant RPC tests (.env.staging, not production).
 * Run: npm run test:atomic-grant-hosted -w @vibenovel/api
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

function resolveRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "supabase", "config.toml"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

function resolveHostedStaging(): { url: string; serviceRole: string; host: string } | null {
  const url = process.env.STAGING_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim();
  const serviceRole =
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceRole) {
    try {
      const host = new URL(url).host;
      if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
        return { url, serviceRole, host };
      }
    } catch {
      return null;
    }
  }

  const envPath = join(resolveRepoRoot(), ".env.staging");
  if (!existsSync(envPath)) return null;
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  const stagingUrl = env.SUPABASE_URL?.trim();
  const stagingSr = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!stagingUrl || !stagingSr) return null;
  try {
    const host = new URL(stagingUrl).host;
    if (host.includes("127.0.0.1") || host.includes("localhost")) return null;
    return { url: stagingUrl, serviceRole: stagingSr, host };
  } catch {
    return null;
  }
}

interface RpcResult {
  granted: boolean;
  already_granted: boolean;
  order_id?: string;
  user_id?: string;
  credits?: number;
  previous_balance?: number;
  new_balance?: number;
  ledger_id?: string;
  reason?: string | null;
}

async function rpc(
  admin: ReturnType<typeof createClient>,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  const { data, error } = await admin.rpc("grant_paid_credit_topup_atomic", args);
  if (error) throw new Error(`rpc failed: ${error.message}`);
  return data as RpcResult;
}

const creds = resolveHostedStaging();
if (!creds) {
  console.log("atomic-grant-hosted-staging.test: SKIP (hosted .env.staging not available)");
  process.exit(0);
}

console.log(`atomic-grant-hosted-staging.test: target host=${creds.host}`);

const admin = createClient(creds.url, creds.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `task-10-17-hosted-${Date.now()}@narraza-staging.test`;
const password = "HostedAtomicGrant-Test-1!";

const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createUserError || !authUser.user) {
  throw new Error(`createUser failed: ${createUserError?.message ?? "no user"}`);
}
const userId = authUser.user.id;

const { error: profileError } = await admin.from("profiles").insert({
  id: userId,
  email,
  display_name: "Task 10.17 Hosted Grant Test",
  role: "writer",
  subscription_plan: "free",
});
if (profileError) throw new Error(`profile insert failed: ${profileError.message}`);

const { data: product, error: productError } = await admin
  .from("credit_topup_products")
  .select("id")
  .eq("slug", "starter")
  .single();
if (productError || !product) throw new Error("starter product missing");

const orderId = randomUUID();
const { error: orderError } = await admin.from("credit_topup_orders").insert({
  id: orderId,
  user_id: userId,
  product_id: product.id,
  provider: "duitku",
  payment_url: "https://example.test/pay-hosted-staging",
  amount_idr: 39000,
  credits_to_grant: 100,
  status: "pending",
  idempotency_key: `task-10-17-hosted-${orderId}`,
  metadata: { task: "10.17", hostedStagingTest: true },
});
if (orderError) throw new Error(`order insert failed: ${orderError.message}`);

const { data: balanceBeforeRows } = await admin
  .from("credit_balances")
  .select("balance")
  .eq("user_id", userId)
  .maybeSingle();
const balanceBefore = balanceBeforeRows?.balance ?? 0;

const first = await rpc(admin, {
  p_order_id: orderId,
  p_provider: "duitku",
  p_amount_idr: 39000,
  p_metadata: { orderId, task: "10.17" },
});
assert.equal(first.granted, true);
assert.equal(first.already_granted, false);
assert.equal(first.credits, 100);
assert.equal(first.new_balance, balanceBefore + 100);
assert.ok(first.ledger_id);

const second = await rpc(admin, {
  p_order_id: orderId,
  p_provider: "duitku",
  p_amount_idr: 39000,
});
assert.equal(second.granted, false);
assert.equal(second.already_granted, true);
assert.equal(second.ledger_id, first.ledger_id);
assert.equal(second.new_balance, first.new_balance);

const unknown = await rpc(admin, {
  p_order_id: randomUUID(),
  p_provider: "duitku",
  p_amount_idr: 39000,
});
assert.equal(unknown.granted, false);
assert.equal(unknown.reason, "unknown_order");

const mismatchOrderId = randomUUID();
const { error: mismatchOrderError } = await admin.from("credit_topup_orders").insert({
  id: mismatchOrderId,
  user_id: userId,
  product_id: product.id,
  provider: "duitku",
  payment_url: "https://example.test/pay2-hosted",
  amount_idr: 39000,
  credits_to_grant: 100,
  status: "pending",
  idempotency_key: `task-10-17-mm-${mismatchOrderId}`,
  metadata: { task: "10.17", hostedStagingTest: true },
});
if (mismatchOrderError) throw new Error(mismatchOrderError.message);

const mismatch = await rpc(admin, {
  p_order_id: mismatchOrderId,
  p_provider: "duitku",
  p_amount_idr: 1,
});
assert.equal(mismatch.granted, false);
assert.equal(mismatch.reason, "amount_mismatch");

const { data: orderAfter } = await admin
  .from("credit_topup_orders")
  .select("status")
  .eq("id", mismatchOrderId)
  .single();
assert.equal(orderAfter?.status, "pending");

const { count: ledgerCount } = await admin
  .from("credit_ledger")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId)
  .contains("metadata", { orderId });
assert.equal(ledgerCount, 1);

const { data: balanceAfter } = await admin
  .from("credit_balances")
  .select("balance")
  .eq("user_id", userId)
  .single();
assert.equal(balanceAfter?.balance, balanceBefore + 100);

console.log("atomic-grant-hosted-staging.test: PASS");