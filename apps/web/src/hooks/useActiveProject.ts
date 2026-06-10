import { useEffect, useMemo, useState } from "react";
import type { Project } from "@vibenovel/shared";
import { PROJECT_STATUSES } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { DEMO_PROJECT_ID, mockActiveProject } from "@/mocks/projects";
import { fetchProjects, pickActiveProject } from "@/services/projects";

const MOCK_SIDEBAR_PROJECT: Project = {
  id: DEMO_PROJECT_ID,
  ownerId: "mock-owner",
  title: mockActiveProject.title,
  genre: mockActiveProject.genre,
  status: mockActiveProject.status ?? PROJECT_STATUSES.in_progress,
  currentChapter: mockActiveProject.currentChapter,
  entryPath: null,
  isActive: true,
  lastEditedAt: mockActiveProject.lastEditedAt,
  createdAt: mockActiveProject.lastEditedAt,
  updatedAt: mockActiveProject.lastEditedAt,
};

export type ActiveProjectSource = "mock" | "api" | "none";

export interface ActiveProjectState {
  project: Project | null;
  source: ActiveProjectSource;
  loading: boolean;
}

/** Lightweight active-project lookup for shell navigation (sidebar). */
export function useActiveProject(): ActiveProjectState {
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;

  const [project, setProject] = useState<Project | null>(null);
  const [source, setSource] = useState<ActiveProjectSource>("none");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (useMocks || !token) {
      setProject(useMocks ? MOCK_SIDEBAR_PROJECT : null);
      setSource(useMocks ? "mock" : "none");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const projects = await fetchProjects(token, { includeArchived: true });
        if (cancelled) return;

        const match = window.location.pathname.match(/^\/projects\/([^/]+)/);
        const routeProjectId = match ? match[1] : null;

        let active: Project | null = null;
        if (routeProjectId && routeProjectId !== "new") {
          active = projects.find((p) => p.id === routeProjectId) ?? null;
          if (!active) {
            setProject(null);
            setSource("none");
            return;
          }
        } else {
          active = pickActiveProject(projects);
        }

        setProject(active);
        setSource(active ? "api" : "none");
      } catch {
        if (cancelled) return;
        setProject(null);
        setSource("none");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, token, useMocks]);

  return useMemo(
    () => ({
      project,
      source,
      loading,
    }),
    [project, source, loading],
  );
}

/** Project id for sidebar links — demo only in explicit mock mode. */
export function resolveSidebarProjectId(
  activeProject: Project | null,
  useMocks: boolean,
): string | null {
  if (activeProject?.id) return activeProject.id;
  if (useMocks) return DEMO_PROJECT_ID;
  return null;
}