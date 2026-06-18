import { Button } from "@/components/ui";
import { RecentProjectCard } from "@/components/dashboard/RecentProjectCard";
import { ProjectToolbar } from "@/components/dashboard/ProjectToolbar";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { mapProjectToRecentCard } from "@/lib/api-mappers";
import { useProjectBrowse } from "@/hooks/useProjectBrowse";

export function ProjectsIndexPage() {
  const browse = useProjectBrowse({ includeArchived: true });

  const cards = browse.items.map((p, i) => mapProjectToRecentCard(p, i));

  return (
    <div className="flex w-full flex-col gap-xl">
      <header>
        <h1 className="font-display text-display text-on-surface">Semua Proyek</h1>
        <p className="mt-unit font-body-md text-body-md text-muted-text">
          Cari, filter, dan buka proyek Anda.
        </p>
      </header>

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

      {browse.error ? (
        <p className="font-body-sm text-body-sm text-danger" role="alert">
          {browse.error}
        </p>
      ) : null}

      {cards.length === 0 && !browse.loading ? (
        <DashboardEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((project) => (
            <RecentProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {browse.loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat proyek...
        </p>
      ) : null}

      {browse.nextCursor ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={browse.loadMore} disabled={browse.loading}>
            Muat lebih banyak
          </Button>
        </div>
      ) : null}
    </div>
  );
}