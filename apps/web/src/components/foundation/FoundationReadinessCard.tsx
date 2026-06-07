import { Card, Icon } from "@/components/ui";

export interface FoundationReadiness {
  percent: number;
  title: string;
  statusLabel: string;
  hint: string;
  missingItems: string[];
}

export interface FoundationReadinessCardProps {
  readiness: FoundationReadiness;
}

export function FoundationReadinessCard({ readiness }: FoundationReadinessCardProps) {
  return (
    <Card
      padding="lg"
      className="rounded-[20px] border-border/50 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-tertiary">
            <Icon name="fact_check" size={22} filled />
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">
              {readiness.title}
            </h3>
            <p className="font-body-sm text-body-sm text-muted-text">{readiness.hint}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-display text-display text-primary">{readiness.percent}%</p>
          <p className="font-label-sm text-label-sm text-muted-text">{readiness.statusLabel}</p>
        </div>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-primary-soft"
        role="progressbar"
        aria-valuenow={readiness.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={readiness.title}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${readiness.percent}%` }}
        />
      </div>

      {readiness.missingItems.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {readiness.missingItems.map((item) => (
            <li
              key={item}
              className="rounded-full border border-border bg-surface-soft px-3 py-1 font-label-sm text-label-sm text-on-surface-variant"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}