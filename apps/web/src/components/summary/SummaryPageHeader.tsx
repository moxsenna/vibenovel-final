import { Badge, Icon } from "@/components/ui";

export interface SummaryPageHeaderProps {
  badgeLabel: string;
  title: string;
  subtitle: string;
  chapterLabel: string;
  statusLabel: string;
}

export function SummaryPageHeader({
  badgeLabel,
  title,
  subtitle,
  chapterLabel,
  statusLabel,
}: SummaryPageHeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-md md:flex-row md:items-center">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Icon name="auto_awesome" size={20} filled className="text-primary" />
          <span className="font-label-md text-label-md uppercase tracking-widest text-primary">
            {badgeLabel}
          </span>
        </div>
        <h1 className="font-display text-display text-on-background">{title}</h1>
        <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="neutral"
          className="rounded-full border-border bg-surface-variant px-4 py-2 text-on-surface-variant"
        >
          {chapterLabel}
        </Badge>
        <Badge variant="primary" className="rounded-full px-3 py-1">
          {statusLabel}
        </Badge>
      </div>
    </header>
  );
}