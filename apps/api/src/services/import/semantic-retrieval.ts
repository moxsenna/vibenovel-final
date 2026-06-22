import type { AppBindings } from "../../env.js";
import { createServiceRoleClient } from "../../lib/supabase.js";

export interface SemanticRetrievalSnippet {
  sourceRef: string;
  chunkText: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Match prose embeddings via RPC (requires migration 00023).
 * Falls back to empty array if the RPC function is not available or query fails.
 */
export async function matchProseEmbeddings(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  queryEmbedding: number[],
  matchCount = 5,
  minSimilarity = 0.7,
): Promise<SemanticRetrievalSnippet[]> {
  try {
    const admin = createServiceRoleClient(bindings);
    const { data, error } = await admin.rpc("match_prose_embeddings", {
      p_owner_id: ownerId,
      p_project_id: projectId,
      p_query_embedding: queryEmbedding,
      p_match_count: Math.min(Math.max(matchCount, 1), 8),
      p_min_similarity: minSimilarity,
    });

    if (error) {
      console.error("semantic retrieval rpc failed:", error.message);
      return [];
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      sourceRef: row.sourceRef as string ?? row.source_ref as string ?? "",
      chunkText: row.chunkText as string ?? row.chunk_text as string ?? "",
      similarity: row.similarity as number ?? 0,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }));
  } catch (err) {
    console.error("semantic retrieval failed:", err);
    return [];
  }
}
