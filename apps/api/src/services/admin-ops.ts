import type { SupabaseClient } from "@supabase/supabase-js";

import type { EnvPresenceFlags } from "../env.js";

import {
  AI_PROPOSAL_STATUSES,
  GENERATION_STATUSES,
  type AiProposal,
  type CreditBalance,
  type CreditLedgerEntry,
  type Project,
  type UserProfile,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import {
  mapAiProposalRow,
  mapCreditBalanceRow,
  mapCreditLedgerRow,
  mapProfileRow,
  mapProjectRow,
  type AiProposalRow,
  type CreditBalanceRow,
  type CreditLedgerRow,
  type ProfileRow,
  type ProjectRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { getEnvPresenceFlags } from "../env.js";
import {
  mapGenerationAttemptRow,
  toGenerationAttemptSafeSummary,
  type GenerationAttemptRow,
  type GenerationAttemptSafeSummary,
} from "./generation-attempt.js";
import { listGenerationProviderEvents } from "./generation-provider-event.js";
import type { GenerationProviderEvent } from "@vibenovel/shared";

const PROFILE_SELECT =
  "id, display_name, email, default_language, plan_label, role, subscription_plan, created_at, updated_at";
const PROJECT_SELECT =
  "id, owner_id, title, genre, status, current_chapter, entry_path, is_active, last_edited_at, workflow_phase, selected_concept_id, created_at, updated_at";
const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";
const ATTEMPT_SELECT =
  "id, project_id, user_id, chapter_outline_id, beat_id, writing_session_id, generation_type, status, idempotency_key, provider, model, prompt_hash, context_packet_log_id, input_tokens, output_tokens, estimated_cost_usd, credit_cost, error_code, error_message_safe, output_entity_type, output_entity_id, metadata, created_at, updated_at";
const LEDGER_SELECT =
  "id, user_id, project_id, attempt_id, amount, direction, reason, balance_after, metadata, created_at";
const CREDIT_BALANCE_SELECT =
  "id, user_id, balance, monthly_quota, monthly_used, reset_at, source, updated_at";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export interface AdminOverviewMetrics {
  totalUsers: number;
  totalProjects: number;
  pendingProposals: number;
  failedGenerations24h: number;
  creditsDebited24h: number;
  creditsRefunded24h: number;
}

export interface AdminOverviewResponse {
  metrics: AdminOverviewMetrics;
}

export interface AdminProjectListItem extends Project {
  ownerEmail: string | null;
  ownerDisplayName: string | null;
}

export interface AdminProjectsListResponse {
  projects: AdminProjectListItem[];
}

export interface AdminProjectDetailResponse {
  project: Project;
  owner: UserProfile | null;
}

export interface AdminProposalListItem extends AiProposal {
  ownerEmail: string | null;
  ownerDisplayName: string | null;
}

export interface AdminProposalsListResponse {
  proposals: AdminProposalListItem[];
}

export interface AdminProposalDetailResponse {
  proposal: AdminProposalListItem;
}

/**
 * Inherits the safe routing summary from GenerationAttemptSafeSummary, which
 * surfaces logicalModel, routingPolicyVersion, fallbackUsed, retryCount,
 * providerLatencyMs, inputTokens, outputTokens, and estimatedCostUsd for the
 * admin attempt list. No prompt/output/reasoning text is ever included.
 */
export interface AdminGenerationAttemptListItem extends GenerationAttemptSafeSummary {
  projectId: string;
  userId: string;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
}

export interface AdminGenerationAttemptsListResponse {
  attempts: AdminGenerationAttemptListItem[];
}

export interface AdminGenerationAttemptDetailResponse {
  attempt: AdminGenerationAttemptListItem;
  providerEvents: GenerationProviderEvent[];
  correlationId: string | null;
}

export interface AdminUserCreditSection {
  balance: CreditBalance | null;
  recentLedger: CreditLedgerEntry[];
}

export interface AdminUserCreditSectionResponse {
  credit: AdminUserCreditSection;
}

export interface AdminSystemHealthResponse {
  service: string;
  version: string;
  env: EnvPresenceFlags;
}

export interface AdminAuditLogItem {
  id: string;
  userId: string | null;
  projectId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface AdminAuditLogsListResponse {
  logs: AdminAuditLogItem[];
}

function parseLimit(raw: string | undefined, fallback = DEFAULT_LIST_LIMIT): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, MAX_LIST_LIMIT);
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function loadProfileMap(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileRow>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ProfileRow>();
  if (unique.length === 0) return map;

  const { data, error } = await admin.from("profiles").select(PROFILE_SELECT).in("id", unique);
  if (error) {
    console.error("admin profile map failed");
    throw AppError.internal("Failed to load profiles");
  }
  for (const row of data ?? []) {
    map.set((row as ProfileRow).id, row as ProfileRow);
  }
  return map;
}

function ownerLabels(profile: ProfileRow | undefined): {
  ownerEmail: string | null;
  ownerDisplayName: string | null;
} {
  if (!profile) {
    return { ownerEmail: null, ownerDisplayName: null };
  }
  return { ownerEmail: profile.email, ownerDisplayName: profile.display_name };
}

export async function getAdminOverview(bindings: AppBindings): Promise<AdminOverviewResponse> {
  const admin = createServiceRoleClient(bindings);
  const since24h = isoHoursAgo(24);

  const [
    usersRes,
    projectsRes,
    proposalsRes,
    failedAttemptsRes,
    debitRes,
    refundRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("projects").select("id", { count: "exact", head: true }),
    admin
      .from("ai_proposals")
      .select("id", { count: "exact", head: true })
      .eq("status", AI_PROPOSAL_STATUSES.proposed),
    admin
      .from("generation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("status", GENERATION_STATUSES.failed)
      .gte("created_at", since24h),
    admin
      .from("credit_ledger")
      .select("amount")
      .eq("direction", "debit")
      .gte("created_at", since24h),
    admin
      .from("credit_ledger")
      .select("amount")
      .eq("direction", "refund")
      .gte("created_at", since24h),
  ]);

  if (usersRes.error || projectsRes.error || proposalsRes.error || failedAttemptsRes.error) {
    console.error("admin overview counts failed");
    throw AppError.internal("Failed to load admin overview");
  }

  const creditsDebited24h = ((debitRes.data ?? []) as { amount: number }[]).reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const creditsRefunded24h = ((refundRes.data ?? []) as { amount: number }[]).reduce(
    (sum, row) => sum + row.amount,
    0,
  );

  return {
    metrics: {
      totalUsers: usersRes.count ?? 0,
      totalProjects: projectsRes.count ?? 0,
      pendingProposals: proposalsRes.count ?? 0,
      failedGenerations24h: failedAttemptsRes.count ?? 0,
      creditsDebited24h,
      creditsRefunded24h,
    },
  };
}

export async function listAdminProjects(
  bindings: AppBindings,
  limitRaw?: string,
): Promise<AdminProjectsListResponse> {
  const admin = createServiceRoleClient(bindings);
  const limit = parseLimit(limitRaw);

  const { data, error } = await admin
    .from("projects")
    .select(PROJECT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("admin projects list failed");
    throw AppError.internal("Failed to load projects");
  }

  const rows = (data ?? []) as ProjectRow[];
  const profileMap = await loadProfileMap(
    admin,
    rows.map((r) => r.owner_id),
  );

  const projects: AdminProjectListItem[] = rows.map((row) => {
    const profile = profileMap.get(row.owner_id);
    const labels = ownerLabels(profile);
    return {
      ...mapProjectRow(row),
      ...labels,
    };
  });

  return { projects };
}

export async function getAdminProjectDetail(
  bindings: AppBindings,
  projectId: string,
): Promise<AdminProjectDetailResponse> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    console.error("admin project detail failed");
    throw AppError.internal("Failed to load project");
  }
  if (!data) throw AppError.notFound("Project not found");

  const row = data as ProjectRow;
  const { data: ownerRow } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", row.owner_id)
    .maybeSingle();

  return {
    project: mapProjectRow(row),
    owner: ownerRow ? mapProfileRow(ownerRow as ProfileRow) : null,
  };
}

