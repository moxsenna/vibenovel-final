import { Card, Icon } from "@/components/ui";

export interface SettingsCreditCardProps {
  title: string;
  subtitle: string;
  creditsRemaining: number;
  balanceLabel: string;
}

export function SettingsCreditCard({
  title,
  subtitle,
  creditsRemaining,
  balanceLabel,
}: SettingsCreditCardProps) {
  return (
    <Card
      padding="lg"
      className="rounded-[20px] border-border/50 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-secondary">
            <Icon name="account_balance_wallet" size={24} filled />
          </div>
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
            <p className="font-body-sm text-body-sm text-muted-text">{subtitle}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-display text-display text-primary">
            {creditsRemaining.toLocaleString("id-ID")}
          </p>
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-muted-text">
            {balanceLabel}
          </p>
        </div>
      </div>
    </Card>
  );
}