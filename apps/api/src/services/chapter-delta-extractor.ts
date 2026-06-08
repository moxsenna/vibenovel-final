import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_TYPES,
  CHAPTER_DELTA_EXTRACTOR_VERSIONS,
  CHAPTER_SUMMARY_ITEM_TYPES,
  type AiProposalRiskLevel,
  type AiProposalType,
  type ChapterDeltaPayload,
  type JsonObject,
  type SummarySafetyFlags,
} from "@vibenovel/shared";
import type { ChapterSummaryItemRow, ChapterSummaryRow } from "../lib/mappers.js";
import { assertDeltaJsonSafe, assertSummaryTextSafe } from "./summary-safety.js";

export const MAX_DELTA_PROPOSALS = 5;

const SENSITIVE_WORDS = [
  "rahasia",
  "selingkuh",
  "hamil",
  "mati",
  "pembunuhan",
  "identitas",
  "warisan",
];

const EXTRACTABLE_ITEM_TYPES = new Set<string>([
  CHAPTER_SUMMARY_ITEM_TYPES.new_fact_candidate,
  CHAPTER_SUMMARY_ITEM_TYPES.character_change,
  CHAPTER_SUMMARY_ITEM_TYPES.relationship_change,
  CHAPTER_SUMMARY_ITEM_TYPES.open_loop_opened,
  CHAPTER_SUMMARY_ITEM_TYPES.open_loop_paid_off,
  CHAPTER_SUMMARY_ITEM_TYPES.reveal_candidate,
]);

export interface ProposalDraft {
  proposalType: AiProposalType;
  title: string;
  riskLevel: AiProposalRiskLevel;
  payload: JsonObject;
  sourceItemType: string;
  sourceItemId: string;
}

export interface ExtractedChapterDelta {
  deltaJson: ChapterDeltaPayload;
  safetyFlags: SummarySafetyFlags;
  proposalDrafts: ProposalDraft[];
}

function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function inferFactRisk(text: string): AiProposalRiskLevel {
  const lower = text.toLowerCase();
  for (const word of SENSITIVE_WORDS) {
    if (lower.includes(word)) return AI_PROPOSAL_RISK_LEVELS.high;
  }
  return AI_PROPOSAL_RISK_LEVELS.medium;
}

function inferFactCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("rahasia") || lower.includes("selingkuh")) return "secret";
  if (lower.includes("keluarga") || lower.includes("hubungan")) return "relationship";
  if (lower.includes("warisan") || lower.includes("identitas")) return "identity";
  return "event";
}

function extractFactText(itemBody: string): string {
  const prefix = "Beat contract menyebut:";
  if (itemBody.includes(prefix)) {
    return itemBody.split(prefix)[1]?.trim() ?? itemBody.trim();
  }
  return itemBody.trim();
}

function buildFactProposal(
  summary: ChapterSummaryRow,
  item: ChapterSummaryItemRow,
): ProposalDraft | null {
  const factText = extractFactText(item.body);
  if (factText.length < 8) return null;

  const riskLevel = inferFactRisk(factText);
  return {
    proposalType: AI_PROPOSAL_TYPES.fact,
    title: truncate(item.title || "Kandidat fakta baru", 200),
    riskLevel,
    payload: {
      summaryId: summary.id,
      chapterOutlineId: summary.chapter_outline_id,
      chapterNumber: summary.chapter_number,
      proposedFactText: truncate(factText, 500),
      category: inferFactCategory(factText),
      reason: "Ditemukan dari ringkasan bab (stub extractor)",
      sourceItemType: item.item_type,
      sourceItemId: item.id,
    },
    sourceItemType: item.item_type,
    sourceItemId: item.id,
  };
}

function buildCharacterUpdateProposal(
  summary: ChapterSummaryRow,
  item: ChapterSummaryItemRow,
): ProposalDraft | null {
  if (item.body.trim().length < 8) return null;
  return {
    proposalType: AI_PROPOSAL_TYPES.character_update,
    title: truncate(item.title || "Perubahan tokoh", 200),
    riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
    payload: {
      summaryId: summary.id,
      chapterOutlineId: summary.chapter_outline_id,
      chapterNumber: summary.chapter_number,
      changeSummary: truncate(item.body, 500),
      reason: "Kandidat perubahan tokoh dari ringkasan bab",
      ...(item.related_character_id ? { targetEntityId: item.related_character_id } : {}),
      sourceItemType: item.item_type,
      sourceItemId: item.id,
    },
    sourceItemType: item.item_type,
    sourceItemId: item.id,
  };
}

