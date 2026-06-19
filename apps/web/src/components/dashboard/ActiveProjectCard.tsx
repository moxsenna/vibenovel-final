import { Link } from "react-router-dom";
import { Badge, Icon } from "@/components/ui";
import type { DashboardActiveProject, DashboardProgressStep } from "@/mocks/dashboard";
import { ProjectCardActionsMenu } from "./ProjectCardActionsMenu";

export interface ActiveProjectCardProps {
  project: DashboardActiveProject;
  onEditTitle?: (projectId: string, title: string) => void;
  onDeleteProject?: (projectId: string, title: string) => void;
  manageActionsDisabled?: boolean;
}

function ProgressStepIcon({ status }: { status: DashboardProgressStep["status"] }) {
  if (status === "done") {
    return <Icon name="check_circle" size={18} className="text-tertiary-container" />;
  }
  if (status === "current") {
    return <Icon name="radio_button_checked" size={18} className="text-primary" />;
  }
  return <Icon name="radio_button_unchecked" size={18} className="text-muted-text" />;
}

export function ActiveProjectCard({
  project,
  onEditTitle,
  onDeleteProject,
  manageActionsDisabled,
}: ActiveProjectCardProps) {
  const kicker = project.heroKicker ?? "Lanjutkan";
  const ctaFallback = project.ctaLabel ?? "Buka proyek";
  const showMenu = Boolean(onEditTitle && onDeleteProject) && !manageActionsDisabled;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] border border-border bg-surface p-lg shadow-sm lg:col-span-2">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-soft opacity-50 blur-3xl transition-transform duration-700 group-hover:scale-110" />

      <div className="relative z-10 mb-xl flex items-start justify-between">
        <Badge variant="success" icon={<Icon name="edit" size={14} />}>
          {project.statusBadge}
        </Badge>
        {showMenu ? (
          <ProjectCardActionsMenu
            onEdit={() => onEditTitle!(project.id, project.title)}
            onDelete={() => onDeleteProject!(project.id, project.title)}
          />
        ) : null}
      </div>

      <div className="relative z-10 flex-1">
        <p className="mb-2 font-label-md text-label-md uppercase tracking-wider text-primary">
          {kicker}
        </p>
        <h3 className="mb-xs font-headline-lg text-headline-lg text-on-surface">
          {project.title}
        </h3>
        <p className="mb-lg font-body-md text-body-md text-muted-text">{project.subtitle}</p>

        <div className="mb-lg flex flex-wrap items-center gap-4 text-muted-text">
          <span className="flex items-center gap-1 font-body-sm text-body-sm">
            <Icon name="menu_book" size={16} />
            Bab {project.currentChapter || 1}
          </span>
          <span
            className="flex items-center gap-1 font-body-sm text-body-sm"
            title={project.lastEditedAbsolute}
          >
            <Icon name="schedule" size={16} />
            {project.lastEditedLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {project.progressSteps.map((step) => (
            <div key={step.id} className="flex items-center gap-2">
              <ProgressStepIcon status={step.status} />
              <span
                className={[
                  "font-body-sm text-body-sm",
                  step.status === "current" ? "font-medium text-on-surface" : "text-muted-text",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-auto flex justify-end">
        {project.ctaDisabled ? (
          <span className="inline-flex min-h-[44px] items-center rounded-pill bg-surface-variant px-5 font-label-md text-label-md text-muted-text">
            {project.ctaLabel ?? ctaFallback}
          </span>
        ) : (
          <Link
            to={project.writeRoute}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-primary px-5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-dark"
          >
            {project.ctaLabel ?? ctaFallback}
            <Icon name="arrow_forward" size={18} />
          </Link>
        )}
      </div>
    </div>
  );
}