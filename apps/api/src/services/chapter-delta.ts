import { CHAPTER_DELTA_STATUSES, CHAPTER_SUMMARY_STATUSES } from "@vibenovel/shared";
import type { ChapterDelta } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterDeltaRow,
  type ChapterDeltaRow,
  type ChapterSummaryItemRow,
  type ChapterSummaryRow,
  type LinkedProposalSummary,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { generateCorrelationId, snapshotChapterDelta } from "./audit-snapshot.js";
import { getOwnedProjectRow } from "./project.js";
import { extractChapterDeltaStub } from "./chapter-delta-extractor.js";
import {
  countLinkedProposals,
  createLinkedProposals,
  fetchLinkedProposalsForSummary,
} from "./summary-proposal-linker.js";

const SUMMARY_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, current_prose_version_ids, status, chapter_number, title, synopsis, mini_victory, emotional_outcome, ending_hook, word_count, summary_version, is_current, safety_flags, metadata, approved_at, created_at, updated_at";

const ITEM_SELECT =
  "id, project_id, chapter_summary_id, item_type, severity, title, body, related_character_id, related_fact_id, related_open_loop_id, related_reveal_id, metadata, sort_order, created_at, updated_at";

const DELTA_SELECT =
  "id, project_id, chapter_summary_id, chapter_outline_id, status, delta_json, safety_flags, extractor_version, created_at, updated_at";

const EXTRACTABLE_SUMMARY_STATUSES = new Set<string>([
  CHAPTER_SUMMARY_STATUSES.generated,
  CHAPTER_SUMMARY_STATUSES.reviewing,
]);

async function getOwnedSummaryRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
): Promise<ChapterSummaryRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summaries")
    .select(SUMMARY_SELECT)
    .eq("id", summaryId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("chapter_summaries select by id failed");
    throw AppError.internal("Failed to load chapter summary");
  }
  if (!data) {
    throw AppError.notFound("Chapter summary not found");
  }
  return data as ChapterSummaryRow;
}

async function fetchSummaryItems(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<ChapterSummaryItemRow[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summary_items")
    .select(ITEM_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("chapter_summary_items select failed");
    throw AppError.internal("Failed to load chapter summary items");
  }
  return (data ?? []) as ChapterSummaryItemRow[];
}

async function fetchDeltaRow(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<ChapterDeltaRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_deltas")
    .select(DELTA_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId)
    .maybeSingle();

  if (error) {
    console.error("chapter_deltas select failed");
    throw AppError.internal("Failed to load chapter delta");
  }
  return data as ChapterDeltaRow | null;
}

function assertSummaryExtractable(summary: ChapterSummaryRow, itemCount: number): void {
  if (summary.status === CHAPTER_SUMMARY_STATUSES.approved) {
    throw AppError.conflict("Cannot extract delta from an approved chapter summary", {
      missing: ["summary_approved"],
    });
  }

  if (!EXTRACTABLE_SUMMARY_STATUSES.has(summary.status)) {
    throw AppError.conflict("Chapter summary is not ready for delta extraction", {
      missing: ["summary_not_extractable"],
    });
  }

  if (itemCount === 0) {
    throw AppError.conflict("Chapter summary has no items for delta extraction", {
      missing: ["summary_no_items"],
    });
  }
}

export interface ExtractDeltaResult {
  delta: ChapterDelta;
  proposals: LinkedProposalSummary[];
  created: boolean;
}

export async function extractChapterDeltaForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
  raw: unknown,
): Promise<ExtractDeltaResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const regenerate = body.regenerate === true;

  const summary = await getOwnedSummaryRow(bindings, ownerId, projectId, summaryId);
  const items = await fetchSummaryItems(bindings, projectId, summaryId);
  assertSummaryExtractable(summary, items.length);

  const existingDelta = await fetchDeltaRow(bindings, projectId, summaryId);

  if (!regenerate && existingDelta) {
    const proposals = await fetchLinkedProposalsForSummary(bindings, projectId, summaryId);
    return {
      delta: mapChapterDeltaRow(existingDelta),
      proposals,
      created: false,
    };
  }

  if (regenerate) {
    const linkedCount = await countLinkedProposals(bindings, projectId, summaryId);
    if (linkedCount > 0) {
      throw AppError.conflict(
        "Cannot regenerate delta while linked proposals exist — accept or reject them first",
        { missing: ["linked_proposals_exist"] },
      );
    }
  }

  const extracted = extractChapterDeltaStub(summary, items);
  const admin = createServiceRoleClient(bindings);

  let deltaRow: ChapterDeltaRow;

  if (existingDelta) {
    const { data, error } = await admin
      .from("chapter_deltas")
      .update({
        delta_json: extracted.deltaJson,
        safety_flags: extracted.safetyFlags,
        status: CHAPTER_DELTA_STATUSES.generated,
        extractor_version: extracted.deltaJson.meta.extractorVersion,
      })
      .eq("id", existingDelta.id)
      .eq("project_id", projectId)
      .select(DELTA_SELECT)
      .single();

    if (error || !data) {
      console.error("chapter_deltas update failed");
      throw AppError.internal("Failed to extract chapter delta");
    }
    deltaRow = data as ChapterDeltaRow;
  } else {
    const { data, error } = await admin
      .from("chapter_deltas")
      .insert({
        project_id: projectId,
        chapter_summary_id: summaryId,
        chapter_outline_id: summary.chapter_outline_id,
        status: CHAPTER_DELTA_STATUSES.generated,
        delta_json: extracted.deltaJson,
        safety_flags: extracted.safetyFlags,
        extractor_version: extracted.deltaJson.meta.extractorVersion,
      })
      .select(DELTA_SELECT)
      .single();

    if (error || !data) {
      console.error("chapter_deltas insert failed");
      throw AppError.internal("Failed to extract chapter delta");
    }
    deltaRow = data as ChapterDeltaRow;
  }

  const correlationId = generateCorrelationId();
  const proposalTypes = [...new Set(extracted.proposalDrafts.map((d) => d.proposalType))];
  const highRiskCount = extracted.proposalDrafts.filter((d) => d.riskLevel === "high").length;

  const proposals = await createLinkedProposals(
    bindings,
    ownerId,
    projectId,
    summaryId,
    extracted.proposalDrafts,
    correlationId,
  );

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "chapter_delta_extracted",
    entityType: "chapter_delta",
    entityId: deltaRow.id,
    metadata: {
      correlationId,
      task: "delta_extract",
      summaryId,
      deltaId: deltaRow.id,
      proposalCount: proposals.length,
      extractorVersion: deltaRow.extractor_version,
      proposalTypes,
      highRiskCount,
      regenerated: Boolean(existingDelta),
    },
    afterData: snapshotChapterDelta(deltaRow),
  });

  return {
    delta: mapChapterDeltaRow(deltaRow),
    proposals,
    created: true,
  };
}

export async function getChapterDeltaForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
): Promise<{ delta: ChapterDelta | null }> {
  await getOwnedSummaryRow(bindings, ownerId, projectId, summaryId);
  const row = await fetchDeltaRow(bindings, projectId, summaryId);
  return { delta: row ? mapChapterDeltaRow(row) : null };
}

export async function getSummaryLinkedProposalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
): Promise<{ proposals: LinkedProposalSummary[] }> {
  await getOwnedSummaryRow(bindings, ownerId, projectId, summaryId);
  const proposals = await fetchLinkedProposalsForSummary(bindings, projectId, summaryId);
  return { proposals };
}