function buildRelationshipUpdateProposal(
  summary: ChapterSummaryRow,
  item: ChapterSummaryItemRow,
): ProposalDraft | null {
  if (item.body.trim().length < 8) return null;
  return {
    proposalType: AI_PROPOSAL_TYPES.relationship_update,
    title: truncate(item.title || "Perubahan relasi", 200),
    riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
    payload: {
      summaryId: summary.id,
      chapterOutlineId: summary.chapter_outline_id,
      chapterNumber: summary.chapter_number,
      changeSummary: truncate(item.body, 500),
      reason: "Kandidat perubahan relasi dari ringkasan bab",
      sourceItemType: item.item_type,
      sourceItemId: item.id,
    },
    sourceItemType: item.item_type,
    sourceItemId: item.id,
  };
}

function buildOpenLoopProposal(
  summary: ChapterSummaryRow,
  item: ChapterSummaryItemRow,
): ProposalDraft | null {
  if (item.body.trim().length < 8) return null;
  const isPaidOff = item.item_type === CHAPTER_SUMMARY_ITEM_TYPES.open_loop_paid_off;
  return {
    proposalType: AI_PROPOSAL_TYPES.open_loop_update,
    title: truncate(item.title || (isPaidOff ? "Open loop payoff" : "Open loop baru"), 200),
    riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
    payload: {
      summaryId: summary.id,
      chapterOutlineId: summary.chapter_outline_id,
      chapterNumber: summary.chapter_number,
      changeSummary: truncate(item.body, 500),
      suggestedStatus: isPaidOff ? "paid_off" : "opened",
      ...(item.related_open_loop_id ? { targetEntityId: item.related_open_loop_id } : {}),
      reason: "Kandidat update open loop dari ringkasan bab",
      sourceItemType: item.item_type,
      sourceItemId: item.id,
    },
    sourceItemType: item.item_type,
    sourceItemId: item.id,
  };
}

function buildRevealProposal(
  summary: ChapterSummaryRow,
  item: ChapterSummaryItemRow,
): ProposalDraft | null {
  if (item.body.trim().length < 8) return null;
  return {
    proposalType: AI_PROPOSAL_TYPES.reveal_status_update,
    title: truncate(item.title || "Kandidat reveal", 200),
    riskLevel: AI_PROPOSAL_RISK_LEVELS.high,
    payload: {
      summaryId: summary.id,
      chapterOutlineId: summary.chapter_outline_id,
      chapterNumber: summary.chapter_number,
      changeSummary: truncate(item.body, 500),
      suggestedStatus: "revealed",
      ...(item.related_reveal_id ? { targetEntityId: item.related_reveal_id } : {}),
      reason: "Kandidat update reveal dari ringkasan bab",
      sourceItemType: item.item_type,
      sourceItemId: item.id,
    },
    sourceItemType: item.item_type,
    sourceItemId: item.id,
  };
}

function buildProposalDraft(
  summary: ChapterSummaryRow,
  item: ChapterSummaryItemRow,
): ProposalDraft | null {
  switch (item.item_type) {
    case CHAPTER_SUMMARY_ITEM_TYPES.new_fact_candidate:
      return buildFactProposal(summary, item);
    case CHAPTER_SUMMARY_ITEM_TYPES.character_change:
      return buildCharacterUpdateProposal(summary, item);
    case CHAPTER_SUMMARY_ITEM_TYPES.relationship_change:
      return buildRelationshipUpdateProposal(summary, item);
    case CHAPTER_SUMMARY_ITEM_TYPES.open_loop_opened:
    case CHAPTER_SUMMARY_ITEM_TYPES.open_loop_paid_off:
      return buildOpenLoopProposal(summary, item);
    case CHAPTER_SUMMARY_ITEM_TYPES.reveal_candidate:
      return buildRevealProposal(summary, item);
    default:
      return null;
  }
}

