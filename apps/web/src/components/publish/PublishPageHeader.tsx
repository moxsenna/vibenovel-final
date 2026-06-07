import { Icon } from "@/components/ui";

export interface PublishPageHeaderProps {
  badgeLabel: string;
  title: string;
  subtitle: string;
}

export function PublishPageHeader({ badgeLabel, title, subtitle }: PublishPageHeaderProps) {
  return (
    <header className="mb-4">
      <div className="mb-2 flex items-center gap-2 text-primary">
        <Icon name="check_circle" size={20} filled />
        <span className="font-label-sm text-label-sm uppercase tracking-widest">{badgeLabel}</span>
      </div>
      <h2 className="mb-2 font-display text-display text-on-background">{title}</h2>
      <p className="font-body-lg text-body-lg text-muted-text">{subtitle}</p>
    </header>
  );
}