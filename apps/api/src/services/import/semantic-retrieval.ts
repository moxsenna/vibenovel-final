export interface SemanticRetrievalSnippet {
  sourceRef: string;
  chunkText: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Match prose embeddings via RPC — requires migration 00023.
 * Stub returns empty array when the RPC function is not available.
 */
export async function matchProseEmbeddings(): Promise<SemanticRetrievalSnippet[]> {
  return [];
}
