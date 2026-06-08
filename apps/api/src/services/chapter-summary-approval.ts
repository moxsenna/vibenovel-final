import {
  CHAPTER_SUMMARY_STATUSES,
  CHAPTER_WRITING_STATUSES,
  WRITING_SESSION_STATUSES,
} from "@vibenovel/shared";
import type { ChapterSummary, ChapterSummaryItem } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapChapterSummaryItemRow,
  mapChapterSummaryRow,
  type ChapterSummaryItemRow,
  type ChapterSummaryRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { snapshotChapterSummaryApproval } from "./audit-snapshot.js";
import { getOwnedProjectRow } from "./project.js";
import { countLinkedProposals } from "./summary-proposal-linker.js";

const SUMMARY_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, current_prose_version_ids, status, chapter_number, title, synopsis, mini_victory, emotional_outcome, ending_hook, word_count, summary_version, is_current, safety_flags, metadata, approved_at, created_at, updated_at";

const ITEM_SELECT =
  "id, project_id, chapter_summary_id, item_type, severity, title, body, related_character_id, related_fact_id, related_open_loop_id, related_reveal_id, metadata, sort_order, created_at, updated_at";

const APPROVABLE_STATUSES = new Set<string>([
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
): Promise<ChapterSummaryItem[]> {
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

  return ((data ?? []) as ChapterSummaryItemRow[]).map(mapChapterSummaryItemRow);
}

async function hasDelta(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<boolean> {
  const admin = createServiceRoleClient(bindings);
  const { count, error } = await admin
    .from("chapter_deltas")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId);

  if (error) {
    console.error("chapter_deltas count for approval failed");
    throw AppError.internal("Failed to check chapter delta");
  }
  return (count ?? 0) > 0;
}

export interface ApproveSummaryResult {
  summary: ChapterSummary;
  items: ChapterSummaryItem[];
  proposalCounts: {
    linked: number;
    accepted: number;
    rejected: number;
  };
  alreadyApproved: boolean;
  warnings: string[];
}

export async function approveChapterSummaryForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
): Promise<ApproveSummaryResult> {
  const summaryRow = await getOwnedSummaryRow(bindings, ownerId, projectId, summaryId);
  const items = await fetchSummaryItems(bindings, projectId, summaryId);

  if (summaryRow.status === CHAPTER_SUMMARY_STATUSES.approved) {
    const linkedCount = await countLinkedProposals(bindings, projectId, summaryId);
    return {
      summary: mapChapterSummaryRow(summaryRow),
      items,
      proposalCounts: { linked: linkedCount, accepted: 0, rejected: 0 },
      alreadyApproved: true,
      warnings: [],
    };
  }

  if (!APPROVABLE_STATUSES.has(summaryRow.status)) {
    throw AppError.conflict("Chapter summary cannot be approved in its current status", {
      missing: ["summary_not_approvable"],
    });
  }

  if (items.length === 0) {
    throw AppError.conflict("Chapter summary has no items and cannot be approved", {
      missing: ["summary_no_items"],
    });
  }

  const warnings: string[] = [];
  const deltaExists = await hasDelta(bindings, projectId, summaryId);
  const linkedCount = await countLinkedProposals(bindings, projectId, summaryId);
  if (!deltaExists) warnings.push("no_delta_extracted");
  if (linkedCount === 0) warnings.push("no_linked_proposals");

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();

  const { data: updatedSummary, error: summaryError } = await admin
    .from("chapter_summaries")
    .update({
      status: CHAPTER_SUMMARY_STATUSES.approved,
      approved_at: now,
    })
    .eq("id", summaryId)
    .eq("project_id", projectId)
    .select(SUMMARY_SELECT)
    .single();

  if (summaryError || !updatedSummary) {
    console.error("chapter_summaries approve failed");
    throw AppError.internal("Failed to approve chapter summary");
  }

  const { error: writingStateError } = await admin
    .from("chapter_writing_states")
    .update({
      status: CHAPTER_WRITING_STATUSES.summarized,
      last_saved_at: now,
    })
    .eq("project_id", projectId)
    .eq("chapter_outline_id", summaryRow.chapter_outline_id);

  if (writingStateError) {
    console.error("chapter_writing_states summarized update failed");
    throw AppError.internal("Failed to approve chapter summary");
  }

  if (summaryRow.writing_session_id) {
    const { error: sessionError } = await admin
      .from("writing_sessions")
      .update({ status: WRITING_SESSION_STATUSES.completed })
      .eq("id", summaryRow.writing_session_id)
      .eq("project_id", projectId)
      .eq("status", WRITING_SESSION_STATUSES.ready_for_summary);

    if (sessionError) {
      console.error("writing_sessions completed update failed");
      throw AppError.internal("Failed to approve chapter summary");
    }
  }

  const approvedRow = updatedSummary as ChapterSummaryRow;

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "chapter_summary_approved",
    entityType: "chapter_summary",
    entityId: summaryId,
    metadata: {
      task: "summary_approval",
      chapterOutlineId: summaryRow.chapter_outline_id,
      chapterNumber: summaryRow.chapter_number,
      linkedProposalCount: linkedCount,
      note: "summary_approval_not_canon_promotion",
    },
    beforeData: snapshotChapterSummaryApproval({
      id: summaryRow.id,
      status: summaryRow.status,
      chapter_number: summaryRow.chapter_number,
      summary_version: summaryRow.summary_version,
    }),
    afterData: snapshotChapterSummaryApproval({
      id: approvedRow.id,
      status: approvedRow.status,
      chapter_number: approvedRow.chapter_number,
      summary_version: approvedRow.summary_version,
    }),
  });

  return {
    summary: mapChapterSummaryRow(updatedSummary as ChapterSummaryRow),
    items,
    proposalCounts: { linked: linkedCount, accepted: 0, rejected: 0 },
    alreadyApproved: false,
    warnings,
  };
}