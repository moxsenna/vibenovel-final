import type { Project, ProjectEntryPath, ProjectStatus } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export type ProjectListSortField = "lastEditedAt" | "createdAt" | "title";
export type ProjectListOrder = "asc" | "desc";

export interface CreateProjectInput {
  title: string;
  entryPath?: ProjectEntryPath;
}

export interface UpdateProjectInput {
  title?: string;
}

export interface FetchProjectsOptions {
  /** When true, returns all projects for the owner (not only is_active). */
  includeArchived?: boolean;
}

export interface FetchProjectsPageOptions {
  includeArchived?: boolean;
  q?: string;
  status?: ProjectStatus[];
  sort?: ProjectListSortField;
  order?: ProjectListOrder;
  limit?: number;
  cursor?: string | null;
}

export interface ProjectsPage {
  items: Project[];
  total: number;
  nextCursor: string | null;
}

function buildProjectsQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchProjects(
  token?: string | null,
  options?: FetchProjectsOptions,
): Promise<Project[]> {
  const query = buildProjectsQuery({
    includeArchived: options?.includeArchived ? "true" : undefined,
  });
  return apiRequest<Project[]>(`/api/projects${query}`, { token });
}

export async function fetchProjectsPage(
  token?: string | null,
  options?: FetchProjectsPageOptions,
): Promise<ProjectsPage> {
  const query = buildProjectsQuery({
    includeArchived: options?.includeArchived ? "true" : undefined,
    q: options?.q,
    status: options?.status?.length ? options.status.join(",") : undefined,
    sort: options?.sort,
    order: options?.order,
    limit: options?.limit !== undefined ? String(options.limit) : undefined,
    cursor: options?.cursor ?? undefined,
  });
  return apiRequest<ProjectsPage>(`/api/projects${query}`, { token });
}

export async function createProject(
  input: CreateProjectInput,
  token?: string | null,
): Promise<Project> {
  return apiRequest<Project>("/api/projects", {
    method: "POST",
    body: input,
    token,
  });
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  token?: string | null,
): Promise<Project> {
  return apiRequest<Project>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: input,
    token,
  });
}

/** Soft-delete: sets is_active false (hidden from default lists). */
export async function archiveProject(
  projectId: string,
  token?: string | null,
): Promise<Project> {
  return apiRequest<Project>(`/api/projects/${projectId}`, {
    method: "DELETE",
    token,
  });
}

export function pickActiveProject(projects: Project[]): Project | null {
  return projects.find((p) => p.isActive) ?? projects[0] ?? null;
}