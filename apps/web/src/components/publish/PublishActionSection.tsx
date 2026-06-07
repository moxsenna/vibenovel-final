import { Link } from "react-router-dom";
import { Button, Icon } from "@/components/ui";

export interface PublishActionSectionProps {
  dashboardCta: string;
  summaryCta: string;
  nextChapterCta: string;
  nextChapterHint: string;
  dashboardRoute: string;
  summaryRoute: string;
  outlineRoute: string;
  /** Sidebar column layout on desktop publish page */
  compact?: boolean;
}

export function PublishActionSection({
  dashboardCta,
  summaryCta,
  nextChapterCta,
  nextChapterHint,
  dashboardRoute,
  summaryRoute,
  outlineRoute,
  compact = false,
}: PublishActionSectionProps) {
  return (
    <div
      className={[
        "flex flex-col gap-4",
        compact ? "rounded-[20px] border border-border bg-surface p-lg shadow-sm" : "mt-md border-t border-border pt-lg",
      ].join(" ")}
    >
      <div
        className={[
          "flex flex-col gap-3",
          compact ? "" : "sm:flex-row sm:flex-wrap sm:justify-end",
        ].join(" ")}
      >
        <Link to={summaryRoute} className="w-full sm:w-auto">
          <Button
            variant="ghost"
            className="h-12 w-full justify-center rounded-xl border border-border text-on-surface-variant sm:w-auto"
          >
            {summaryCta}
          </Button>
        </Link>
        <Link to={outlineRoute} className="w-full sm:w-auto">
          <Button
            variant="ghost"
            className="h-12 w-full justify-center rounded-full border border-primary-soft text-primary sm:w-auto"
            rightIcon={<Icon name="arrow_forward" size={18} />}
          >
            {nextChapterCta}
          </Button>
        </Link>
        <Link to={dashboardRoute} className="w-full sm:w-auto">
          <Button
            variant="primary"
            pill
            className="h-12 w-full justify-center px-8 shadow-md sm:w-auto"
            rightIcon={<Icon name="dashboard" size={18} />}
          >
            {dashboardCta}
          </Button>
        </Link>
      </div>
      <p
        className={[
          "font-body-sm text-body-sm text-muted-text",
          compact ? "text-left" : "text-center sm:text-right",
        ].join(" ")}
      >
        {nextChapterHint}
      </p>
    </div>
  );
}