import type { JsonObject } from "@vibenovel/shared";

const DEFAULT_MAX_CHUNK_CHARS = 1_200;
const MIN_MAX_CHUNK_CHARS = 120;
const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const WORD_RE = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;

export interface DraftImportChunk {
  projectId: string;
  draftImportId: string;
  sourceRef: string;
  chunkIndex: number;
  chunkText: string;
  chunkHash: string;
  charCount: number;
  wordCount: number;
  metadata: JsonObject;
}

export interface ChunkDraftForImportInput {
  projectId: string;
  draftImportId: string;
  content: string;
  maxChunkChars?: number;
}

export function countDraftWords(text: string): number {
  const cjkMatches = text.match(CJK_CHAR_RE) ?? [];
  const latinText = text.replace(CJK_CHAR_RE, " ");
  const wordMatches = latinText.match(WORD_RE) ?? [];
  return cjkMatches.length + wordMatches.length;
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeMaxChunkChars(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return DEFAULT_MAX_CHUNK_CHARS;
  return Math.max(MIN_MAX_CHUNK_CHARS, Math.floor(value));
}

function splitLongParagraph(paragraph: string, maxChunkChars: number): string[] {
  if (paragraph.length <= maxChunkChars) return [paragraph];

  const parts: string[] = [];
  let remaining = paragraph.trim();
  while (remaining.length > maxChunkChars) {
    const window = remaining.slice(0, maxChunkChars + 1);
    const splitAt = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("。"),
      window.lastIndexOf(" "),
    );
    const end = splitAt > Math.floor(maxChunkChars * 0.5) ? splitAt + 1 : maxChunkChars;
    parts.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function groupParagraphs(content: string, maxChunkChars: number): string[] {
  const paragraphs = content
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitLongParagraph(paragraph, maxChunkChars));

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    const candidate = `${current}\n\n${paragraph}`;
    if (candidate.length <= maxChunkChars) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    current = paragraph;
  }

  if (current) chunks.push(current);
  return chunks;
}

export async function chunkDraftForImport(
  input: ChunkDraftForImportInput,
): Promise<DraftImportChunk[]> {
  const maxChunkChars = normalizeMaxChunkChars(input.maxChunkChars);
  const grouped = groupParagraphs(input.content.trim(), maxChunkChars);
  const chunks: DraftImportChunk[] = [];

  for (let index = 0; index < grouped.length; index += 1) {
    const chunkText = grouped[index];
    const chunkIndex = index + 1;
    chunks.push({
      projectId: input.projectId,
      draftImportId: input.draftImportId,
      sourceRef: `draft_import:${input.draftImportId}:chunk:${chunkIndex}`,
      chunkIndex,
      chunkText,
      chunkHash: await sha256Hex(chunkText),
      charCount: chunkText.length,
      wordCount: countDraftWords(chunkText),
      metadata: {
        source: "imported_draft",
        chunker: "draft_import_chunker_v1",
        maxChunkChars,
      },
    });
  }

  return chunks;
}
