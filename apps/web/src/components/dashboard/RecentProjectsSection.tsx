import { Icon } from "@/components/ui";
import type { DashboardRecentProject } from "@/mocks/dashboard";
import { RecentProjectCard } from "./RecentProjectCard";
import { DashboardEmptyState } from "./DashboardEmptyState";

export interface RecentProjectsSectionProps {
  projects: DashboardRecentProject[];
}

export function RecentProjectsSection({ projects }: RecentProjectsSectionProps) {
  if (projects.length === 0) {
    return <DashboardEmptyState />;
  }

  return (
    <section className="mt-xl">
      <div className="mb-lg flex items-center justify-between">
        <h3 className="font-headline-md text-headline-md text-on-surface">Proyek Lainnya</h3>
        <button
          type="button"
          className="flex items-center gap-1 font-label-md text-label-md text-primary transition-colors hover:text-primary-dark"
        >
          Lihat Semua
          <Icon name="chevron_right" size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <RecentProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}