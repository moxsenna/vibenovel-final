import type { GenerationType } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { DEFAULT_DAILY_DEBIT_CAP_V2 } from "./ai-credit-policy.js";

export interface AiRateLimitSnapshot {
  dailyDebitedCredits: number;
  dailyDebitCap: number;
  recentFailureCount: number;
  cooldownFailureThreshold: number;
  requestedCreditCost?: number;
}

export interface LoadAiRateLimitSnapshotInput {
  userId: string;
  projectId: string;
  generationType: GenerationType;
  requestedCreditCost: number;
}

const DEFAULT_COOLDOWN_FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MINUTES = 30;

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function failureWindowStart(): string {
  return new Date(Date.now() - FAILURE_WINDOW_MINUTES * 60_000).toISOString();
}

export function assertAiGenerationAllowed(
  snapshot: AiRateLimitSnapshot,
  requestedCreditCost = snapshot.requestedCreditCost ?? 0,
): void {
  if (snapshot.dailyDebitedCredits + requestedCreditCost > snapshot.dailyDebitCap) {
    throw new AppError(
      "AI_DAILY_CAP_EXCEEDED",
      "Daily AI credit cap reached for this project",
      429,
      {
        dailyDebitedCredits: snapshot.dailyDebitedCredits,
        dailyDebitCap: snapshot.dailyDebitCap,
        requestedCreditCost,
      },
    );
  }

  if (snapshot.recentFailureCount >= snapshot.cooldownFailureThreshold) {
    throw new AppError(
      "AI_FAILURE_COOLDOWN",
      "Too many recent AI generation failures; try again later",
      429,
      {
        recentFailureCount: snapshot.recentFailureCount,
        cooldownFailureThreshold: snapshot.cooldownFailureThreshold,
      },
    );
  }
}

export async function loadAiRateLimitSnapshot(
  bindings: AppBindings,
  input: LoadAiRateLimitSnapshotInput,
): Promise<AiRateLimitSnapshot> {
  const admin = createServiceRoleClient(bindings);
  let dailyDebitCap = DEFAULT_DAILY_DEBIT_CAP_V2;

  try {
    const { data: capRow } = await admin
      .from("ai_usage_daily_caps")
      .select("daily_credit_cap")
      .eq("user_id", input.userId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    const cap = (capRow as { daily_credit_cap?: number } | null)?.daily_credit_cap;
    if (
      typeof cap === "number" &&
      Number.isInteger(cap) &&
      cap >= input.requestedCreditCost
    ) {
      dailyDebitCap = cap;
    }
  } catch {
    dailyDebitCap = DEFAULT_DAILY_DEBIT_CAP_V2;
  }

  const { data: debitRows, error: debitError } = await admin
    .from("credit_ledger")
    .select("amount")
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("direction", "debit")
    .eq("reason", "generation_debit")
    .gte("created_at", startOfUtcDay());

  if (debitError) {
    console.error("credit_ledger daily AI cap query failed");
    throw AppError.internal("Failed to verify AI usage cap");
  }

  const dailyDebitedCredits = ((debitRows ?? []) as { amount: number }[]).reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );

  const { count, error: failureError } = await admin
    .from("generation_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("generation_type", input.generationType)
    .eq("status", "failed")
    .gte("updated_at", failureWindowStart());

  if (failureError) {
    console.error("generation_attempts cooldown query failed");
    throw AppError.internal("Failed to verify AI failure cooldown");
  }

  return {
    dailyDebitedCredits,
    dailyDebitCap,
    recentFailureCount: count ?? 0,
    cooldownFailureThreshold: DEFAULT_COOLDOWN_FAILURE_THRESHOLD,
    requestedCreditCost: input.requestedCreditCost,
  };
}

export async function assertAiGenerationAllowedForOwner(
  bindings: AppBindings,
  input: LoadAiRateLimitSnapshotInput,
): Promise<void> {
  const snapshot = await loadAiRateLimitSnapshot(bindings, input);
  assertAiGenerationAllowed(snapshot);
}
