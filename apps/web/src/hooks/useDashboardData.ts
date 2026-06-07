import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import {
  mapCreditToUsage,
  mapProjectToActiveCard,
  mapProjectToRecentCard,
} from "@/lib/api-mappers";
import { shouldUseMocks } from "@/lib/env";
import {
  mockDashboardActiveProject,
  mockDashboardRecentProjects,
  mockDashboardUsage,
  type DashboardActiveProject,
  type DashboardRecentProject,
  type DashboardUsageSummary,
} from "@/mocks/dashboard";
import { fetchCreditBalance } from "@/services/credits";
import { fetchProjects, pickActiveProject } from "@/services/projects";

export type DataSource = "mock" | "api" | "api-fallback";

export interface DashboardData {
  activeProject: DashboardActiveProject;
  recentProjects: DashboardRecentProject[];
  usage: DashboardUsageSummary;
  source: DataSource;
  loading: boolean;
  notice: string | null;
}

export function useDashboardData(): DashboardData {
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();

  const [activeProject, setActiveProject] = useState(mockDashboardActiveProject);
  const [recentProjects, setRecentProjects] = useState(mockDashboardRecentProjects);
  const [usage, setUsage] = useState(mockDashboardUsage);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const token = session?.access_token ?? null;

  useEffect(() => {
    if (authLoading) return;

    if (useMocks || !token) {
      setActiveProject(mockDashboardActiveProject);
      setRecentProjects(mockDashboardRecentProjects);
      setUsage(mockDashboardUsage);
      setSource("mock");
      setNotice(
        useMocks
          ? null
          : "Masuk ke akun untuk membaca data proyek dari API. Menampilkan mock Sprint 1.",
      );
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotice(null);

      try {
        const [projects, creditBalance] = await Promise.all([
          fetchProjects(token),
          fetchCreditBalance(token),
        ]);

        if (cancelled) return;

        const active = pickActiveProject(projects);
        if (!active) {
          setActiveProject(mockDashboardActiveProject);
          setRecentProjects(mockDashboardRecentProjects);
          setUsage(mapCreditToUsage(creditBalance));
          setSource("api-fallback");
          setNotice("Belum ada proyek di API. Menampilkan mock dashboard.");
          return;
        }

        const others = projects.filter((p) => p.id !== active.id);
        setActiveProject(mapProjectToActiveCard(active));
        setRecentProjects(
          others.length > 0
            ? others.map((p, i) => mapProjectToRecentCard(p, i))
            : mockDashboardRecentProjects,
        );
        setUsage(mapCreditToUsage(creditBalance));
        setSource("api");
      } catch (error) {
        if (cancelled) return;
        setActiveProject(mockDashboardActiveProject);
        setRecentProjects(mockDashboardRecentProjects);
        setUsage(mockDashboardUsage);
        setSource("api-fallback");
        setNotice(
          error instanceof ApiClientError
            ? `API tidak tersedia (${error.message}). Menampilkan mock Sprint 1.`
            : "API tidak tersedia. Menampilkan mock Sprint 1.",
        );
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
      activeProject,
      recentProjects,
      usage,
      source,
      loading,
      notice,
    }),
    [activeProject, recentProjects, usage, source, loading, notice],
  );
}