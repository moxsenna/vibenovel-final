import type { CreditBalance, StoryConcept } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface ConceptsListResponse {
  concepts: StoryConcept[];
}

export interface GenerateConceptsResponse {
  concepts: StoryConcept[];
  created: boolean;
  creditCost: number;
  creditBalance: CreditBalance | null;
  idempotentReplay: boolean;
}

export interface GenerateConceptsInput {
  idempotencyKey: string;
  regenerate?: boolean;
  basedOnSignals?: boolean;
}

export function buildConceptGenerationIdempotencyKey(projectId: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `concept-${projectId}-${Date.now()}-${suffix}`;
}

export interface SelectConceptResponse {
  concept: StoryConcept;
  project: {
    id: string;
    selectedConceptId: string | null;
    workflowPhase: string | null;
  };
}

export async function fetchConcepts(
  projectId: string,
  token?: string | null,
): Promise<StoryConcept[]> {
  const data = await apiRequest<ConceptsListResponse>(`/api/projects/${projectId}/concepts`, {
    token,
  });
  return data.concepts;
}

export async function generateConcepts(
  projectId: string,
  token: string | null | undefined,
  body: GenerateConceptsInput,
): Promise<GenerateConceptsResponse> {
  return apiRequest<GenerateConceptsResponse>(
    `/api/projects/${projectId}/concepts/generate`,
    { method: "POST", body, token },
  );
}

export async function selectConcept(
  projectId: string,
  conceptId: string,
  token?: string | null,
): Promise<SelectConceptResponse> {
  return apiRequest<SelectConceptResponse>(
    `/api/projects/${projectId}/concepts/${conceptId}/select`,
    { method: "POST", token },
  );
}
