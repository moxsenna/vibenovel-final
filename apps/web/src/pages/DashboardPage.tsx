import {
  ActiveProjectCard,
  DashboardGreeting,
  NewProjectCta,
  NoActiveProjectCard,
  RecentProjectsSection,
} from "@/components/dashboard";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useDashboardData } from "@/hooks/useDashboardData";

/**
 * Dashboard Penulis — Sprint 1 Task 1.6 (+ Sprint 2 Task 2.13 API integration)
 * Source: stitch-reference/dashboard_penulis_refined
 * Wrapped by AppShell via router layout.
 */
export function DashboardPage() {
  const { activeProject, recentProjects, usage, notice, loading, isEmpty } = useDashboardData();

  return (
    <div className="flex w-full flex-col gap-xl">
      <IntegrationNotice message={notice} />
      <DashboardGreeting usage={usage} />

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
        {activeProject ? (
          <ActiveProjectCard project={activeProject} />
        ) : isEmpty ? (
          <NoActiveProjectCard />
        ) : null}
        <NewProjectCta />
      </div>

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat data dashboard...
        </p>
      ) : null}

      <RecentProjectsSection projects={recentProjects} />
    </div>
  );
}