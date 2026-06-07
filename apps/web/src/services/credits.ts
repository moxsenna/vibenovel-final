import type { CreditBalance } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

interface CreditBalanceResponse {
  creditBalance: CreditBalance | null;
}

export async function fetchCreditBalance(
  token?: string | null,
): Promise<CreditBalance | null> {
  const data = await apiRequest<CreditBalanceResponse>("/api/credits/balance", { token });
  return data.creditBalance;
}