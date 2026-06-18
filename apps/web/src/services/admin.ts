import type {
  AiProposal,
  CreditBalance,
  CreditLedgerEntry,
  Project,
  UserProfile,
} from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface AdminUsersListResponse {
  users: UserProfile[];
}

export interface AdminUserDetailResponse {
  user: UserProfile;
}

export interface AdminGrantCreditsPayload {
  amount: number;
  reason: string;
  note?: string;
  idempotencyKey: string;
}

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

export interface AdminGenerationAttemptListItem {
  id: string;
  status: string;
  generationType: string;
  creditCost: number;
  provider: string | null;
  model: string | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  createdAt: string;
  projectId: string;
  userId: string;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
}

export interface AdminGenerationAttemptsListResponse {
  attempts: AdminGenerationAttemptListItem[];
}

export interface AdminUserCreditSectionResponse {
  credit: {
    balance: CreditBalance | null;
    recentLedger: CreditLedgerEntry[];
  };
}

export interface AdminSystemHealthResponse {
  service: string;
  version: string;
  env: Record<string, boolean | string | number>;
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

export async function fetchAdminUsers(token?: string | null): Promise<AdminUsersListResponse> {
  return apiRequest<AdminUsersListResponse>("/api/admin/users", { token });
}

export async function fetchAdminUser(
  userId: string,
  token?: string | null,
): Promise<AdminUserDetailResponse> {
  return apiRequest<AdminUserDetailResponse>(`/api/admin/users/${userId}`, { token });
}

export async function fetchAdminOverview(token?: string | null): Promise<AdminOverviewResponse> {
  return apiRequest<AdminOverviewResponse>("/api/admin/overview", { token });
}

export async function fetchAdminProjects(token?: string | null): Promise<AdminProjectsListResponse> {
  return apiRequest<AdminProjectsListResponse>("/api/admin/projects", { token });
}

export async function fetchAdminProject(
  projectId: string,
  token?: string | null,
): Promise<AdminProjectDetailResponse> {
  return apiRequest<AdminProjectDetailResponse>(`/api/admin/projects/${projectId}`, { token });
}

export async function fetchAdminProposals(
  token?: string | null,
  params?: { status?: string },
): Promise<AdminProposalsListResponse> {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
  return apiRequest<AdminProposalsListResponse>(`/api/admin/proposals${qs}`, { token });
}

export async function fetchAdminProposal(
  proposalId: string,
  token?: string | null,
): Promise<AdminProposalDetailResponse> {
  return apiRequest<AdminProposalDetailResponse>(`/api/admin/proposals/${proposalId}`, { token });
}

export async function fetchAdminGenerationAttempts(
  token?: string | null,
  params?: { status?: string },
): Promise<AdminGenerationAttemptsListResponse> {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
  return apiRequest<AdminGenerationAttemptsListResponse>(`/api/admin/generation-attempts${qs}`, {
    token,
  });
}

export async function fetchAdminUserCredits(
  userId: string,
  token?: string | null,
): Promise<AdminUserCreditSectionResponse> {
  return apiRequest<AdminUserCreditSectionResponse>(`/api/admin/users/${userId}/credits`, {
    token,
  });
}

export async function fetchAdminSystemHealth(
  token?: string | null,
): Promise<AdminSystemHealthResponse> {
  return apiRequest<AdminSystemHealthResponse>("/api/admin/system/health", { token });
}

export async function fetchAdminAuditLogs(
  token?: string | null,
): Promise<AdminAuditLogsListResponse> {
  return apiRequest<AdminAuditLogsListResponse>("/api/admin/audit-logs", { token });
}

export async function grantAdminUserCredits(
  userId: string,
  payload: AdminGrantCreditsPayload,
  token?: string | null,
): Promise<unknown> {
  return apiRequest<unknown>(`/api/admin/users/${userId}/credits/grant`, {
    method: "POST",
    token,
    body: payload,
  });
}