import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  type AiProposalRiskLevel,
  type AiProposalSource,
  type AiProposalStatus,
  type AiProposalType,
  type JsonObject,
} from "@vibenovel/shared";
import type { DraftImportSignalDraft } from "../draft-import.js";

export interface DraftImportProposalDraft {
  projectId: string;
  proposalType: AiProposalType;
  status: AiProposalStatus;
  riskLevel: AiProposalRiskLevel;
  source: AiProposalSource;
  title: string;
  payload: JsonObject;
  reviewNote: string;
}

export interface DraftImportAiProposalInsertRow {
  project_id: string;
  proposal_type: AiProposalType;
  status: AiProposalStatus;
  risk_level: AiProposalRiskLevel;
  source: AiProposalSource;
  title: string;
  payload: JsonObject;
  review_note: string;
}

export interface BuildDraftImportProposalDraftsInput {
  projectId: string;
  draftImportId: string;
  signals: DraftImportSignalDraft[];
}

function basePayload(
  input: BuildDraftImportProposalDraftsInput,
  signal: DraftImportSignalDraft,
): JsonObject {
  return {
    draftImportId: input.draftImportId,
    signalType: signal.type,
    signalLabel: signal.label,
    signalConfidence: signal.confidence,
    source: "imported_draft",
    extractionMode: "proposal_only",
  };
}

function proposal(
  input: BuildDraftImportProposalDraftsInput,
  signal: DraftImportSignalDraft,
  fields: {
    proposalType: AiProposalType;
    riskLevel?: AiProposalRiskLevel;
    title: string;
    payload: JsonObject;
  },
): DraftImportProposalDraft {
  return {
    projectId: input.projectId,
    proposalType: fields.proposalType,
    status: AI_PROPOSAL_STATUSES.proposed,
    riskLevel: fields.riskLevel ?? AI_PROPOSAL_RISK_LEVELS.medium,
    source: AI_PROPOSAL_SOURCES.ai_import,
    title: fields.title,
    payload: {
      ...basePayload(input, signal),
      ...fields.payload,
    },
    reviewNote: "Imported draft finding requires human review before canon promotion.",
  };
}

function cleanSignalText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripProtagonistPrefix(value: string): string {
  return cleanSignalText(value).replace(
    /^(tokoh\s+utama(?:\s+terindikasi)?|protagonis|main\s+character)\s*:?\s*/i,
    "",
  );
}

function looksLikeCharacterName(value: string): boolean {
  const text = stripProtagonistPrefix(value);
  if (!text || text.length > 80) return false;
  if (/[.,;!?]/.test(text)) return false;
  return !/\b(adalah|cerita|dengan|dihantui|dan|menjadi|pusat|sebagai|tokoh|utama|yang)\b/i.test(
    text,
  );
}

function resolveProtagonistSignal(signal: DraftImportSignalDraft): {
  name: string;
  description: string;
} {
  const rawLabel = cleanSignalText(signal.label);
  const rawValue = cleanSignalText(signal.value);
  const labelName = stripProtagonistPrefix(rawLabel);
  const valueName = stripProtagonistPrefix(rawValue);

  if (looksLikeCharacterName(rawValue)) {
    return {
      name: valueName,
      description: rawLabel !== rawValue ? rawLabel : "",
    };
  }

  if (looksLikeCharacterName(rawLabel)) {
    return {
      name: labelName,
      description: rawValue !== rawLabel ? rawValue : "",
    };
  }

  return {
    name: valueName || labelName || "Tokoh Utama",
    description: rawLabel !== rawValue ? rawLabel : rawValue,
  };
}

export function buildDraftImportProposalDrafts(
  input: BuildDraftImportProposalDraftsInput,
): DraftImportProposalDraft[] {
  const drafts: DraftImportProposalDraft[] = [];
  const seenTypes = new Set<string>();

  const addOnce = (key: string, draft: DraftImportProposalDraft): void => {
    if (seenTypes.has(key)) return;
    seenTypes.add(key);
    drafts.push(draft);
  };

  for (const signal of input.signals) {
    if (signal.type === "protagonist") {
      const protagonist = resolveProtagonistSignal(signal);
      addOnce(
        "character:protagonist",
        proposal(input, signal, {
          proposalType: AI_PROPOSAL_TYPES.character,
          title: `Import candidate character: ${protagonist.name}`,
          payload: {
            name: protagonist.name,
            role: "protagonist",
            description: protagonist.description,
          },
        }),
      );
      continue;
    }

    if (signal.type === "continuity_warning" || signal.type === "secret_candidate") {
      addOnce(
        "fact:continuity_warning",
        proposal(input, signal, {
          proposalType: AI_PROPOSAL_TYPES.fact,
          riskLevel: AI_PROPOSAL_RISK_LEVELS.high,
          title: `Import candidate fact: ${signal.label}`,
          payload: {
            text: signal.value,
            category: "secret",
            importance: "major",
            evidence: signal.label,
          },
        }),
      );
      continue;
    }

    if (
      signal.type === "reader_promise" ||
      signal.type === "target_reader" ||
      signal.type === "genre" ||
      signal.type === "tone" ||
      signal.type === "relationship_dynamic" ||
      signal.type === "style_preference"
    ) {
      addOnce(
        "style:voice",
        proposal(input, signal, {
          proposalType: AI_PROPOSAL_TYPES.style,
          riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
          title: `Import candidate style: ${signal.label}`,
          payload: {
            styleSignal: signal.value,
            styleLabel: signal.label,
          },
        }),
      );
    }
  }

  return drafts;
}

export function buildDraftImportAiProposalRows(
  drafts: DraftImportProposalDraft[],
): DraftImportAiProposalInsertRow[] {
  return drafts.map((draft) => ({
    project_id: draft.projectId,
    proposal_type: draft.proposalType,
    status: draft.status,
    risk_level: draft.riskLevel,
    source: draft.source,
    title: draft.title,
    payload: draft.payload,
    review_note: draft.reviewNote,
  }));
}
