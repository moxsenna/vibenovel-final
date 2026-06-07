import { Link } from "react-router-dom";
import { Badge, Icon } from "@/components/ui";
import type { DashboardActiveProject, DashboardProgressStep } from "@/mocks/dashboard";

export interface ActiveProjectCardProps {
  project: DashboardActiveProject;
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

export function ActiveProjectCard({ project }: ActiveProjectCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] border border-border bg-surface p-lg shadow-sm lg:col-span-2">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-soft opacity-50 blur-3xl transition-transform duration-700 group-hover:scale-110" />

      <div className="relative z-10 mb-xl flex items-start justify-between">
        <Badge variant="success" icon={<Icon name="edit" size={14} />}>
          {project.statusBadge}
        </Badge>
        <button
          type="button"
          aria-label="Opsi proyek"
          className="text-on-surface-variant transition-colors hover:text-primary"
        >
          <Icon name="more_vert" size={24} />
        </button>
      </div>

      <div className="relative z-10 flex-1">
        <p className="mb-2 font-label-md text-label-md uppercase tracking-wider text-primary">
          Lanjut Tulis Bab
        </p>
        <h3 className="mb-xs font-headline-lg text-headline-lg text-on-surface">
          {project.title}
        </h3>
        <p className="mb-lg font-body-md text-body-md text-muted-text">{project.subtitle}</p>

        <div className="mb-lg flex flex-wrap items-center gap-4 text-muted-text">
          <span className="flex items-center gap-1 font-label-sm text-label-sm">
            <Icon name="menu_book" size={16} />
            {project.genre}
          </span>
          <span aria-hidden="true">•</span>
          <span className="flex items-center gap-1 font-label-sm text-label-sm">
            <Icon name="schedule" size={16} />
            {project.lastEditedLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {project.progressSteps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 ${step.status === "pending" ? "opacity-50" : ""}`}
            >
              <ProgressStepIcon status={step.status} />
              <span
                className={[
                  "font-body-sm text-body-sm",
                  step.status === "current"
                    ? "font-medium text-primary"
                    : step.status === "done"
                      ? "text-on-surface-variant"
                      : "text-muted-text",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-auto flex justify-end">
        <Link
          to={project.writeRoute}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-label-md text-label-md text-on-primary shadow-md transition-colors hover:bg-primary-dark min-h-[44px]"
        >
          Lanjut Tulis Bab {project.currentChapter}
          <Icon name="arrow_forward" size={18} />
        </Link>
      </div>
    </div>
  );
}