export async function listAdminProposals(
  bindings: AppBindings,
  query: { status?: string; limit?: string },
): Promise<AdminProposalsListResponse> {
  const admin = createServiceRoleClient(bindings);
  const limit = parseLimit(query.limit);

  let dbQuery = admin.from("ai_proposals").select(PROPOSAL_SELECT).order("created_at", {
    ascending: false,
  });
  if (query.status) {
    dbQuery = dbQuery.eq("status", query.status);
  }

  const { data, error } = await dbQuery.limit(limit);
  if (error) {
    console.error("admin proposals list failed");
    throw AppError.internal("Failed to load proposals");
  }

  const rows = (data ?? []) as AiProposalRow[];
  const projectIds = rows.map((r) => r.project_id);
  const { data: projectRows } = await admin
    .from("projects")
    .select("id, owner_id")
    .in("id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  const ownerByProject = new Map<string, string>();
  for (const p of projectRows ?? []) {
    ownerByProject.set(p.id as string, p.owner_id as string);
  }

  const profileMap = await loadProfileMap(admin, [...ownerByProject.values()]);

  const proposals: AdminProposalListItem[] = rows.map((row) => {
    const ownerId = ownerByProject.get(row.project_id);
    const profile = ownerId ? profileMap.get(ownerId) : undefined;
    const labels = ownerLabels(profile);
    return {
      ...mapAiProposalRow(row),
      ...labels,
    };
  });

  return { proposals };
}

export async function getAdminProposalDetail(
  bindings: AppBindings,
  proposalId: string,
): Promise<AdminProposalDetailResponse> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", proposalId)
    .maybeSingle();

  if (error) {
    console.error("admin proposal detail failed");
    throw AppError.internal("Failed to load proposal");
  }
  if (!data) throw AppError.notFound("Proposal not found");

  const row = data as AiProposalRow;
  const { data: projectRow } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", row.project_id)
    .maybeSingle();

  let profile: ProfileRow | undefined;
  if (projectRow?.owner_id) {
    const { data: ownerRow } = await admin
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", projectRow.owner_id as string)
      .maybeSingle();
    profile = ownerRow as ProfileRow | undefined;
  }

  const labels = ownerLabels(profile);
  return {
    proposal: {
      ...mapAiProposalRow(row),
      ...labels,
    },
  };
}

