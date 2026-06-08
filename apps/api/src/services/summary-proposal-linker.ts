import {
  AI_PROPOSAL_STATUSES,
  CHAPTER_SUMMARY_PROPOSAL_STATUSES,
  type JsonObject,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapLinkedProposalSummary,
  type AiProposalRow,
  type ChapterSummaryProposalRow,
  type LinkedProposalSummary,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { DELTA_PROPOSAL_SOURCE, type ProposalDraft } from "./chapter-delta-extractor.js";
import { getOwnedProjectRow } from "./project.js";
import { assertProposalPayloadSafe } from "./summary-safety.js";

const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";

const LINK_SELECT =
  "id, project_id, chapter_summary_id, ai_proposal_id, status, metadata, created_at, updated_at";

export async function createLinkedProposals(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
  drafts: ProposalDraft[],
): Promise<LinkedProposalSummary[]> {
  if (drafts.length === 0) return [];

  const admin = createServiceRoleClient(bindings);
  const results: LinkedProposalSummary[] = [];

  for (const draft of drafts) {
    assertProposalPayloadSafe(draft.payload);

    const { data: proposalRow, error: proposalError } = await admin
      .from("ai_proposals")
      .insert({
        project_id: projectId,
        proposal_type: draft.proposalType,
        status: AI_PROPOSAL_STATUSES.proposed,
        risk_level: draft.riskLevel,
        source: DELTA_PROPOSAL_SOURCE,
        title: draft.title,
        payload: draft.payload,
      })
      .select(PROPOSAL_SELECT)
      .single();

    if (proposalError || !proposalRow) {
      console.error("ai_proposals insert from delta failed");
      throw AppError.internal("Failed to create proposal from delta");
    }

    const proposal = proposalRow as AiProposalRow;

    const linkMetadata: JsonObject = {
      itemType: draft.sourceItemType,
      sourceItemId: draft.sourceItemId,
      extractor: "chapter_delta_v1_stub",
    };

    const { data: linkRow, error: linkError } = await admin
      .from("chapter_summary_proposals")
      .insert({
        project_id: projectId,
        chapter_summary_id: summaryId,
        ai_proposal_id: proposal.id,
        status: CHAPTER_SUMMARY_PROPOSAL_STATUSES.linked,
        metadata: linkMetadata,
      })
      .select(LINK_SELECT)
      .single();

    if (linkError || !linkRow) {
      console.error("chapter_summary_proposals insert failed");
      throw AppError.internal("Failed to link proposal to summary");
    }

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
        chapterSummaryId: summaryId,
        fromDeltaExtraction: true,
      },
    });

    results.push(
      mapLinkedProposalSummary(linkRow as ChapterSummaryProposalRow, proposal),
    );
  }

  return results;
}

export async function fetchLinkedProposalsForSummary(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<LinkedProposalSummary[]> {
  const admin = createServiceRoleClient(bindings);

  const { data: links, error: linkError } = await admin
    .from("chapter_summary_proposals")
    .select(LINK_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId)
    .order("created_at", { ascending: true });

  if (linkError) {
    console.error("chapter_summary_proposals select failed");
    throw AppError.internal("Failed to load linked proposals");
  }

  const linkRows = (links ?? []) as ChapterSummaryProposalRow[];
  if (linkRows.length === 0) return [];

  const proposalIds = linkRows.map((l) => l.ai_proposal_id);
  const { data: proposals, error: proposalError } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("project_id", projectId)
    .in("id", proposalIds);

  if (proposalError) {
    console.error("ai_proposals select for links failed");
    throw AppError.internal("Failed to load linked proposals");
  }

  const proposalMap = new Map(
    ((proposals ?? []) as AiProposalRow[]).map((p) => [p.id, p]),
  );

  return linkRows
    .filter((link) => proposalMap.has(link.ai_proposal_id))
    .map((link) =>
      mapLinkedProposalSummary(link, proposalMap.get(link.ai_proposal_id)!),
    );
}

export interface OwnedLinkedProposal {
  link: ChapterSummaryProposalRow;
  proposal: AiProposalRow;
}

export async function getOwnedLinkedProposal(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
  proposalId: string,
): Promise<OwnedLinkedProposal> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);

  const { data: link, error: linkError } = await admin
    .from("chapter_summary_proposals")
    .select(LINK_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId)
    .eq("ai_proposal_id", proposalId)
    .maybeSingle();

  if (linkError) {
    console.error("chapter_summary_proposals select by link failed");
    throw AppError.internal("Failed to load linked proposal");
  }
  if (!link) {
    throw AppError.notFound("Linked proposal not found");
  }

  const { data: proposal, error: proposalError } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (proposalError) {
    console.error("ai_proposals select for linked review failed");
    throw AppError.internal("Failed to load proposal");
  }
  if (!proposal) {
    throw AppError.notFound("Linked proposal not found");
  }

  return {
    link: link as ChapterSummaryProposalRow,
    proposal: proposal as AiProposalRow,
  };
}

export async function countLinkedProposals(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<number> {
  const admin = createServiceRoleClient(bindings);
  const { count, error } = await admin
    .from("chapter_summary_proposals")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("chapter_summary_id", summaryId);

  if (error) {
    console.error("chapter_summary_proposals count failed");
    throw AppError.internal("Failed to count linked proposals");
  }
  return count ?? 0;
}