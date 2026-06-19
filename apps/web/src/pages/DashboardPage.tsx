import {
  ActiveProjectCard,
  DashboardGreeting,
  NewProjectCta,
  NoActiveProjectCard,
  RecentProjectsSection,
} from "@/components/dashboard";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useProjectBrowse } from "@/hooks/useProjectBrowse";
import { useProjectManageModals } from "@/hooks/useProjectManageModals";
import { shouldUseMocks } from "@/lib/env";

/**
 * Dashboard Penulis — Sprint 1 Task 1.6 (+ Sprint 2 Task 2.13 API integration)
 * Source: stitch-reference/dashboard_penulis_refined
 * Wrapped by AppShell via router layout.
 */
export function DashboardPage() {
  const useMocks = shouldUseMocks();
  const { activeProject, usage, notice, loading, isEmpty, reload } = useDashboardData();
  const browse = useProjectBrowse({
    previewLimit: 6,
    excludeProjectId: activeProject?.id ?? null,
    includeArchived: false,
  });

  const { openEdit, openDelete, modals } = useProjectManageModals({
    onChanged: () => {
      reload();
      browse.refresh();
    },
  });

  const hasProjects = Boolean(activeProject) || browse.total > 0 || !isEmpty;
  const manageDisabled = useMocks || browse.isMock;

  return (
    <div className="flex w-full flex-col gap-xl">
      <IntegrationNotice message={notice} />
      <DashboardGreeting usage={usage} hasProjects={hasProjects} />

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
        {activeProject ? (
          <ActiveProjectCard
            project={activeProject}
            onEditTitle={openEdit}
            onDeleteProject={openDelete}
            manageActionsDisabled={manageDisabled}
          />
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

      <RecentProjectsSection
        browse={browse}
        onEditTitle={openEdit}
        onDeleteProject={openDelete}
        manageActionsDisabled={manageDisabled}
      />

      {modals}
    </div>
  );
}