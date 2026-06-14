import { apiRequest } from "@/lib/api";

export interface DraftImportSummary {
  id: string;
  projectId: string;
  ownerId: string;
  contentHash: string;
  excerptPreview: string;
  wordCount: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DraftImportSignal {
  id: string;
  draftImportId: string;
  projectId: string;
  type: string;
  label: string;
  value: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DraftImportResponse {
  draftImport: DraftImportSummary;
  signals?: DraftImportSignal[];
}

export interface DraftImportWithSignalsResponse {
  draftImport: DraftImportSummary;
  signals: DraftImportSignal[];
}

export async function createDraftImport(
  projectId: string,
  content: string,
  token?: string | null,
): Promise<DraftImportResponse> {
  return apiRequest<DraftImportResponse>(`/api/projects/${projectId}/draft-imports`, {
    method: "POST",
    body: { content },
    token,
  });
}

export async function fetchDraftImport(
  projectId: string,
  draftImportId: string,
  token?: string | null,
): Promise<DraftImportWithSignalsResponse> {
  return apiRequest<DraftImportWithSignalsResponse>(
    `/api/projects/${projectId}/draft-imports/${draftImportId}`,
    { token },
  );
}

export async function extractDraftImportSignals(
  projectId: string,
  draftImportId: string,
  token?: string | null,
): Promise<DraftImportWithSignalsResponse> {
  return apiRequest<DraftImportWithSignalsResponse>(
    `/api/projects/${projectId}/draft-imports/${draftImportId}/extract-signals`,
    { method: "POST", token },
  );
}
