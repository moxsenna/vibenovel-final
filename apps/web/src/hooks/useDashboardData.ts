import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import {
  mapCreditToUsage,
  mapProjectToActiveCard,
  mapProjectToRecentCard,
} from "@/lib/api-mappers";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
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

export type DataSource = "mock" | "api" | "error";

export interface DashboardData {
  activeProject: DashboardActiveProject | null;
  recentProjects: DashboardRecentProject[];
  usage: DashboardUsageSummary;
  source: DataSource;
  loading: boolean;
  notice: string | null;
  isEmpty: boolean;
}

export function useDashboardData(): DashboardData {
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();

  const [activeProject, setActiveProject] = useState<DashboardActiveProject | null>(
    mockDashboardActiveProject,
  );
  const [recentProjects, setRecentProjects] = useState(mockDashboardRecentProjects);
  const [usage, setUsage] = useState(mockDashboardUsage);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const token = session?.access_token ?? null;

  useEffect(() => {
    if (authLoading) return;

    if (useMocks || !token) {
      setActiveProject(mockDashboardActiveProject);
      setRecentProjects(mockDashboardRecentProjects);
      setUsage(mockDashboardUsage);
      setSource("mock");
      setIsEmpty(false);
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk membaca data proyek dari API.");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotice(null);

      try {
        const [projects, creditBalance] = await Promise.all([
          fetchProjects(token, { includeArchived: true }),
          fetchCreditBalance(token),
        ]);

        if (cancelled) return;

        const active = pickActiveProject(projects);
        if (!active) {
          setActiveProject(null);
          setRecentProjects([]);
          setUsage(mapCreditToUsage(creditBalance));
          setSource("api");
          setIsEmpty(true);
          setNotice(null);
          return;
        }

        const others = projects.filter((p) => p.id !== active.id);
        setActiveProject(mapProjectToActiveCard(active));
        setRecentProjects(others.map((p, i) => mapProjectToRecentCard(p, i)));
        setUsage(mapCreditToUsage(creditBalance));
        setSource("api");
        setIsEmpty(false);
      } catch (error) {
        if (cancelled) return;
        setActiveProject(null);
        setRecentProjects([]);
        setUsage(
          allowMockFallback()
            ? mockDashboardUsage
            : { label: "Pemakaian AI Bulan Ini", used: 0, total: 0 },
        );
        setSource("error");
        setIsEmpty(false);
        setNotice(
          error instanceof ApiClientError
            ? `API tidak tersedia (${error.message}). Coba muat ulang setelah login.`
            : "API tidak tersedia. Coba muat ulang setelah login.",
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
      isEmpty,
    }),
    [activeProject, recentProjects, usage, source, loading, notice, isEmpty],
  );
}