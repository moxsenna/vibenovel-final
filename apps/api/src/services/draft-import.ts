import { AppError } from "../errors.js";
import type { AppBindings } from "../env.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import {
  buildDraftImportAiProposalRows,
  buildDraftImportProposalDrafts,
} from "./import/entity-extraction.js";
import { chunkDraftForImport } from "./import/chunking.js";
import {
  buildAuthorVoiceProposalDraft,
  extractAuthorVoiceFromDraft,
} from "./import/style-extraction.js";
import { getOwnedProjectRow } from "./project.js";
import { assertProposalPayloadSafe } from "./summary-safety.js";

const CONTENT_MIN_CHARS = 120;
const CONTENT_MAX_CHARS = 200_000;
const EXCERPT_MAX_CHARS = 800;

export interface DraftImportRow {
  id: string;
  project_id: string;
  owner_id: string;
  content_text: string;
  content_hash: string;
  excerpt_preview: string;
  word_count: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DraftImportSignalRow {
  id: string;
  draft_import_id: string;
  project_id: string;
  owner_id: string;
  type: string;
  label: string;
  value: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DraftImportSummary {
  id: string;
  projectId: string;
  ownerId: string;
  contentHash: string;
  excerptPreview: string;
  wordCount: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DraftImportSignal {
  id: string;
  draftImportId: string;
  projectId: string;
  type: string;
  label: string;
  value: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DraftImportSignalDraft {
  type: string;
  label: string;
  value: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface ParsedDraftImportBody {
  content: string;
}

export interface DraftContentSummary {
  contentHash: string;
  excerptPreview: string;
  wordCount: number;
}

const DRAFT_IMPORT_SELECT =
  "id, project_id, owner_id, content_text, content_hash, excerpt_preview, word_count, status, metadata, created_at, updated_at";
const DRAFT_SIGNAL_SELECT =
  "id, draft_import_id, project_id, owner_id, type, label, value, confidence, metadata, created_at, updated_at";
const AI_PROPOSAL_SELECT =
  "id, proposal_type, status, risk_level, source, title, payload, created_at, updated_at";

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function isDuplicateDraftImportError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { code?: unknown }).code === "23505";
}

export function parseDraftImportBody(raw: unknown): ParsedDraftImportBody {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const content = (raw as Record<string, unknown>).content;
  if (typeof content !== "string") {
    throw AppError.badRequest("content must be a string");
  }
  const trimmed = content.trim();
  if (trimmed.length < CONTENT_MIN_CHARS) {
    throw AppError.badRequest(`content must be at least ${CONTENT_MIN_CHARS} characters`);
  }
  if (trimmed.length > CONTENT_MAX_CHARS) {
    throw AppError.badRequest(`content must be at most ${CONTENT_MAX_CHARS} characters`);
  }
  return { content: trimmed };
}

export async function summarizeDraftContent(content: string): Promise<DraftContentSummary> {
  const encoded = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const contentHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const excerptPreview =
    content.length > EXCERPT_MAX_CHARS
      ? `${content.slice(0, EXCERPT_MAX_CHARS - 1).trimEnd()}...`
      : content;
  return {
    contentHash,
    excerptPreview,
    wordCount: countWords(content),
  };
}

function signal(
  type: string,
  label: string,
  value: string,
  confidence: number,
): DraftImportSignalDraft {
  return {
    type,
    label,
    value,
    confidence,
    metadata: { source: "imported_draft", extractor: "deterministic_draft_import" },
  };
}

export function extractDraftImportSignalsFromText(text: string): DraftImportSignalDraft[] {
  const lower = text.toLowerCase();
  const signals: DraftImportSignalDraft[] = [];

  if (/istri|suami|mertua|menantu|selingkuh|keluarga|rumah tangga/.test(lower)) {
    signals.push(signal("genre", "Drama Rumah Tangga", "drama rumah tangga", 0.92));
  } else if (/sihir|akademi|fantasi|kerajaan|monster|kekuatan/.test(lower)) {
    signals.push(signal("genre", "Fantasi Serial", "fantasi serial", 0.86));
  }

  const protagonistMatch = text.match(/\b([A-Z][a-zA-ZÀ-ž]{2,})\b/);
  if (protagonistMatch) {
    signals.push(
      signal("protagonist", `Tokoh utama: ${protagonistMatch[1]}`, protagonistMatch[1], 0.78),
    );
  }

  if (/hina|menghina|diremehkan|ditindas|miskin|bully|rundung/.test(lower)) {
    signals.push(
      signal("core_conflict", "Konflik status dan penghinaan", "tokoh diremehkan", 0.84),
    );
  } else if (/rahasia|disembunyikan|masa lalu|anak/.test(lower)) {
    signals.push(signal("core_conflict", "Konflik rahasia masa lalu", "rahasia masa lalu", 0.8));
  }

  if (/balas dendam|bangkit|revenge|menang|elegan/.test(lower)) {
    signals.push(
      signal("reader_promise", "Janji kebangkitan emosional", "kebangkitan dan pembalasan elegan", 0.84),
    );
  }

  if (/kbm|hp|serial|pembaca wanita|bab pendek|online/.test(lower)) {
    signals.push(signal("target_reader", "Pembaca serial mobile", "hp_serial", 0.82));
  }

  if (/rahasia|disembunyikan|fakta canon|canon|kontinuitas|masa lalu/.test(lower)) {
    signals.push(
      signal(
        "continuity_warning",
        "Periksa rahasia dan kontinuitas",
        "jangan mutasi canon langsung dari draft import",
        0.88,
      ),
    );
  }

  return signals;
}

function mapDraftImport(row: DraftImportRow): DraftImportSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    contentHash: row.content_hash,
    excerptPreview: row.excerpt_preview,
    wordCount: row.word_count,
    status: row.status,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSignal(row: DraftImportSignalRow): DraftImportSignal {
  return {
    id: row.id,
    draftImportId: row.draft_import_id,
    projectId: row.project_id,
    type: row.type,
    label: row.label,
    value: row.value,
    confidence: row.confidence,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getOwnedDraftImportRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<DraftImportRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("draft_imports")
    .select(DRAFT_IMPORT_SELECT)
    .eq("id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("draft_imports select failed");
    throw AppError.internal("Failed to load draft import");
  }
  if (!data) {
    throw AppError.notFound("Draft import not found");
  }
  return data as DraftImportRow;
}

async function listSignalsForDraftImport(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<DraftImportSignal[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("draft_import_signals")
    .select(DRAFT_SIGNAL_SELECT)
    .eq("draft_import_id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("draft_import_signals select failed");
    throw AppError.internal("Failed to load draft import signals");
  }

  return ((data ?? []) as DraftImportSignalRow[]).map(mapSignal);
}

export async function createDraftImportForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<{ draftImport: DraftImportSummary }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const { content } = parseDraftImportBody(raw);
  const summary = await summarizeDraftContent(content);
  const admin = createServiceRoleClient(bindings);

  const { data, error } = await admin
    .from("draft_imports")
    .insert({
      project_id: projectId,
      owner_id: ownerId,
      content_text: content,
      content_hash: summary.contentHash,
      excerpt_preview: summary.excerptPreview,
      word_count: summary.wordCount,
      status: "uploaded",
      metadata: { source: "imported_draft" },
    })
    .select(DRAFT_IMPORT_SELECT)
    .single();

  if (error || !data) {
    if (isDuplicateDraftImportError(error)) {
      const { data: existing, error: lookupError } = await admin
        .from("draft_imports")
        .select(DRAFT_IMPORT_SELECT)
        .eq("project_id", projectId)
        .eq("owner_id", ownerId)
        .eq("content_hash", summary.contentHash)
        .maybeSingle();

      if (lookupError) {
        console.error("draft_imports duplicate lookup failed", {
          code: lookupError.code,
          message: lookupError.message,
        });
        throw AppError.internal("Failed to import draft");
      }
      if (existing) {
        return { draftImport: mapDraftImport(existing as DraftImportRow) };
      }
    }

    console.error("draft_imports insert failed", {
      code: error?.code,
      message: error?.message,
    });
    throw AppError.internal("Failed to import draft");
  }

  const row = data as DraftImportRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "draft_import_created",
    entityType: "draft_import",
    entityId: row.id,
    metadata: {
      wordCount: summary.wordCount,
      contentHash: summary.contentHash,
    },
  });

  return { draftImport: mapDraftImport(row) };
}

export async function getDraftImportForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{ draftImport: DraftImportSummary; signals: DraftImportSignal[] }> {
  const row = await getOwnedDraftImportRow(bindings, ownerId, projectId, draftImportId);
  const signals = await listSignalsForDraftImport(bindings, ownerId, projectId, draftImportId);
  return { draftImport: mapDraftImport(row), signals };
}

export async function extractDraftImportSignalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{ draftImport: DraftImportSummary; signals: DraftImportSignal[] }> {
  const row = await getOwnedDraftImportRow(bindings, ownerId, projectId, draftImportId);
  const signalDrafts = extractDraftImportSignalsFromText(row.content_text);
  const admin = createServiceRoleClient(bindings);

  const { error: deleteError } = await admin
    .from("draft_import_signals")
    .delete()
    .eq("draft_import_id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId);
  if (deleteError) {
    console.error("draft_import_signals delete failed");
    throw AppError.internal("Failed to refresh draft import signals");
  }

  if (signalDrafts.length > 0) {
    const { error: insertError } = await admin.from("draft_import_signals").insert(
      signalDrafts.map((draft) => ({
        draft_import_id: draftImportId,
        project_id: projectId,
        owner_id: ownerId,
        type: draft.type,
        label: draft.label,
        value: draft.value,
        confidence: draft.confidence,
        metadata: draft.metadata,
      })),
    );
    if (insertError) {
      console.error("draft_import_signals insert failed");
      throw AppError.internal("Failed to create draft import signals");
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("draft_imports")
    .update({ status: "signals_extracted" })
    .eq("id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .select(DRAFT_IMPORT_SELECT)
    .single();

  if (updateError || !updated) {
    console.error("draft_imports status update failed");
    throw AppError.internal("Failed to update draft import");
  }

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "draft_import_signals_extracted",
    entityType: "draft_import",
    entityId: draftImportId,
    metadata: { signalCount: signalDrafts.length },
  });

  const signals = await listSignalsForDraftImport(bindings, ownerId, projectId, draftImportId);
  return { draftImport: mapDraftImport(updated as DraftImportRow), signals };
}

function mapSignalToDraft(signalRow: DraftImportSignal): DraftImportSignalDraft {
  return {
    type: signalRow.type,
    label: signalRow.label,
    value: signalRow.value,
    confidence: signalRow.confidence ?? 0.5,
    metadata: signalRow.metadata,
  };
}

export async function materializeDraftImportProposalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{
  draftImport: DraftImportSummary;
  proposalCount: number;
  proposalIds: string[];
  proposalTypes: string[];
}> {
  const row = await getOwnedDraftImportRow(bindings, ownerId, projectId, draftImportId);
  let signals = await listSignalsForDraftImport(bindings, ownerId, projectId, draftImportId);
  if (signals.length === 0) {
    const extracted = await extractDraftImportSignalsForOwner(
      bindings,
      ownerId,
      projectId,
      draftImportId,
    );
    signals = extracted.signals;
  }

  const chunks = await chunkDraftForImport({
    projectId,
    draftImportId,
    content: row.content_text,
  });
  const authorVoice = extractAuthorVoiceFromDraft({
    draftImportId,
    content: row.content_text,
    chunks,
  });
  const drafts = [
    ...buildDraftImportProposalDrafts({
    projectId,
    draftImportId,
    signals: signals.map(mapSignalToDraft),
    }),
    buildAuthorVoiceProposalDraft({ projectId, draftImportId, authorVoice }),
  ];
  for (const draft of drafts) {
    assertProposalPayloadSafe(draft.payload);
  }

  const rows = buildDraftImportAiProposalRows(drafts);
  if (rows.length === 0) {
    return {
      draftImport: mapDraftImport(row),
      proposalCount: 0,
      proposalIds: [],
      proposalTypes: [],
    };
  }

  const admin = createServiceRoleClient(bindings);
  const { error: deleteError } = await admin
    .from("ai_proposals")
    .delete()
    .eq("project_id", projectId)
    .eq("source", "ai_import")
    .eq("status", "proposed")
    .eq("payload->>draftImportId", draftImportId);

  if (deleteError) {
    console.error("ai_proposals cleanup for draft import failed");
    throw AppError.internal("Failed to refresh draft import proposals");
  }

  const { data: inserted, error: insertError } = await admin
    .from("ai_proposals")
    .insert(rows)
    .select(AI_PROPOSAL_SELECT);

  if (insertError || !inserted) {
    console.error("ai_proposals insert from draft import failed");
    throw AppError.internal("Failed to create draft import proposals");
  }

  const proposalRows = inserted as Array<{
    id: string;
    proposal_type: string;
    risk_level: string;
    source: string;
  }>;
  const proposalIds = proposalRows.map((proposal) => proposal.id);
  const proposalTypes = [...new Set(proposalRows.map((proposal) => proposal.proposal_type))];

  for (const proposal of proposalRows) {
    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "ai_proposal_created",
      entityType: "ai_proposal",
      entityId: proposal.id,
      metadata: {
        proposalType: proposal.proposal_type,
        riskLevel: proposal.risk_level,
        source: proposal.source,
        draftImportId,
        fromDraftImport: true,
      },
    });
  }

  return {
    draftImport: mapDraftImport(row),
    proposalCount: proposalRows.length,
    proposalIds,
    proposalTypes,
  };
}
