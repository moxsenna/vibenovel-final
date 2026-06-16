import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  STORY_CONCEPT_SOURCES,
  STORY_CONCEPT_STATUSES,
  WORKFLOW_PHASES,
  type JsonObject,
} from "@vibenovel/shared";
import type { AppBindings } from "../../env.js";
import { AppError } from "../../errors.js";
import type { StoryConceptRow } from "../../lib/mappers.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { getOwnedProjectRow } from "../project.js";
import type { DraftImportSignalDraft } from "../draft-import.js";
import type { DraftImportProposalDraft } from "./entity-extraction.js";

const CONCEPT_SELECT =
  "id, project_id, title, short_pitch, reader_promise, core_conflict, genre, tone, target_reader, status, source, score, payload, created_at, updated_at";

const GENERATOR_MARKER = "draft_import_foundation_seed";

interface ImportDerivedConceptDraft {
  title: string;
  shortPitch: string;
  readerPromise: string;
  coreConflict: string;
  genre: string;
  tone: string;
  targetReader: string;
  status: typeof STORY_CONCEPT_STATUSES.selected;
  source: typeof STORY_CONCEPT_SOURCES.system;
  score: number;
  payload: JsonObject;
}

export interface DraftImportFoundationSeed {
  concept: ImportDerivedConceptDraft;
  foundationProposal: DraftImportProposalDraft;
  safeFactProposals: DraftImportProposalDraft[];
}

export interface BuildDraftImportFoundationSeedInput {
  projectId: string;
  draftImportId: string;
  projectTitle: string;
  signals: DraftImportSignalDraft[];
}

