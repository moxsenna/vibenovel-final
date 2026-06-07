import type { CreditBalance } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapCreditBalanceRow, type CreditBalanceRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";

/** Read-only credit balance for /api/me and /api/credits/balance — no ledger or mutation. */
export async function getCreditBalanceForUser(
  bindings: AppBindings,
  userId: string,
): Promise<CreditBalance | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("credit_balances")
    .select(
      "id, user_id, balance, monthly_quota, monthly_used, reset_at, source, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("credit_balances select failed");
    throw AppError.internal("Failed to load credit balance");
  }

  if (!data) return null;
  return mapCreditBalanceRow(data as CreditBalanceRow);
}