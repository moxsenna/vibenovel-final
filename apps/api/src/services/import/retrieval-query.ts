import type { AppBindings } from "../../env.js";
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

const RETRIEVAL_PROVIDER_EMBEDDING_MODEL = "openai/text-embedding-3-small";

async function embedTextViaOpenRouter(
  bindings: AppBindings,
  text: string,
): Promise<number[] | null> {
  try {
    const apiKey = bindings.OPENROUTER_API_KEY?.trim();
    if (!apiKey) return null;

    const baseUrl = bindings.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: RETRIEVAL_PROVIDER_EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      console.error("embedding provider returned", response.status);
      return null;
    }

    const json = await response.json() as { data?: Array<{ embedding: number[] }> };
    return json.data?.[0]?.embedding ?? null;
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

  const embedding = await embedTextViaOpenRouter(bindings, queryText);
  if (!embedding) return [];

  const snippets = await matchProseEmbeddings(bindings, ownerId, projectId, embedding);
  return snippets.slice(0, 5);
}
