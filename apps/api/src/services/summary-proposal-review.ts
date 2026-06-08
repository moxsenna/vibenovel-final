import {
  AI_PROPOSAL_STATUSES,
  CHAPTER_SUMMARY_PROPOSAL_STATUSES,
  CHAPTER_SUMMARY_STATUSES,
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
import { generateCorrelationId, snapshotCanonPromotion } from "./audit-snapshot.js";
import { getOwnedProjectRow } from "./project.js";
import {
  compensateCanonPromotion,
  preflightPromotionToCanon,
  promoteProposalToCanon,
  type PromotedEntity,
} from "./proposal-canon-promotion.js";
import { classifyTransactionFailure } from "./transaction.js";
import { getOwnedLinkedProposal } from "./summary-proposal-linker.js";

const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";

const LINK_SELECT =
  "id, project_id, chapter_summary_id, ai_proposal_id, status, metadata, created_at, updated_at";

const SUMMARY_STATUS_SELECT = "id, status";

async function assertSummaryApproved(
  bindings: AppBindings,
  projectId: string,
  summaryId: string,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summaries")
    .select(SUMMARY_STATUS_SELECT)
    .eq("id", summaryId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !data) {
    throw AppError.notFound("Chapter summary not found");
  }

  if ((data as { status: string }).status !== CHAPTER_SUMMARY_STATUSES.approved) {
    throw AppError.conflict("Summary must be approved before accepting linked proposals", {
      missing: ["summary_not_approved"],
    });
  }
}

export interface AcceptLinkedProposalResult {
  proposal: LinkedProposalSummary;
  promoted: PromotedEntity | null;
  alreadyAccepted: boolean;
}

export async function acceptLinkedProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
  proposalId: string,
  raw: unknown,
): Promise<AcceptLinkedProposalResult> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  await assertSummaryApproved(bindings, projectId, summaryId);

  const { link, proposal } = await getOwnedLinkedProposal(
    bindings,
    ownerId,
    projectId,
    summaryId,
    proposalId,
  );

  if (
    proposal.status === AI_PROPOSAL_STATUSES.accepted &&
    link.status === CHAPTER_SUMMARY_PROPOSAL_STATUSES.accepted
  ) {
    return {
      proposal: mapLinkedProposalSummary(link, proposal),
      promoted: null,
      alreadyAccepted: true,
    };
  }

  if (proposal.status !== AI_PROPOSAL_STATUSES.proposed) {
    throw AppError.conflict(`Proposal is already ${proposal.status} and cannot be accepted`);
  }

  if (link.status !== CHAPTER_SUMMARY_PROPOSAL_STATUSES.linked) {
    throw AppError.conflict(`Linked proposal is already ${link.status}`);
  }

  let confirmHighRisk = false;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw AppError.badRequest("Request body must be a JSON object");
    }
    const body = raw as Record<string, unknown>;
    confirmHighRisk = body.confirmHighRisk === true;
  }

  const correlationId = generateCorrelationId();
  let promoted: PromotedEntity;

  try {
    preflightPromotionToCanon(proposal, { confirmHighRisk });
    promoted = await promoteProposalToCanon(bindings, projectId, proposal, {
      confirmHighRisk,
    });
  } catch (err) {
    const errorCode = classifyTransactionFailure(err);
    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "canon_promotion_failed",
      entityType: "ai_proposal",
      entityId: proposalId,
      metadata: {
        correlationId,
        task: "summary_proposal_accept",
        proposalId,
        proposalType: proposal.proposal_type,
        riskLevel: proposal.risk_level,
        chapterSummaryId: summaryId,
        errorCode,
        highRiskConfirmed: confirmHighRisk,
      },
    });
    throw err;
  }

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "canon_promotion_applied",
    entityType: "ai_proposal",
    entityId: proposalId,
    metadata: {
      correlationId,
      task: "summary_proposal_accept",
      proposalId,
      proposalType: proposal.proposal_type,
      riskLevel: proposal.risk_level,
      chapterSummaryId: summaryId,
      highRiskConfirmed: confirmHighRisk,
      ...snapshotCanonPromotion(promoted),
    },
  });

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();

  let acceptedProposal: AiProposalRow;
  let acceptedLink: ChapterSummaryProposalRow;

  try {
    const proposalUpdates: Record<string, unknown> = {
      status: AI_PROPOSAL_STATUSES.accepted,
      reviewed_at: now,
      reviewed_by: ownerId,
    };
    if (promoted.entityType === "fact") {
      proposalUpdates.result_fact_id = promoted.entityId;
    }
    if (promoted.entityType === "character") {
      proposalUpdates.result_character_id = promoted.entityId;
    }

    const { data: proposalData, error: proposalError } = await admin
      .from("ai_proposals")
      .update(proposalUpdates)
      .eq("id", proposalId)
      .eq("project_id", projectId)
      .eq("status", AI_PROPOSAL_STATUSES.proposed)
      .select(PROPOSAL_SELECT)
      .single();

    if (proposalError || !proposalData) {
      console.error("ai_proposals accept from summary failed");
      throw AppError.internal("Failed to accept linked proposal");
    }

    const { data: linkData, error: linkError } = await admin
      .from("chapter_summary_proposals")
      .update({ status: CHAPTER_SUMMARY_PROPOSAL_STATUSES.accepted })
      .eq("id", link.id)
      .eq("project_id", projectId)
      .eq("status", CHAPTER_SUMMARY_PROPOSAL_STATUSES.linked)
      .select(LINK_SELECT)
      .single();

    if (linkError || !linkData) {
      console.error("chapter_summary_proposals accept failed");
      throw AppError.internal("Failed to accept linked proposal");
    }

    acceptedProposal = proposalData as AiProposalRow;
    acceptedLink = linkData as ChapterSummaryProposalRow;
  } catch (err) {
    await compensateCanonPromotion(bindings, projectId, promoted);
    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "canon_promotion_failed",
      entityType: "ai_proposal",
      entityId: proposalId,
      metadata: {
        correlationId,
        task: "summary_proposal_accept",
        proposalId,
        proposalType: proposal.proposal_type,
        chapterSummaryId: summaryId,
        errorCode: classifyTransactionFailure(err),
        failureStage: "accept_status_update",
      },
    });
    throw err;
  }

  const proposalRow = acceptedProposal;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "ai_proposal_accepted",
    entityType: "ai_proposal",
    entityId: proposalId,
    metadata: {
      correlationId,
      proposalType: proposalRow.proposal_type,
      chapterSummaryId: summaryId,
      promotedEntityType: promoted.entityType,
      promotedEntityId: promoted.entityId,
      canonPromotion: true,
    },
  });

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "summary_proposal_accepted",
    entityType: "chapter_summary_proposal",
    entityId: acceptedLink.id,
    metadata: {
      correlationId,
      task: "summary_proposal_accept",
      proposalId,
      proposalType: proposalRow.proposal_type,
      chapterSummaryId: summaryId,
      promotedEntityType: promoted.entityType,
      promotedEntityId: promoted.entityId,
      created: promoted.created,
      highRiskConfirmed: confirmHighRisk,
    },
  });

  return {
    proposal: mapLinkedProposalSummary(acceptedLink as ChapterSummaryProposalRow, proposalRow),
    promoted,
    alreadyAccepted: false,
  };
}

