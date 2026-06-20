import type { SemanticRetrievalSnippet } from "./semantic-retrieval.js";

export interface RetrievalQueryInput {
  chapterTitle: string;
  chapterPurpose: string | null;
  beatTitle: string;
  beatSummary: string;
  beatDirection: string | null;
  mustInclude: string[];
  relevantCharacterNames: string[];
  activeOpenLoopQuestions: string[];
}

function buildQueryText(input: RetrievalQueryInput): string {
  const parts: string[] = [
    input.chapterTitle,
    input.chapterPurpose ?? "",
    input.beatTitle,
    input.beatSummary,
    input.beatDirection ?? "",
    ...input.mustInclude,
    ...input.relevantCharacterNames,
    ...input.activeOpenLoopQuestions,
  ];
  return parts.filter((s) => s.trim()).join(". ");
}

/**
 * Retrieval query builder — generates a combined query text from beat context.
 * Embedding + semantic matching is done at call time by the integration layer.
 */
export function buildRetrievalQueryText(input: RetrievalQueryInput): string {
  return buildQueryText(input);
}

export async function retrieveRelevantDraftMemory(): Promise<SemanticRetrievalSnippet[]> {
  // Stub — requires embedding service from sprint 18
  return [];
}
