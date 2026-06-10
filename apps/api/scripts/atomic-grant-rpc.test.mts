/**
 * Task 10.16 — Direct RPC idempotency tests (local Supabase required).
 * Run: npm run test:atomic-grant -w @vibenovel/api
 * Requires migration 00010 applied (supabase db reset or migration up).
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
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

function resolveLocalSupabase(): { url: string; serviceRole: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceRole) return { url, serviceRole };

  try {
    const out = execSync("supabase status --output json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      cwd: resolveRepoRoot(),
    });
    const parsed = JSON.parse(out) as { API_URL?: string; SERVICE_ROLE_KEY?: string };
    if (parsed.API_URL && parsed.SERVICE_ROLE_KEY) {
      return { url: parsed.API_URL, serviceRole: parsed.SERVICE_ROLE_KEY };
    }
  } catch {
    // local supabase not running
  }
  return null;
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

const creds = resolveLocalSupabase();
if (!creds) {
  console.log("atomic-grant-rpc.test: SKIP (local Supabase not available)");
  process.exit(0);
}

const admin = createClient(creds.url, creds.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `atomic-grant-${Date.now()}@vibenovel.test`;
const password = "AtomicGrant-Test-Password-1!";

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
  display_name: "Atomic Grant Test",
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
  payment_url: "https://example.test/pay",
  amount_idr: 39000,
  credits_to_grant: 100,
  status: "pending",
  idempotency_key: `atomic-grant-test-${orderId}`,
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
  p_metadata: { orderId, test: "atomic-grant-rpc" },
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
  payment_url: "https://example.test/pay2",
  amount_idr: 39000,
  credits_to_grant: 100,
  status: "pending",
  idempotency_key: `atomic-grant-mm-${mismatchOrderId}`,
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

console.log("atomic-grant-rpc.test: PASS");