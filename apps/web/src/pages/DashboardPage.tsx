import {
  ActiveProjectCard,
  DashboardGreeting,
  NewProjectCta,
  RecentProjectsSection,
} from "@/components/dashboard";
import {
  mockDashboardActiveProject,
  mockDashboardRecentProjects,
} from "@/mocks/dashboard";

/**
 * Dashboard Penulis — Sprint 1 Task 1.6
 * Source: stitch-reference/dashboard_penulis_refined
 * Wrapped by AppShell via router layout.
 */
export function DashboardPage() {
  return (
    <div className="flex w-full flex-col gap-xl">
      <DashboardGreeting />

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
        <ActiveProjectCard project={mockDashboardActiveProject} />
        <NewProjectCta />
      </div>

      <RecentProjectsSection projects={mockDashboardRecentProjects} />
    </div>
  );
}