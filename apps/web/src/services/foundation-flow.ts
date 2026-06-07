import type { AiProposal, Character, Fact, StoryFoundation } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";
import type { FoundationBundleResponse } from "@/services/foundation";

export interface FoundationProposalsResponse {
  proposals: AiProposal[];
}

export interface GenerateFoundationProposalsResponse {
  proposals: AiProposal[];
  created: boolean;
  batchId: string | null;
}

export interface FoundationReadinessResponse {
  readinessScore: number;
  readinessLevel: string;
  canLock: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: string;
    reason: string;
  }>;
  missing: string[];
}

export interface LockFoundationResponse {
  foundation: StoryFoundation;
  readiness: FoundationReadinessResponse;
  promoted: {
    characters: Character[];
    facts: Fact[];
    speechRules: Array<{
      id: string;
      relationshipLabel: string;
      ruleText: string;
      status: string;
    }>;
  };
}

export async function fetchFoundationProposals(
  projectId: string,
  token?: string | null,
  includeResolved = false,
): Promise<AiProposal[]> {
  const query = includeResolved ? "?includeResolved=true" : "";
  const data = await apiRequest<FoundationProposalsResponse>(
    `/api/projects/${projectId}/foundation/proposals${query}`,
    { token },
  );
  return data.proposals;
}

export async function generateFoundationProposals(
  projectId: string,
  token?: string | null,
  body: Record<string, unknown> = {},
): Promise<GenerateFoundationProposalsResponse> {
  return apiRequest<GenerateFoundationProposalsResponse>(
    `/api/projects/${projectId}/foundation/proposals/generate`,
    { method: "POST", body, token },
  );
}

export async function fetchFoundationReadiness(
  projectId: string,
  token?: string | null,
): Promise<FoundationReadinessResponse> {
  return apiRequest<FoundationReadinessResponse>(
    `/api/projects/${projectId}/foundation/readiness`,
    { token },
  );
}

export async function lockFoundation(
  projectId: string,
  token?: string | null,
): Promise<LockFoundationResponse> {
  return apiRequest<LockFoundationResponse>(`/api/projects/${projectId}/foundation/lock`, {
    method: "POST",
    token,
  });
}

export async function acceptProposal(
  projectId: string,
  proposalId: string,
  token?: string | null,
): Promise<AiProposal> {
  return apiRequest<AiProposal>(
    `/api/projects/${projectId}/proposals/${proposalId}/accept`,
    { method: "POST", token },
  );
}

export type { FoundationBundleResponse };