export async function listAdminGenerationAttempts(
  bindings: AppBindings,
  query: { status?: string; limit?: string },
): Promise<AdminGenerationAttemptsListResponse> {
  const admin = createServiceRoleClient(bindings);
  const limit = parseLimit(query.limit);

  let dbQuery = admin.from("generation_attempts").select(ATTEMPT_SELECT).order("created_at", {
    ascending: false,
  });
  if (query.status) {
    dbQuery = dbQuery.eq("status", query.status);
  }

  const { data, error } = await dbQuery.limit(limit);
  if (error) {
    console.error("admin generation attempts list failed");
    throw AppError.internal("Failed to load generation attempts");
  }

  const rows = (data ?? []) as GenerationAttemptRow[];
  const profileMap = await loadProfileMap(
    admin,
    rows.map((r) => r.user_id),
  );

  const attempts: AdminGenerationAttemptListItem[] = rows.map((row) => {
    const mapped = mapGenerationAttemptRow(row);
    const summary = toGenerationAttemptSafeSummary(mapped);
    const profile = profileMap.get(row.user_id);
    const labels = ownerLabels(profile);
    return {
      ...summary,
      projectId: row.project_id,
      userId: row.user_id,
      ...labels,
    };
  });

  return { attempts };
}

export async function getAdminGenerationAttemptDetail(
  bindings: AppBindings,
  attemptId: string,
): Promise<AdminGenerationAttemptDetailResponse> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("generation_attempts")
    .select(ATTEMPT_SELECT)
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    console.error("admin generation attempt detail failed");
    throw AppError.internal("Failed to load generation attempt");
  }
  if (!data) throw AppError.notFound("Generation attempt not found");

  const row = data as GenerationAttemptRow;
  const { data: ownerRow } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", row.user_id)
    .maybeSingle();

  const mapped = mapGenerationAttemptRow(row);
  const summary = toGenerationAttemptSafeSummary(mapped);
  const labels = ownerLabels(ownerRow as ProfileRow | undefined);
  const providerEvents = await listGenerationProviderEvents(bindings, attemptId);
  const correlationId =
    typeof mapped.metadata.correlationId === "string"
      ? mapped.metadata.correlationId
      : null;

  return {
    attempt: {
      ...summary,
      projectId: row.project_id,
      userId: row.user_id,
      ...labels,
    },
    providerEvents,
    correlationId,
  };
}

export async function getAdminUserCreditSection(
  bindings: AppBindings,
  userId: string,
): Promise<AdminUserCreditSectionResponse> {
  const admin = createServiceRoleClient(bindings);

  const { data: balanceRow, error: balanceError } = await admin
    .from("credit_balances")
    .select(CREDIT_BALANCE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (balanceError) {
    console.error("admin user credit balance failed");
    throw AppError.internal("Failed to load credit balance");
  }

  const { data: ledgerRows, error: ledgerError } = await admin
    .from("credit_ledger")
    .select(LEDGER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (ledgerError) {
    console.error("admin user credit ledger failed");
    throw AppError.internal("Failed to load credit ledger");
  }

  return {
    credit: {
      balance: balanceRow ? mapCreditBalanceRow(balanceRow as CreditBalanceRow) : null,
      recentLedger: (ledgerRows ?? []).map((r) =>
        mapCreditLedgerRow(r as CreditLedgerRow),
      ),
    },
  };
}

export async function getAdminSystemHealth(bindings: AppBindings): Promise<AdminSystemHealthResponse> {
  return {
    service: "vibenovel-api",
    version: "0.1.0",
    env: getEnvPresenceFlags(bindings),
  };
}

export async function listAdminAuditLogs(
  bindings: AppBindings,
  limitRaw?: string,
): Promise<AdminAuditLogsListResponse> {
  const admin = createServiceRoleClient(bindings);
  const limit = parseLimit(limitRaw, 100);

  const { data, error } = await admin
    .from("audit_logs")
    .select("id, user_id, project_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("admin audit logs list failed");
    throw AppError.internal("Failed to load audit logs");
  }

  const logs: AdminAuditLogItem[] = (data ?? []).map((row) => ({
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    action: row.action as string,
    entityType: (row.entity_type as string | null) ?? null,
    entityId: (row.entity_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }));

  return { logs };
}