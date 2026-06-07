import type { OutlineProgress } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface OutlineProgressCardProps {
  progress: OutlineProgress;
  arcSummary: string;
  reviewNote: string;
}

export function OutlineProgressCard({
  progress,
  arcSummary,
  reviewNote,
}: OutlineProgressCardProps) {
  const percent = Math.round((progress.readyCount / progress.totalCount) * 100);

  return (
    <Card padding="sm" className="rounded-xl border-border shadow-sm md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name="route" size={22} filled />
          </div>
          <div className="flex-1">
            <h3 className="font-headline-md text-headline-md text-on-background">
              Ringkasan Arc 10 Bab Pertama
            </h3>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{arcSummary}</p>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface-bright p-4">
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="font-label-md text-label-md text-on-background">
              {progress.statusLabel}
            </span>
            <span className="font-label-sm text-label-sm text-muted-text">
              {progress.readyCount}/{progress.totalCount} bab
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-container"
            role="progressbar"
            aria-valuenow={progress.readyCount}
            aria-valuemin={0}
            aria-valuemax={progress.totalCount}
            aria-label={progress.statusLabel}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 font-body-sm text-body-sm text-muted-text">
            {progress.statusDescription}
          </p>
          <p className="mt-1 font-body-sm text-body-sm text-subtle-text italic">{reviewNote}</p>
        </div>
      </div>
    </Card>
  );
}