export interface RejectLinkedProposalResult {
  proposal: LinkedProposalSummary;
  alreadyRejected: boolean;
}

export async function rejectLinkedProposalForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  summaryId: string,
  proposalId: string,
  raw: unknown,
): Promise<RejectLinkedProposalResult> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const { link, proposal } = await getOwnedLinkedProposal(
    bindings,
    ownerId,
    projectId,
    summaryId,
    proposalId,
  );

  if (proposal.status === AI_PROPOSAL_STATUSES.accepted) {
    throw AppError.conflict("Cannot reject an accepted proposal", {
      missing: ["cannot_reject_accepted"],
    });
  }

  if (
    proposal.status === AI_PROPOSAL_STATUSES.rejected &&
    link.status === CHAPTER_SUMMARY_PROPOSAL_STATUSES.rejected
  ) {
    return {
      proposal: mapLinkedProposalSummary(link, proposal),
      alreadyRejected: true,
    };
  }

  if (proposal.status !== AI_PROPOSAL_STATUSES.proposed) {
    throw AppError.conflict(`Proposal is already ${proposal.status} and cannot be rejected`);
  }

  let reason: string | null = null;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw AppError.badRequest("Request body must be a JSON object");
    }
    const body = raw as Record<string, unknown>;
    if (body.reason !== undefined) {
      if (typeof body.reason !== "string") throw AppError.badRequest("reason must be a string");
      reason = body.reason.trim().slice(0, 500) || null;
    }
  }

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();

  const { data: rejectedProposal, error: proposalError } = await admin
    .from("ai_proposals")
    .update({
      status: AI_PROPOSAL_STATUSES.rejected,
      review_note: reason,
      reviewed_at: now,
      reviewed_by: ownerId,
    })
    .eq("id", proposalId)
    .eq("project_id", projectId)
    .eq("status", AI_PROPOSAL_STATUSES.proposed)
    .select(PROPOSAL_SELECT)
    .single();

  if (proposalError || !rejectedProposal) {
    console.error("ai_proposals reject from summary failed");
    throw AppError.internal("Failed to reject linked proposal");
  }

  const { data: rejectedLink, error: linkError } = await admin
    .from("chapter_summary_proposals")
    .update({ status: CHAPTER_SUMMARY_PROPOSAL_STATUSES.rejected })
    .eq("id", link.id)
    .eq("project_id", projectId)
    .in("status", [CHAPTER_SUMMARY_PROPOSAL_STATUSES.linked])
    .select(LINK_SELECT)
    .single();

  if (linkError || !rejectedLink) {
    console.error("chapter_summary_proposals reject failed");
    throw AppError.internal("Failed to reject linked proposal");
  }

  const proposalRow = rejectedProposal as AiProposalRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "ai_proposal_rejected",
    entityType: "ai_proposal",
    entityId: proposalId,
    metadata: {
      proposalType: proposalRow.proposal_type,
      chapterSummaryId: summaryId,
      ...(reason ? { reason: reason.slice(0, 200) } : {}),
    },
  });

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "summary_proposal_rejected",
    entityType: "chapter_summary_proposal",
    entityId: rejectedLink.id,
    metadata: {
      task: "summary_proposal_reject",
      proposalId,
      proposalType: proposalRow.proposal_type,
      chapterSummaryId: summaryId,
      ...(reason ? { reason: reason.slice(0, 200) } : {}),
    },
  });

  return {
    proposal: mapLinkedProposalSummary(rejectedLink as ChapterSummaryProposalRow, proposalRow),
    alreadyRejected: false,
  };
}