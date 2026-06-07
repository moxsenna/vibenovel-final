import { Link } from "react-router-dom";
import { Icon } from "@/components/ui";
import type { DashboardRecentProject } from "@/mocks/dashboard";

export interface RecentProjectCardProps {
  project: DashboardRecentProject;
}

export function RecentProjectCard({ project }: RecentProjectCardProps) {
  return (
    <Link
      to={project.route}
      className="flex cursor-pointer flex-col rounded-xl border border-border bg-surface p-md transition-shadow hover:shadow-md"
    >
      <div className="mb-md flex items-start justify-between">
        <span
          className={`rounded px-2 py-0.5 font-label-sm text-label-sm ${project.genreBadgeClass}`}
        >
          {project.genre}
        </span>
        <Icon
          name={project.bookmarked ? "bookmark" : "bookmark_border"}
          size={20}
          className="text-muted-text"
        />
      </div>
      <h4 className="mb-xs truncate font-headline-md text-headline-md text-on-surface">
        {project.title}
      </h4>
      <p className="mb-md line-clamp-2 font-body-sm text-body-sm text-muted-text">
        {project.excerpt}
      </p>
      <div className="mt-auto flex items-center justify-between border-t border-surface-variant pt-md">
        <span className="flex items-center gap-1 font-label-sm text-label-sm text-muted-text">
          <Icon name="history" size={14} />
          {project.lastEditedLabel}
        </span>
        <span
          className={[
            "font-label-sm text-label-sm",
            project.statusLabel === "Fondasi cerita" ? "text-muted-text" : "text-primary",
          ].join(" ")}
        >
          {project.statusLabel}
        </span>
      </div>
    </Link>
  );
}