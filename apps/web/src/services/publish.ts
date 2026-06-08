import type { PublishPackage } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface PublishListEntry extends PublishPackage {}

export interface GeneratePublishPackageResponse {
  publishPackage: PublishPackage;
  created: boolean;
}

export interface MarkPublishPackageExportedResponse {
  publishPackage: PublishPackage;
  alreadyExported: boolean;
  warnings: string[];
}

export type PublishFieldPatch = Partial<{
  displayTitle: string;
  teaser: string;
  shortSynopsis: string;
  caption: string;
  readerQuestion: string;
  nextChapterTeaser: string | null;
  tags: string[];
  genre: string | null;
  mobilePreviewExcerpt: string;
}>;

export interface PublishChecklistPatchItem {
  id: string;
  checked: boolean;
  note?: string;
}

export async function listPublishPackages(
  projectId: string,
  token?: string | null,
  query?: { chapterOutlineId?: string; status?: string },
): Promise<{ packages: PublishListEntry[] }> {
  const params = new URLSearchParams();
  if (query?.chapterOutlineId) params.set("chapterOutlineId", query.chapterOutlineId);
  if (query?.status) params.set("status", query.status);
  const qs = params.toString();
  return apiRequest<{ packages: PublishListEntry[] }>(
    `/api/projects/${projectId}/publish${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export async function getPublishPackage(
  projectId: string,
  packageId: string,
  token?: string | null,
): Promise<{ publishPackage: PublishPackage }> {
  return apiRequest<{ publishPackage: PublishPackage }>(
    `/api/projects/${projectId}/publish/${packageId}`,
    { token },
  );
}

export async function getPublishPackageByChapter(
  projectId: string,
  chapterOutlineId: string,
  token?: string | null,
): Promise<{ publishPackage: PublishPackage | null }> {
  return apiRequest<{ publishPackage: PublishPackage | null }>(
    `/api/projects/${projectId}/publish/by-chapter/${chapterOutlineId}`,
    { token },
  );
}

export async function generatePublishPackage(
  projectId: string,
  chapterOutlineId: string,
  token: string | null | undefined,
  options?: { chapterSummaryId?: string; regenerate?: boolean },
): Promise<GeneratePublishPackageResponse> {
  return apiRequest<GeneratePublishPackageResponse>(
    `/api/projects/${projectId}/publish/generate`,
    {
      method: "POST",
      body: {
        chapterOutlineId,
        ...(options?.chapterSummaryId ? { chapterSummaryId: options.chapterSummaryId } : {}),
        ...(options?.regenerate ? { regenerate: true } : {}),
      },
      token,
    },
  );
}

export async function updatePublishPackageFields(
  projectId: string,
  packageId: string,
  fields: PublishFieldPatch,
  token: string | null | undefined,
): Promise<{ publishPackage: PublishPackage }> {
  return apiRequest<{ publishPackage: PublishPackage }>(
    `/api/projects/${projectId}/publish/${packageId}/fields`,
    { method: "PATCH", body: fields, token },
  );
}

export async function updatePublishChecklist(
  projectId: string,
  packageId: string,
  items: PublishChecklistPatchItem[],
  token: string | null | undefined,
): Promise<{ publishPackage: PublishPackage }> {
  return apiRequest<{ publishPackage: PublishPackage }>(
    `/api/projects/${projectId}/publish/${packageId}/checklist`,
    { method: "PATCH", body: { items }, token },
  );
}

export async function markPublishPackageExported(
  projectId: string,
  packageId: string,
  token: string | null | undefined,
  input?: { exportTarget?: string; note?: string },
): Promise<MarkPublishPackageExportedResponse> {
  return apiRequest<MarkPublishPackageExportedResponse>(
    `/api/projects/${projectId}/publish/${packageId}/mark-exported`,
    {
      method: "POST",
      body: {
        exportTarget: input?.exportTarget ?? "kbm_manual_copy",
        ...(input?.note ? { note: input.note } : {}),
      },
      token,
    },
  );
}