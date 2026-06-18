import { Link } from "react-router-dom";
import type { Project } from "@vibenovel/shared";
import { Icon } from "@/components/ui";
import type { DashboardRecentProject } from "@/mocks/dashboard";
import { mapProjectToRecentCard } from "@/lib/api-mappers";
import { ROUTES } from "@/routes/paths";
import { RecentProjectCard } from "./RecentProjectCard";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { ProjectToolbar } from "./ProjectToolbar";
import type { ProjectBrowseResult } from "@/hooks/useProjectBrowse";

export interface RecentProjectsSectionProps {
  /** Legacy: static card list (mock-only paths). */
  projects?: DashboardRecentProject[];
  browse?: ProjectBrowseResult;
}

export function RecentProjectsSection({
  projects: legacyProjects,
  browse,
}: RecentProjectsSectionProps) {
  const cards: DashboardRecentProject[] = browse
    ? browse.items.map((p: Project, i) => mapProjectToRecentCard(p, i))
    : (legacyProjects ?? []);

  if (!browse && cards.length === 0) {
    return <DashboardEmptyState />;
  }

  return (
    <section className="mt-xl flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-headline-md text-headline-md text-on-surface">Proyek Lainnya</h3>
        <Link
          to={ROUTES.projects}
          className="flex items-center gap-1 font-label-md text-label-md text-primary transition-colors hover:text-primary-dark"
        >
          Lihat Semua
          <Icon name="chevron_right" size={18} />
        </Link>
      </div>

      {browse ? (
        <ProjectToolbar
          search={browse.state.q}
          onSearchChange={browse.setSearch}
          status={browse.state.status}
          onStatusChange={browse.setStatusFilter}
          sort={browse.state.sort}
          onSortChange={browse.setSort}
          order={browse.state.order}
          onOrderChange={browse.setOrder}
          total={browse.total}
        />
      ) : null}

      {browse?.error ? (
        <p className="font-body-sm text-body-sm text-danger" role="alert">
          {browse.error}
        </p>
      ) : null}

      {cards.length === 0 && !browse?.loading ? (
        <DashboardEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((project) => (
            <RecentProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {browse?.loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat proyek...
        </p>
      ) : null}
    </section>
  );
}