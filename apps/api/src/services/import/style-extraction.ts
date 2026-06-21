import type { OperationalStyleRules } from "../style-profile.js";
import { DEFAULT_STYLE_RULES } from "../style-profile.js";

export function extractOperationalRules(content = ""): OperationalStyleRules {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeText(paragraph))
    .filter(Boolean);
  const sentences = normalizeText(content).match(SENTENCE_RE)?.map(normalizeText).filter(Boolean) ?? [];
  const paragraphWords = paragraphs.map((paragraph) => paragraph.split(/\s+/).length);
  const sentenceWords = sentences.map((sentence) => sentence.split(/\s+/).length);
  const averageParagraphWords = average(paragraphWords);
  const averageSentenceWords = average(sentenceWords);
  const dialogueMarkers = content.match(DIALOGUE_MARKER_RE)?.length ?? 0;
  const dialogueRatio = sentences.length > 0 ? dialogueMarkers / sentences.length : 0;

  return {
    ...DEFAULT_STYLE_RULES,
    paragraphLength:
      averageParagraphWords > 0 && averageParagraphWords <= 45
        ? "short"
        : averageParagraphWords >= 100
          ? "long"
          : "medium",
    averageSentenceWords:
      averageSentenceWords > 0 ? round(averageSentenceWords) : null,
    dialogueDensity:
      dialogueRatio >= 0.35 ? "high" : dialogueRatio >= 0.15 ? "medium" : "low",
    narrationStyle: [
      averageSentenceWords > 0 && averageSentenceWords <= 16
        ? "fast sentence rhythm"
        : "descriptive sentence rhythm",
    ],
    signatureMoves:
      paragraphs.length > 1 && paragraphs.at(-1)!.split(/\s+/).length <= 18
        ? ["compressed closing paragraph"]
        : [],
    expositionTolerance: averageParagraphWords <= 60 ? "low" : "medium",
  };
}
import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  type JsonObject,
} from "@vibenovel/shared";
import type { DraftImportChunk } from "./chunking.js";
import type { DraftImportProposalDraft } from "./entity-extraction.js";

const SENTENCE_RE = /[^.!?\n]+[.!?]?/g;
const DIALOGUE_MARKER_RE = /["']|^\s*-\s+/gm;

export interface AuthorVoiceExtraction {
  draftImportId: string;
  source: "imported_draft";
  authorVoice: string;
  styleTags: string[];
  sampleCount: number;
  metrics: JsonObject;
  operationalRules: OperationalStyleRules;
}

export interface ExtractAuthorVoiceInput {
  draftImportId: string;
  content: string;
  chunks: DraftImportChunk[];
}

export interface BuildAuthorVoiceProposalInput {
  projectId: string;
  draftImportId: string;
  authorVoice: AuthorVoiceExtraction;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function collectStyleTags(text: string, avgParagraphWords: number): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();

  if (/kbm|hp|serial|bab pendek|pembaca wanita|online/.test(lower)) {
    tags.add("hp_serial");
  }
  if (/balas dendam|revenge|bangkit|elegan|menang/.test(lower)) {
    tags.add("emotional_revenge");
  }
  if (/hina|mertua|suami|istri|keluarga|rumah tangga/.test(lower)) {
    tags.add("domestic_drama");
  }
  if (/rahasia|disembunyikan|masa lalu|anak/.test(lower)) {
    tags.add("secret_driven");
  }
  if (avgParagraphWords > 0 && avgParagraphWords <= 45) {
    tags.add("short_paragraphs");
  }

  return [...tags];
}

export function extractAuthorVoiceFromDraft(
  input: ExtractAuthorVoiceInput,
): AuthorVoiceExtraction {
  const content = normalizeText(input.content);
  const paragraphs = input.content
    .split(/\n\s*\n/g)
    .map((paragraph) => normalizeText(paragraph))
    .filter(Boolean);
  const sentences = content.match(SENTENCE_RE)?.map(normalizeText).filter(Boolean) ?? [];
  const paragraphWords = paragraphs.map((paragraph) =>
    paragraph.split(/\s+/).filter(Boolean).length,
  );
  const sentenceWords = sentences.map((sentence) => sentence.split(/\s+/).filter(Boolean).length);
  const dialogueMarkerCount = content.match(DIALOGUE_MARKER_RE)?.length ?? 0;
  const avgParagraphWords = average(paragraphWords);
  const avgSentenceWords = average(sentenceWords);
  const dialogueDensity = sentences.length > 0 ? dialogueMarkerCount / sentences.length : 0;
  const styleTags = collectStyleTags(content, avgParagraphWords);
  const operationalRules = extractOperationalRules(input.content);

  const rhythm =
    avgParagraphWords > 0 && avgParagraphWords <= 45
      ? "paragraf pendek dan mudah discroll"
      : "paragraf sedang dengan ruang narasi lebih luas";
  const sentenceRhythm =
    avgSentenceWords > 0 && avgSentenceWords <= 16
      ? "kalimat relatif cepat"
      : "kalimat cenderung deskriptif";
  const dialogueCue =
    dialogueDensity >= 0.25
      ? "dialog terasa dominan"
      : "narasi emosional lebih dominan daripada dialog";

  return {
    draftImportId: input.draftImportId,
    source: "imported_draft",
    authorVoice: `Suara penulis: ${rhythm}, ${sentenceRhythm}, ${dialogueCue}.`,
    styleTags,
    sampleCount: Math.max(input.chunks.length, paragraphs.length),
    metrics: {
      averageParagraphWords: round(avgParagraphWords),
      averageSentenceWords: round(avgSentenceWords),
      dialogueDensity: round(dialogueDensity),
      chunkCount: input.chunks.length,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      extractor: "deterministic_author_voice_v1",
    },
    operationalRules,
  };
}

export function buildAuthorVoiceProposalDraft(
  input: BuildAuthorVoiceProposalInput,
): DraftImportProposalDraft {
  return {
    projectId: input.projectId,
    proposalType: AI_PROPOSAL_TYPES.style,
    status: AI_PROPOSAL_STATUSES.proposed,
    riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
    source: AI_PROPOSAL_SOURCES.ai_import,
    title: "Import candidate style: author voice",
    payload: {
      draftImportId: input.draftImportId,
      signalType: "author_voice",
      source: input.authorVoice.source,
      extractionMode: "proposal_only",
      authorVoice: input.authorVoice.authorVoice,
      styleTags: input.authorVoice.styleTags,
      sampleCount: input.authorVoice.sampleCount,
      metrics: input.authorVoice.metrics,
      operationalRules: input.authorVoice.operationalRules as unknown as JsonObject,
    },
    reviewNote: "Imported author voice requires human review before style guidance is adopted.",
  };
}
