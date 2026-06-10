/**
 * Task 10.17 — Probe RPC/index on hosted staging (reads .env.staging, no secret output).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

function resolveRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "supabase", "config.toml"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

function loadStagingEnv(): { url: string; serviceRole: string; host: string } | null {
  const envPath = join(resolveRepoRoot(), ".env.staging");
  if (!existsSync(envPath)) return null;
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  const url = env.SUPABASE_URL?.trim();
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) return null;
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  if (host.includes("127.0.0.1") || host.includes("localhost")) return null;
  return { url, serviceRole, host };
}

const creds = loadStagingEnv();
if (!creds) {
  console.log("probe-hosted-atomic-grant: SKIP (no hosted .env.staging)");
  process.exit(0);
}

const admin = createClient(creds.url, creds.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fakeId = "00000000-0000-0000-0000-000000000099";
const { data, error } = await admin.rpc("grant_paid_credit_topup_atomic", {
  p_order_id: fakeId,
  p_provider: "duitku",
  p_amount_idr: 39000,
});

if (error) {
  console.log("probe-hosted-atomic-grant: FAIL", error.code ?? "error", (error.message ?? "").slice(0, 80));
  process.exit(1);
}

const result = data as { granted?: boolean; reason?: string };
if (result.granted === false && result.reason === "unknown_order") {
  console.log(`probe-hosted-atomic-grant: PASS host=${creds.host} rpc=callable unknown_order=ok`);
  process.exit(0);
}

console.log("probe-hosted-atomic-grant: FAIL unexpected", JSON.stringify({ granted: result.granted, reason: result.reason }));
process.exit(1);