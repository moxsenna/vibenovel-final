import type { AppBindings } from "../../env.js";
import { createServiceRoleClient } from "../../lib/supabase.js";

export interface SemanticRetrievalSnippet {
  sourceRef: string;
  chunkText: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export async function matchProseEmbeddings(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  queryEmbedding: number[],
  matchCount = 5,
  minSimilarity = 0.7,
): Promise<SemanticRetrievalSnippet[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin.rpc("match_prose_embeddings", {
    p_owner_id: ownerId,
    p_project_id: projectId,
    p_query_embedding: queryEmbedding,
    p_match_count: Math.min(Math.max(matchCount, 1), 8),
    p_min_similarity: minSimilarity,
  });

  if (error) {
    console.error("semantic retrieval rpc failed", error);
    return [];
  }

  return ((data ?? []) as SemanticRetrievalSnippet[]).map((row) => ({
    sourceRef: row.sourceRef ?? row.source_ref ?? "",
    chunkText: row.chunkText ?? row.chunk_text ?? "",
    similarity: row.similarity ?? 0,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }));
}
