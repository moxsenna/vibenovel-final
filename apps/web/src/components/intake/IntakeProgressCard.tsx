import { Link } from "react-router-dom";
import type { IntakeProgressItem } from "@/types";
import { Icon } from "@/components/ui";

export interface IntakeProgressCardProps {
  progress: IntakeProgressItem[];
  progressPercent: number;
  ctaLabel: string;
  ctaHint: string;
  conceptsRoute: string;
}

function ProgressIcon({ status }: { status: IntakeProgressItem["status"] }) {
  if (status === "done") {
    return (
      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-tertiary-fixed-dim bg-success-soft">
        <Icon name="check" size={14} filled className="text-tertiary-container" />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary bg-surface">
        <div className="h-2 w-2 rounded-full bg-primary" />
      </div>
    );
  }
  return (
    <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full border border-outline-variant bg-surface" />
  );
}

export function IntakeProgressCard({
  progress,
  progressPercent,
  ctaLabel,
  ctaHint,
  conceptsRoute,
}: IntakeProgressCardProps) {
  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-headline-md text-headline-md text-on-background">Progres Fondasi</h3>
        <span className="rounded-md bg-primary-soft px-2 py-1 font-label-md text-label-md text-primary">
          {progressPercent}%
        </span>
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="absolute bottom-4 left-[11px] top-4 z-0 w-[2px] bg-surface-variant" />
        {progress.map((item) => (
          <div
            key={item.id}
            className={`group relative z-10 flex gap-3 ${item.status === "pending" ? "opacity-50" : ""}`}
          >
            <ProgressIcon status={item.status} />
            <div>
              <h4
                className={[
                  "font-label-md text-label-md transition-colors",
                  item.status === "active"
                    ? "font-bold text-primary"
                    : item.status === "done"
                      ? "text-on-background group-hover:text-primary"
                      : "text-on-surface-variant",
                ].join(" ")}
              >
                {item.label}
              </h4>
              {item.detail && (
                <p className="line-clamp-1 font-body-sm text-body-sm text-muted-text">
                  {item.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <Link
          to={conceptsRoute}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-label-md text-label-md text-on-primary shadow-[0_4px_14px_rgba(130,56,80,0.25)] transition-all hover:bg-primary-dark min-h-[44px]"
        >
          {ctaLabel}
          <Icon name="arrow_forward" size={18} />
        </Link>
        <p className="mt-3 text-center font-label-sm text-label-sm text-muted-text">{ctaHint}</p>
      </div>
    </div>
  );
}