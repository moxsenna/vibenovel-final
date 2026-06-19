import { Link } from "react-router-dom";
import { Badge, Icon } from "@/components/ui";
import type { DashboardRecentProject } from "@/mocks/dashboard";
import { ProjectCardActionsMenu } from "./ProjectCardActionsMenu";

export interface RecentProjectCardProps {
  project: DashboardRecentProject;
  onEditTitle?: (projectId: string, title: string) => void;
  onDeleteProject?: (projectId: string, title: string) => void;
  manageActionsDisabled?: boolean;
}

export function RecentProjectCard({
  project,
  onEditTitle,
  onDeleteProject,
  manageActionsDisabled,
}: RecentProjectCardProps) {
  const showMenu = Boolean(onEditTitle && onDeleteProject) && !manageActionsDisabled;

  return (
    <div className="relative flex flex-col rounded-xl border border-border bg-surface p-md transition-shadow hover:shadow-md">
      {showMenu ? (
        <ProjectCardActionsMenu
          className="absolute right-2 top-2 z-10"
          onEdit={() => onEditTitle!(project.id, project.title)}
          onDelete={() => onDeleteProject!(project.id, project.title)}
        />
      ) : null}

      <Link to={project.route} className="flex flex-1 flex-col pr-8">
        <div className="mb-md flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`shrink-0 rounded px-2 py-0.5 font-label-sm text-label-sm ${project.genreBadgeClass}`}
            >
              {project.genre}
            </span>
            {project.statusBadgeVariant ? (
              <Badge
                variant={project.statusBadgeVariant}
                className="max-w-full truncate"
                title={project.statusLabel}
              >
                {project.statusLabel}
              </Badge>
            ) : null}
          </div>
          <Icon
            name={project.bookmarked ? "bookmark" : "bookmark_border"}
            size={20}
            className="shrink-0 text-muted-text"
          />
        </div>
        <h4
          className="mb-xs truncate font-headline-md text-headline-md text-on-surface"
          title={project.titleAbsolute ?? project.title}
        >
          {project.title}
        </h4>
        {project.secondaryLine ? (
          <p className="mb-xs font-label-sm text-label-sm text-muted-text">{project.secondaryLine}</p>
        ) : null}
        <p className="mb-md line-clamp-2 font-body-sm text-body-sm text-muted-text">
          {project.excerpt}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-surface-variant pt-md">
          <span
            className="flex items-center gap-1 font-label-sm text-label-sm text-muted-text"
            title={project.lastEditedAbsolute}
          >
            <Icon name="history" size={14} />
            {project.lastEditedLabel}
          </span>
          {project.progressLabel ? (
            <span className="font-label-sm text-label-sm text-primary">{project.progressLabel}</span>
          ) : null}
        </div>
      </Link>
    </div>
  );
}