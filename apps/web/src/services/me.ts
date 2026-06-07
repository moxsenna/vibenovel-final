import type { CreditBalance, UserProfile } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface MeApiResponse {
  user: { id: string; email: string };
  profile: UserProfile;
  creditBalance: CreditBalance | null;
}

export async function fetchMe(token?: string | null): Promise<MeApiResponse> {
  return apiRequest<MeApiResponse>("/api/me", { token });
}