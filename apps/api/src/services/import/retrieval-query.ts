import type { AppBindings } from "../../env.js";
import { embedTextsWithProvider } from "./embedding.js";
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

/**
 * Build combined query text from beat context for embedding.
 */
export function buildRetrievalQueryText(input: RetrievalQueryInput): string {
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
 * Embed query text via the centralized embedding route (registry + policy
 * provider credential/endpoint). Best-effort: retrieval is non-critical, so a
 * provider/config failure returns null rather than failing the write flow.
 */
async function embedQueryText(
  bindings: AppBindings,
  text: string,
): Promise<number[] | null> {
  try {
    const result = await embedTextsWithProvider(bindings, [text]);
    return result.embeddings[0] ?? null;
  } catch (err) {
    console.error("embedding request failed:", err);
    return null;
  }
}

/**
 * Retrieve relevant draft memory snippets by embedding beat context
 * and performing similarity search against stored prose embeddings.
 */
export async function retrieveRelevantDraftMemory(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  input: RetrievalQueryInput,
): Promise<SemanticRetrievalSnippet[]> {
  const queryText = buildRetrievalQueryText(input);
  if (!queryText.trim()) return [];

  const embedding = await embedQueryText(bindings, queryText);
  if (!embedding) return [];

  const snippets = await matchProseEmbeddings(bindings, ownerId, projectId, embedding);
  return snippets.slice(0, 5);
}
