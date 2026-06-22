import type { JsonObject, RetrievalMemorySnippet, WriterContextPacket } from "@vibenovel/shared";

export interface RetrievedProseEmbeddingRow {
  sourceRef: string;
  chunkText: string;
  similarity?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface RetrievalSnippetOptions {
  topK?: number;
  maxSnippetChars?: number;
}

function truncateSnippet(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 3) return normalized.slice(0, maxChars);
  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
}

function toJsonObject(value: Record<string, unknown> | null | undefined): JsonObject {
  if (!value) return {};
  return value as JsonObject;
}

export function buildReadOnlyRetrievalSnippets(
  rows: RetrievedProseEmbeddingRow[],
  options: RetrievalSnippetOptions = {},
): RetrievalMemorySnippet[] {
  const topK = Math.max(0, Math.floor(options.topK ?? 5));
  const maxSnippetChars = Math.max(24, Math.floor(options.maxSnippetChars ?? 500));

  return [...rows]
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, topK)
    .map((row) => ({
      sourceRef: row.sourceRef,
      text: truncateSnippet(row.chunkText, maxSnippetChars),
      similarity: row.similarity ?? null,
      readOnly: true,
      usage: "context_only",
      metadata: {
        ...toJsonObject(row.metadata),
        memorySource: "prose_embeddings",
      },
    }));
}

export function attachReadOnlyRetrievalMemoryToPacket(
  packet: WriterContextPacket,
  snippets: RetrievalMemorySnippet[],
): WriterContextPacket {
  const sanitized = snippets.map((snippet) => ({
    sourceRef: snippet.sourceRef,
    text: snippet.text,
    similarity: snippet.similarity,
    readOnly: true as const,
    usage: "context_only" as const,
    metadata: snippet.metadata,
  }));

  return {
    ...packet,
    continuity: {
      ...packet.continuity,
      retrievalMemory: sanitized,
    },
  };
}
