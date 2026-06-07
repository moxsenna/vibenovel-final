import { Icon } from "@/components/ui";
import { DASHBOARD_GREETING, type DashboardUsageSummary } from "@/mocks/dashboard";

export interface DashboardGreetingProps {
  usage: DashboardUsageSummary;
}

export function DashboardGreeting({ usage }: DashboardGreetingProps) {
  const usagePercent =
    usage.total > 0 ? Math.round((usage.used / usage.total) * 100) : 0;

  return (
    <div className="flex flex-col items-start justify-between gap-md md:flex-row md:items-center">
      <div>
        <h2 className="mb-unit font-display text-display text-on-surface">
          {DASHBOARD_GREETING.title}
        </h2>
        <p className="font-body-md text-body-md text-muted-text">
          {DASHBOARD_GREETING.subtitle}
        </p>
      </div>

      <div className="flex w-full shrink-0 items-center gap-md rounded-xl border border-border bg-surface p-md shadow-sm md:max-w-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="electric_bolt" size={24} filled />
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant">
              {usage.label}
            </span>
            <span className="font-label-sm text-label-sm text-muted-text">
              {usage.used} / {usage.total}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-variant">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}