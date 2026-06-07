import type { ChapterOutline, OpenLoop, OutlinePlan } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

/** API redacted reveal — never includes planningTruth. */
export interface PlannedRevealPublic {
  id: string;
  projectId: string;
  outlinePlanId: string;
  plannedChapterOutlineId: string | null;
  relatedFactId: string | null;
  relatedProposalId: string | null;
  title: string;
  readerFacingHint: string | null;
  forbiddenBeforeChapter: number | null;
  status: string;
  riskLevel: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  planningTruthRedacted: true;
}

export interface OutlineBundleResponse {
  outlinePlan: OutlinePlan | null;
  chapterOutlines: ChapterOutline[];
  openLoops: OpenLoop[];
  plannedReveals: PlannedRevealPublic[];
  planningTruthRedacted: true;
}

export interface GenerateOutlineResponse extends OutlineBundleResponse {
  created: boolean;
  regenerated: boolean;
}

export interface OutlineWorkflowCheck {
  key: string;
  label: string;
  status: string;
  reason: string;
}

export interface ApproveOutlineResponse {
  outlinePlan: OutlinePlan;
  chapters: ChapterOutline[];
  checks: OutlineWorkflowCheck[];
  canLock: boolean;
}

export interface LockOutlineResponse {
  outlinePlan: OutlinePlan;
  chapters: ChapterOutline[];
  checks: OutlineWorkflowCheck[];
  locked: true;
}

export interface PatchChapterOutlineInput {
  title?: string;
  summary?: string;
  endingHook?: string;
  miniVictory?: string | null;
}

export async function fetchOutlineBundle(
  projectId: string,
  token?: string | null,
): Promise<OutlineBundleResponse> {
  return apiRequest<OutlineBundleResponse>(`/api/projects/${projectId}/outline`, { token });
}

export async function generateOutline(
  projectId: string,
  token?: string | null,
  body: Record<string, unknown> = {},
): Promise<GenerateOutlineResponse> {
  return apiRequest<GenerateOutlineResponse>(
    `/api/projects/${projectId}/outline/generate`,
    { method: "POST", body, token },
  );
}

export async function patchChapterOutline(
  projectId: string,
  chapterId: string,
  token: string | null | undefined,
  body: PatchChapterOutlineInput,
): Promise<ChapterOutline> {
  return apiRequest<ChapterOutline>(
    `/api/projects/${projectId}/outline/chapters/${chapterId}`,
    { method: "PATCH", body, token },
  );
}

export async function approveOutline(
  projectId: string,
  token?: string | null,
): Promise<ApproveOutlineResponse> {
  return apiRequest<ApproveOutlineResponse>(`/api/projects/${projectId}/outline/approve`, {
    method: "POST",
    token,
  });
}

export async function lockOutline(
  projectId: string,
  token?: string | null,
): Promise<LockOutlineResponse> {
  return apiRequest<LockOutlineResponse>(`/api/projects/${projectId}/outline/lock`, {
    method: "POST",
    token,
  });
}