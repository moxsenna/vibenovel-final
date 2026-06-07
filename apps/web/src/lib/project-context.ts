import { resolveApiProjectId } from "@/lib/api-mappers";
import { fetchProjects, pickActiveProject } from "@/services/projects";

export async function resolveProjectIdForRoute(
  routeProjectId: string | undefined,
  token: string,
): Promise<string | null> {
  const projects = await fetchProjects(token);
  const active = pickActiveProject(projects);
  return resolveApiProjectId(routeProjectId, active?.id ?? null);
}