import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { DEFAULT_DAILY_DEBIT_CAP_V2 } from "./ai-credit-policy.js";
import type { AppBindings } from "../env.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AiRateLimitSnapshot {
  dailyDebitedCredits: number;
  dailyDebitCap: number;
  recentFailureCount: number;
  cooldownFailureThreshold: number;
}

export interface AiRateLimitForOwnerInput {
  userId: string;
  projectId: string;
  generationType: string;
  requestedCreditCost: number;
}

/* ------------------------------------------------------------------ */
/*  Pure guard — no I/O, fully testable                                */
/* ------------------------------------------------------------------ */

/**
 * Core rate-limit guard. Throws AppError if daily cap exceeded or
 * failure cooldown is active.
 */
export function assertAiGenerationAllowed(
  snapshot: AiRateLimitSnapshot,
  requested: number = 0,
): void {
  if (snapshot.dailyDebitedCredits + requested > snapshot.dailyDebitCap) {
    throw new AppError(
      "AI_DAILY_CAP_EXCEEDED",
      `Daily generation cap of ${snapshot.dailyDebitCap} credits exceeded. ` +
        `Current: ${snapshot.dailyDebitedCredits}, Requested: ${requested}`,
      429,
    );
  }

  if (snapshot.recentFailureCount >= snapshot.cooldownFailureThreshold) {
    throw new AppError(
      "AI_FAILURE_COOLDOWN",
      `Generation blocked due to ${snapshot.recentFailureCount} recent failures. ` +
        `Threshold: ${snapshot.cooldownFailureThreshold}`,
      429,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Loader — reads daily debits and failure count from DB              */
/* ------------------------------------------------------------------ */

export async function loadAiRateLimitSnapshot(
  bindings: AppBindings,
  projectId: string,
): Promise<AiRateLimitSnapshot> {
  const admin = createServiceRoleClient(bindings);

  // Sum today's generation debits for this project
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: ledgerData } = await admin
    .from("credit_ledger")
    .select("amount")
    .eq("project_id", projectId)
    .eq("direction", "debit")
    .eq("reason", "generation_debit")
    .gte("created_at", todayStart.toISOString());

  const dailyDebitedCredits =
    ledgerData?.reduce(
      (sum: number, row: { amount: number }) => sum + (row.amount ?? 0),
      0,
    ) ?? 0;

  // Count recent failures (last 30 minutes)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: failureCount } = await admin
    .from("generation_attempts")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "failed")
    .gte("created_at", thirtyMinAgo);

  // Check project-level override
  const { data: capRow } = await admin
    .from("ai_usage_daily_caps")
    .select("daily_debit_cap")
    .eq("project_id", projectId)
    .maybeSingle();

  const dailyDebitCap =
    (capRow as { daily_debit_cap: number } | null)?.daily_debit_cap ??
    DEFAULT_DAILY_DEBIT_CAP_V2;

  return {
    dailyDebitedCredits,
    dailyDebitCap,
    recentFailureCount: failureCount ?? 0,
    cooldownFailureThreshold: 3,
  };
}

/* ------------------------------------------------------------------ */
/*  Convenience guard — loads + checks in one call                     */
/* ------------------------------------------------------------------ */

export async function assertAiGenerationAllowedForOwner(
  bindings: AppBindings,
  input: AiRateLimitForOwnerInput,
): Promise<void> {
  const snapshot = await loadAiRateLimitSnapshot(bindings, input.projectId);
  assertAiGenerationAllowed(snapshot, input.requestedCreditCost);
}
