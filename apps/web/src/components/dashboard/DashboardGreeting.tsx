import { Icon } from "@/components/ui";
import { DASHBOARD_GREETING, mockDashboardUsage } from "@/mocks/dashboard";

export function DashboardGreeting() {
  const usagePercent = Math.round(
    (mockDashboardUsage.used / mockDashboardUsage.total) * 100,
  );

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
              {mockDashboardUsage.label}
            </span>
            <span className="font-label-sm text-label-sm text-muted-text">
              {mockDashboardUsage.used} / {mockDashboardUsage.total}
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