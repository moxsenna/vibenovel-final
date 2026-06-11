import type { MonthlyUsage } from "@/types";
import { Button, Card, Icon } from "@/components/ui";

export interface SettingsUsageSectionProps {
  title: string;
  usedLabel: string;
  upgradeCta: string;
  usage: MonthlyUsage;
  costEstimates?: Array<{ label: string; cost: number }>;
  costEstimateTitle?: string;
  className?: string;
}

export function SettingsUsageSection({
  title,
  usedLabel,
  upgradeCta,
  usage,
  costEstimates = [],
  costEstimateTitle = "Perkiraan biaya aksi",
  className = "",
}: SettingsUsageSectionProps) {
  return (
    <Card
      padding="lg"
      className={[
        "flex h-full flex-col rounded-[20px] border-border/50 shadow-sm md:p-8",
        className,
      ].join(" ")}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name="electric_bolt" size={24} filled />
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
            <p className="font-body-sm text-body-sm text-muted-text">{usage.resetLabel}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-display text-display text-primary">
            {usage.used.toLocaleString("id-ID")}
            <span className="font-headline-md text-headline-md text-muted-text">
              /{usage.quota.toLocaleString("id-ID")}
            </span>
          </p>
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-muted-text">
            {usedLabel}
          </p>
        </div>
      </div>

      <div
        className="mb-2 h-3 w-full overflow-hidden rounded-full bg-primary-soft"
        role="progressbar"
        aria-valuenow={usage.percentUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${usage.percentUsed}%` }}
        />
      </div>

      {costEstimates.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-surface-soft p-4">
          <p className="mb-3 font-label-sm text-label-sm uppercase tracking-wider text-muted-text">
            {costEstimateTitle}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {costEstimates.map((item) => (
              <div key={item.label} className="rounded-lg bg-surface px-3 py-2">
                <p className="font-label-sm text-label-sm text-on-surface">
                  {item.label}: {item.cost} kredit
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="info" size={16} className="text-warning" />
          {usage.infoMessage}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="Belum tersedia di Sprint 1 — UI demo saja"
          className="shrink-0 self-start border-0 font-semibold text-primary opacity-70 sm:self-auto"
        >
          {upgradeCta}
        </Button>
      </div>
    </Card>
  );
}
