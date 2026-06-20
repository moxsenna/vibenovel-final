import type { AppBindings } from "../../env.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { embedTextsWithOpenRouter } from "./embedding.js";
import { matchProseEmbeddings } from "./semantic-retrieval.js";
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

export async function retrieveRelevantDraftMemory(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  input: RetrievalQueryInput,
): Promise<SemanticRetrievalSnippet[]> {
  const queryText = buildQueryText(input);
  if (!queryText.trim()) return [];

  try {
    const embedding = await embedTextsWithOpenRouter(bindings, [queryText]);
    if (!embedding?.length) return [];

    const snippets = await matchProseEmbeddings(
      bindings,
      ownerId,
      projectId,
      embedding[0],
    );
    return snippets.slice(0, 5);
  } catch (err) {
    console.error("retrieval query failed", err);
    return [];
  }
}
