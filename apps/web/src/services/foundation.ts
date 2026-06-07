import type { Character, Fact, StoryFoundation } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface FoundationBundleResponse {
  foundation: StoryFoundation;
  characters: Character[];
  facts: Fact[];
}

export async function fetchFoundationBundle(
  projectId: string,
  token?: string | null,
): Promise<FoundationBundleResponse> {
  return apiRequest<FoundationBundleResponse>(`/api/projects/${projectId}/foundation`, {
    token,
  });
}