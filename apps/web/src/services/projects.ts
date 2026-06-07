import type { Project } from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export async function fetchProjects(token?: string | null): Promise<Project[]> {
  return apiRequest<Project[]>("/api/projects", { token });
}

export function pickActiveProject(projects: Project[]): Project | null {
  return projects.find((p) => p.isActive) ?? projects[0] ?? null;
}