export function extractChapterDeltaStub(
  summary: ChapterSummaryRow,
  items: ChapterSummaryItemRow[],
): ExtractedChapterDelta {
  const proposalDrafts: ProposalDraft[] = [];

  for (const item of items) {
    if (!EXTRACTABLE_ITEM_TYPES.has(item.item_type)) continue;
    const draft = buildProposalDraft(summary, item);
    if (draft) proposalDrafts.push(draft);
    if (proposalDrafts.length >= MAX_DELTA_PROPOSALS) break;
  }

  const characterChanges = items
    .filter((i) => i.item_type === CHAPTER_SUMMARY_ITEM_TYPES.character_change)
    .map((i) => ({
      characterId: i.related_character_id ?? undefined,
      characterName: i.title,
      change: truncate(i.body, 300),
    }));

  const relationshipChanges = items
    .filter((i) => i.item_type === CHAPTER_SUMMARY_ITEM_TYPES.relationship_change)
    .map((i) => ({
      label: i.title,
      body: truncate(i.body, 300),
    }));

  const newFactCandidates = items
    .filter((i) => i.item_type === CHAPTER_SUMMARY_ITEM_TYPES.new_fact_candidate)
    .map((i) => ({
      text: truncate(extractFactText(i.body), 300),
      category: inferFactCategory(i.body),
      proposalRequired: true as const,
    }));

  const openLoopOpened = items
    .filter((i) => i.item_type === CHAPTER_SUMMARY_ITEM_TYPES.open_loop_opened)
    .map((i) => ({ label: i.title, body: truncate(i.body, 300) }));

  const openLoopPaidOff = items
    .filter((i) => i.item_type === CHAPTER_SUMMARY_ITEM_TYPES.open_loop_paid_off)
    .map((i) => ({
      openLoopId: i.related_open_loop_id ?? undefined,
      question: i.title,
      suggestedStatus: "paid_off",
      evidenceSnippet: truncate(i.body, 200),
    }));

  const revealCandidates = items
    .filter((i) => i.item_type === CHAPTER_SUMMARY_ITEM_TYPES.reveal_candidate)
    .map((i) => ({
      plannedRevealId: i.related_reveal_id ?? undefined,
      title: i.title,
      suggestedStatus: "revealed",
      evidenceSnippet: truncate(i.body, 200),
    }));

  const highRiskCount = proposalDrafts.filter(
    (p) => p.riskLevel === AI_PROPOSAL_RISK_LEVELS.high,
  ).length;

  const safetyFlags: SummarySafetyFlags = {
    stubExtractor: true,
    requiresHumanReview: true,
    uncertainExtraction: true,
    revealRisk: highRiskCount > 0,
    overExtraction: proposalDrafts.length >= MAX_DELTA_PROPOSALS,
  };

  const deltaJson: ChapterDeltaPayload = {
    meta: {
      chapterOutlineId: summary.chapter_outline_id,
      chapterNumber: summary.chapter_number,
      writingSessionId: summary.writing_session_id ?? undefined,
      proseVersionIds: summary.current_prose_version_ids ?? [],
      extractorVersion: CHAPTER_DELTA_EXTRACTOR_VERSIONS.v1_stub,
      generatedAt: new Date().toISOString(),
    },
    synopsis: summary.synopsis,
    emotionalOutcome: summary.emotional_outcome,
    endingHook: summary.ending_hook,
    continuityNotes:
      items.find((i) => i.item_type === CHAPTER_SUMMARY_ITEM_TYPES.continuity_note)?.body ?? null,
    miniVictories: summary.mini_victory
      ? [{ label: "Mini Victory", body: summary.mini_victory }]
      : [],
    characterChanges,
    relationshipChanges,
    newFactCandidates,
    openLoops: {
      opened: openLoopOpened,
      paidOffCandidates: openLoopPaidOff,
    },
    reveals: {
      occurredCandidates: revealCandidates,
      heldSecrets: [],
    },
    storyCheckNotes: [],
    safetyFlags,
  };

  assertSummaryTextSafe(deltaJson.synopsis);
  if (deltaJson.emotionalOutcome) assertSummaryTextSafe(deltaJson.emotionalOutcome);
  if (deltaJson.endingHook) assertSummaryTextSafe(deltaJson.endingHook);
  assertDeltaJsonSafe(deltaJson);

  return { deltaJson, safetyFlags, proposalDrafts };
}

export const DELTA_PROPOSAL_SOURCE = AI_PROPOSAL_SOURCES.chapter_delta_stub;