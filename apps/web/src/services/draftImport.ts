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

export interface ImportJobSummary {
  id: string;
  projectId: string;
  ownerId: string;
  draftImportId: string | null;
  status: string;
  currentPhase: string;
  progressPercent: number;
  errorCode: string | null;
  errorMessageSafe: string | null;
  phaseState: Record<string, unknown>;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
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

export interface DraftImportJobResponse {
  importJob: ImportJobSummary | null;
}

export interface DraftImportJobResumeResponse {
  importJob: ImportJobSummary;
  resumed: boolean;
}

export interface DraftImportProposalMaterializeResponse {
  draftImport: DraftImportSummary;
  proposalCount: number;
  proposalIds: string[];
  proposalTypes: string[];
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

export async function fetchLatestDraftImportJob(
  projectId: string,
  draftImportId: string,
  token?: string | null,
): Promise<DraftImportJobResponse> {
  return apiRequest<DraftImportJobResponse>(
    `/api/projects/${projectId}/draft-imports/${draftImportId}/import-jobs/latest`,
    { token },
  );
}

export async function resumeDraftImportJob(
  projectId: string,
  draftImportId: string,
  token?: string | null,
): Promise<DraftImportJobResumeResponse> {
  return apiRequest<DraftImportJobResumeResponse>(
    `/api/projects/${projectId}/draft-imports/${draftImportId}/import-jobs/resume`,
    { method: "POST", token },
  );
}

export async function materializeDraftImportProposals(
  projectId: string,
  draftImportId: string,
  token?: string | null,
): Promise<DraftImportProposalMaterializeResponse> {
  return apiRequest<DraftImportProposalMaterializeResponse>(
    `/api/projects/${projectId}/draft-imports/${draftImportId}/materialize-proposals`,
    { method: "POST", token },
  );
}
