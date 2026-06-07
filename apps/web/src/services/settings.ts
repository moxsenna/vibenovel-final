import type { WriterQualityMode } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface ProjectSettingsApiResponse {
  qualityMode: WriterQualityMode;
  qualityTier: WriterQualityMode;
  defaultOutputStyle: string;
  defaultFormat: string;
  outputStylePreference?: string;
  mobileFormatPreference?: string;
  defaultLanguage?: string | null;
  defaultGenre?: string | null;
}

export async function fetchProjectSettings(
  projectId: string,
  token?: string | null,
): Promise<ProjectSettingsApiResponse> {
  return apiRequest<ProjectSettingsApiResponse>(`/api/projects/${projectId}/settings`, {
    token,
  });
}

export async function updateProjectSettings(
  projectId: string,
  body: { qualityMode: WriterQualityMode },
  token?: string | null,
): Promise<ProjectSettingsApiResponse> {
  return apiRequest<ProjectSettingsApiResponse>(`/api/projects/${projectId}/settings`, {
    method: "PUT",
    body,
    token,
  });
}