export interface MaterializeDraftImportFoundationSeedResult {
  conceptId: string | null;
  createdConcept: boolean;
  proposalDrafts: DraftImportProposalDraft[];
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function truncate(value: string, maxLength: number): string {
  const text = cleanText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}...` : text;
}

function signalByType(signals: DraftImportSignalDraft[], type: string): DraftImportSignalDraft | null {
  return signals.find((signal) => signal.type === type) ?? null;
}

function stripSignalPrefix(value: string): string {
  return cleanText(value).replace(
    /^(tokoh\s+utama(?:\s+terindikasi)?|protagonis|genre|tone|nada|setting)\s*:?\s*/i,
    "",
  );
}

function looksLikeName(value: string): boolean {
  const text = stripSignalPrefix(value);
  if (!text || text.length > 80) return false;
  if (/[.,;!?]/.test(text)) return false;
  return !/\b(adalah|cerita|dengan|dihantui|dan|menjadi|pusat|sebagai|tokoh|utama|yang)\b/i.test(
    text,
  );
}

function protagonistName(signal: DraftImportSignalDraft | null): string | null {
  if (!signal) return null;
  if (looksLikeName(signal.label)) return stripSignalPrefix(signal.label);
  if (looksLikeName(signal.value)) return stripSignalPrefix(signal.value);
  return null;
}

function compactSignalLabel(signal: DraftImportSignalDraft | null, fallback: string): string {
  if (!signal) return fallback;
  const label = stripSignalPrefix(signal.label);
  if (label && label.length <= 120 && !/^terdeteksi$/i.test(label)) return label;
  const value = stripSignalPrefix(signal.value);
  return value || fallback;
}

function detailedSignalValue(signal: DraftImportSignalDraft | null, fallback: string): string {
  if (!signal) return fallback;
  const value = cleanText(signal.value);
  if (value && value.length >= 8) return value;
  const label = stripSignalPrefix(signal.label);
  return label || fallback;
}

function isGenericProjectTitle(title: string): boolean {
  return /^(untitled project|cerita baru|draft saya|proyek baru|new project)$/i.test(
    cleanText(title),
  );
}

function proposal(
  input: BuildDraftImportFoundationSeedInput,
  fields: {
    proposalType: (typeof AI_PROPOSAL_TYPES)[keyof typeof AI_PROPOSAL_TYPES];
    riskLevel?: (typeof AI_PROPOSAL_RISK_LEVELS)[keyof typeof AI_PROPOSAL_RISK_LEVELS];
    title: string;
    payload: JsonObject;
  },
): DraftImportProposalDraft {
  return {
    projectId: input.projectId,
    proposalType: fields.proposalType,
    status: AI_PROPOSAL_STATUSES.proposed,
    riskLevel: fields.riskLevel ?? AI_PROPOSAL_RISK_LEVELS.low,
    source: AI_PROPOSAL_SOURCES.ai_import,
    title: fields.title,
    payload: {
      draftImportId: input.draftImportId,
      source: "imported_draft",
      extractionMode: "proposal_only",
      generator: GENERATOR_MARKER,
      ...fields.payload,
    },
    reviewNote: "Imported draft seed requires human review before canon promotion.",
  };
}

export function buildDraftImportFoundationSeed(
  input: BuildDraftImportFoundationSeedInput,
): DraftImportFoundationSeed {
  const genreSignal = signalByType(input.signals, "genre");
  const toneSignal = signalByType(input.signals, "tone");
  const protagonistSignal = signalByType(input.signals, "protagonist");
  const conflictSignal = signalByType(input.signals, "core_conflict");
  const promiseSignal = signalByType(input.signals, "reader_promise");
  const targetSignal = signalByType(input.signals, "target_reader");
  const settingSignal = signalByType(input.signals, "setting");
  const relationshipSignal = signalByType(input.signals, "relationship_dynamic");

  const genre = truncate(compactSignalLabel(genreSignal, "Imported Draft"), 120);
  const tone = truncate(compactSignalLabel(toneSignal, "Diturunkan dari draft import"), 120);
  const targetReader = truncate(detailedSignalValue(targetSignal, "hp_serial"), 120);
  const protagonist = protagonistName(protagonistSignal);
  const setting = compactSignalLabel(settingSignal, "");
  const mainConflict = truncate(
    detailedSignalValue(conflictSignal, "Konflik utama terdeteksi dari draft import."),
    800,
  );
  const readerPromise = truncate(
    detailedSignalValue(promiseSignal, "Pembaca mengikuti kelanjutan konflik dari draft lama."),
    800,
  );
  const title = truncate(
    isGenericProjectTitle(input.projectTitle)
      ? protagonist
        ? `${protagonist}: ${genre}`
        : `Lanjutan Draft: ${genre}`
      : input.projectTitle,
    120,
  );

  const premiseParts = [
    protagonist ? `${protagonist} menjadi pusat cerita ${genre}.` : `Cerita ${genre}.`,
    mainConflict,
    setting ? `Setting penting: ${setting}.` : "",
  ].filter(Boolean);
  const shortPitch = truncate(premiseParts.join(" "), 2000);

  const basePayload: JsonObject = {
    draftImportId: input.draftImportId,
    generator: GENERATOR_MARKER,
    source: "imported_draft",
    signalTypes: [...new Set(input.signals.map((signal) => signal.type))],
    protagonistName: protagonist,
    setting,
    relationshipDynamic: relationshipSignal
      ? detailedSignalValue(relationshipSignal, relationshipSignal.label)
      : null,
  };

  const concept: ImportDerivedConceptDraft = {
    title,
    shortPitch,
    readerPromise,
    coreConflict: mainConflict,
    genre,
    tone,
    targetReader,
    status: STORY_CONCEPT_STATUSES.selected,
    source: STORY_CONCEPT_SOURCES.system,
    score: 92,
    payload: {
      ...basePayload,
      badgeLabel: `${genre} / Import Draft`,
      badgeIcon: "fact_check",
      featured: true,
      whyReadersCare: readerPromise,
      emotionalPromise: tone,
      riskNotes: "Import-derived seed: review dulu sebelum jadi canon.",
      decorativeAccent: "secondary-container",
    },
  };

  const foundationProposal = proposal(input, {
    proposalType: AI_PROPOSAL_TYPES.foundation,
    title: `Fondasi dari draft import: ${title}`,
    payload: {
      ...basePayload,
      summary: shortPitch,
      premise: shortPitch,
      mainConflict,
      readerPromise,
      genre,
      tone,
      targetReader,
      styleTags: [genre, tone, "imported_draft"].filter(Boolean).slice(0, 6),
    },
  });

  const safeFactProposals: DraftImportProposalDraft[] = [];
  if (protagonist) {
    safeFactProposals.push(
      proposal(input, {
        proposalType: AI_PROPOSAL_TYPES.fact,
        title: `Fakta: ${protagonist} adalah tokoh utama`,
        payload: {
          ...basePayload,
          content: `${protagonist} adalah tokoh utama cerita ini.`,
          category: "identity",
          importance: "core",
          reason: "Identitas tokoh utama dari draft import.",
        },
      }),
    );
  }
  if (setting) {
    safeFactProposals.push(
      proposal(input, {
        proposalType: AI_PROPOSAL_TYPES.fact,
        title: `Fakta: setting ${truncate(setting, 60)}`,
        payload: {
          ...basePayload,
          content: truncate(setting, 300),
          category: "location",
          importance: "major",
          reason: "Setting penting dari draft import.",
        },
      }),
    );
  }
  if (safeFactProposals.length < 2 && mainConflict) {
    safeFactProposals.push(
      proposal(input, {
        proposalType: AI_PROPOSAL_TYPES.fact,
        riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
        title: "Fakta: konflik utama dari draft",
        payload: {
          ...basePayload,
          content: truncate(mainConflict, 300),
          category: "event",
          importance: "major",
          reason: "Konflik utama dari draft import.",
        },
      }),
    );
  }
  if (safeFactProposals.length < 2 && readerPromise) {
    safeFactProposals.push(
      proposal(input, {
        proposalType: AI_PROPOSAL_TYPES.fact,
        title: "Fakta: janji pembaca",
        payload: {
          ...basePayload,
          content: truncate(readerPromise, 300),
          category: "promise",
          importance: "major",
          reason: "Janji pembaca dari draft import.",
        },
      }),
    );
  }

  return {
    concept,
    foundationProposal,
    safeFactProposals: safeFactProposals.slice(0, 3),
  };
}

async function findExistingImportSeedConcept(
  bindings: AppBindings,
  projectId: string,
  draftImportId: string,
): Promise<StoryConceptRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_concepts")
    .select(CONCEPT_SELECT)
    .eq("project_id", projectId)
    .eq("payload->>draftImportId", draftImportId)
    .eq("payload->>generator", GENERATOR_MARKER)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("story_concepts select import seed failed");
    throw AppError.internal("Failed to load import-derived concept seed");
  }
  return (data as StoryConceptRow | null) ?? null;
}

async function upsertSelectedImportSeedConcept(
  bindings: AppBindings,
  projectId: string,
  seed: ImportDerivedConceptDraft,
  existing: StoryConceptRow | null,
): Promise<{ conceptId: string; created: boolean }> {
  const admin = createServiceRoleClient(bindings);
  const row = {
    title: seed.title,
    short_pitch: seed.shortPitch,
    reader_promise: seed.readerPromise,
    core_conflict: seed.coreConflict,
    genre: seed.genre,
    tone: seed.tone,
    target_reader: seed.targetReader,
    status: STORY_CONCEPT_STATUSES.selected,
    source: STORY_CONCEPT_SOURCES.system,
    score: seed.score,
    payload: seed.payload,
  };

  if (existing) {
    const { data, error } = await admin
      .from("story_concepts")
      .update(row)
      .eq("id", existing.id)
      .eq("project_id", projectId)
      .select(CONCEPT_SELECT)
      .single();

    if (error || !data) {
      console.error("story_concepts update import seed failed");
      throw AppError.internal("Failed to update import-derived concept seed");
    }
    return { conceptId: (data as StoryConceptRow).id, created: false };
  }

  const { data, error } = await admin
    .from("story_concepts")
    .insert({
      project_id: projectId,
      ...row,
    })
    .select(CONCEPT_SELECT)
    .single();

  if (error || !data) {
    console.error("story_concepts insert import seed failed");
    throw AppError.internal("Failed to create import-derived concept seed");
  }
  return { conceptId: (data as StoryConceptRow).id, created: true };
}

export async function materializeDraftImportFoundationSeedForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
  signals: DraftImportSignalDraft[],
): Promise<MaterializeDraftImportFoundationSeedResult> {
  const projectRow = await getOwnedProjectRow(bindings, ownerId, projectId);
  const seed = buildDraftImportFoundationSeed({
    projectId,
    draftImportId,
    projectTitle: projectRow.title,
    signals,
  });

  let conceptId = projectRow.selected_concept_id ?? null;
  let createdConcept = false;

  if (!conceptId) {
    const existing = await findExistingImportSeedConcept(bindings, projectId, draftImportId);
    const seeded = await upsertSelectedImportSeedConcept(bindings, projectId, seed.concept, existing);
    conceptId = seeded.conceptId;
    createdConcept = seeded.created;

    const admin = createServiceRoleClient(bindings);
    const { error } = await admin
      .from("projects")
      .update({
        selected_concept_id: conceptId,
        workflow_phase: WORKFLOW_PHASES.foundation,
        genre: projectRow.genre ?? seed.concept.genre,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("owner_id", ownerId);

    if (error) {
      console.error("projects update import seed concept failed");
      throw AppError.internal("Failed to select import-derived concept seed");
    }
  }

  const proposalDrafts = [
    {
      ...seed.foundationProposal,
      payload: { ...seed.foundationProposal.payload, conceptId },
    },
    ...seed.safeFactProposals.map((draft) => ({
      ...draft,
      payload: { ...draft.payload, conceptId },
    })),
  ];

  return {
    conceptId,
    createdConcept,
    proposalDrafts,
  };
}
