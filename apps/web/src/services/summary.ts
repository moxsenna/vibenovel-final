import type { ChapterDelta, ChapterSummary, ChapterSummaryItem } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface LinkedProposalSummary {
  linkId: string;
  linkStatus: string;
  proposalId: string;
  type: string;
  status: string;
  riskLevel: string;
  title: string;
  summary: string | null;
  payloadExcerpt: Record<string, unknown>;
  source: string;
  metadata: Record<string, unknown>;
}

export interface SummaryListEntry extends ChapterSummary {
  itemCount: number;
}

export interface SummaryDetailResponse {
  summary: ChapterSummary;
  items: ChapterSummaryItem[];
}

export interface GenerateSummaryResponse extends SummaryDetailResponse {
  created: boolean;
}

export interface ExtractDeltaResponse {
  delta: ChapterDelta;
  proposals: LinkedProposalSummary[];
  created: boolean;
}

export interface ApproveSummaryResponse {
  summary: ChapterSummary;
  items: ChapterSummaryItem[];
  proposalCounts: {
    linked: number;
    accepted: number;
    rejected: number;
  };
  alreadyApproved: boolean;
  warnings: string[];
}

export interface AcceptLinkedProposalResponse {
  proposal: LinkedProposalSummary;
  promoted: {
    entityType: string;
    entityId: string;
    created: boolean;
    summary?: Record<string, unknown>;
  } | null;
  alreadyAccepted: boolean;
}

export interface RejectLinkedProposalResponse {
  proposal: LinkedProposalSummary;
  alreadyRejected: boolean;
}

export async function listSummaries(
  projectId: string,
  token?: string | null,
  query?: { chapterOutlineId?: string; status?: string },
): Promise<{ summaries: SummaryListEntry[] }> {
  const params = new URLSearchParams();
  if (query?.chapterOutlineId) params.set("chapterOutlineId", query.chapterOutlineId);
  if (query?.status) params.set("status", query.status);
  const qs = params.toString();
  return apiRequest<{ summaries: SummaryListEntry[] }>(
    `/api/projects/${projectId}/summary${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export async function getSummary(
  projectId: string,
  summaryId: string,
  token?: string | null,
): Promise<SummaryDetailResponse> {
  return apiRequest<SummaryDetailResponse>(
    `/api/projects/${projectId}/summary/${summaryId}`,
    { token },
  );
}

export async function getSummaryByChapter(
  projectId: string,
  chapterOutlineId: string,
  token?: string | null,
): Promise<SummaryDetailResponse & { summary: ChapterSummary | null }> {
  return apiRequest<SummaryDetailResponse & { summary: ChapterSummary | null }>(
    `/api/projects/${projectId}/summary/by-chapter/${chapterOutlineId}`,
    { token },
  );
}

export async function generateSummary(
  projectId: string,
  token: string | null | undefined,
  body: {
    chapterOutlineId: string;
    writingSessionId?: string;
    regenerate?: boolean;
  },
): Promise<GenerateSummaryResponse> {
  return apiRequest<GenerateSummaryResponse>(
    `/api/projects/${projectId}/summary/generate`,
    { method: "POST", body, token },
  );
}

export async function extractDelta(
  projectId: string,
  summaryId: string,
  token: string | null | undefined,
  body: { regenerate?: boolean } = {},
): Promise<ExtractDeltaResponse> {
  return apiRequest<ExtractDeltaResponse>(
    `/api/projects/${projectId}/summary/${summaryId}/delta/extract`,
    { method: "POST", body, token },
  );
}

export async function getDelta(
  projectId: string,
  summaryId: string,
  token?: string | null,
): Promise<{ delta: ChapterDelta | null }> {
  return apiRequest<{ delta: ChapterDelta | null }>(
    `/api/projects/${projectId}/summary/${summaryId}/delta`,
    { token },
  );
}

export async function getLinkedProposals(
  projectId: string,
  summaryId: string,
  token?: string | null,
): Promise<{ proposals: LinkedProposalSummary[] }> {
  return apiRequest<{ proposals: LinkedProposalSummary[] }>(
    `/api/projects/${projectId}/summary/${summaryId}/proposals`,
    { token },
  );
}

export async function approveSummary(
  projectId: string,
  summaryId: string,
  token: string | null | undefined,
): Promise<ApproveSummaryResponse> {
  return apiRequest<ApproveSummaryResponse>(
    `/api/projects/${projectId}/summary/${summaryId}/approve`,
    { method: "POST", body: {}, token },
  );
}

export async function acceptLinkedProposal(
  projectId: string,
  summaryId: string,
  proposalId: string,
  token: string | null | undefined,
  body: { confirmHighRisk?: boolean } = {},
): Promise<AcceptLinkedProposalResponse> {
  return apiRequest<AcceptLinkedProposalResponse>(
    `/api/projects/${projectId}/summary/${summaryId}/proposals/${proposalId}/accept`,
    { method: "POST", body, token },
  );
}

export async function rejectLinkedProposal(
  projectId: string,
  summaryId: string,
  proposalId: string,
  token: string | null | undefined,
  body: { reason?: string } = {},
): Promise<RejectLinkedProposalResponse> {
  return apiRequest<RejectLinkedProposalResponse>(
    `/api/projects/${projectId}/summary/${summaryId}/proposals/${proposalId}/reject`,
    { method: "POST", body, token },
  );
}