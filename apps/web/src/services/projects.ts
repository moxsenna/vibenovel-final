import type { Project, ProjectEntryPath } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface CreateProjectInput {
  title: string;
  entryPath?: ProjectEntryPath;
}

export interface FetchProjectsOptions {
  /** When true, returns all projects for the owner (not only is_active). */
  includeArchived?: boolean;
}

export async function fetchProjects(
  token?: string | null,
  options?: FetchProjectsOptions,
): Promise<Project[]> {
  const query = options?.includeArchived ? "?includeArchived=true" : "";
  return apiRequest<Project[]>(`/api/projects${query}`, { token });
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

export function pickActiveProject(projects: Project[]): Project | null {
  return projects.find((p) => p.isActive) ?? projects[0] ?? null;
}