import { Button, Card, Icon } from "@/components/ui";

export interface SettingsAccountSectionProps {
  title: string;
  displayNameLabel: string;
  emailLabel: string;
  planLabel: string;
  editProfileCta: string;
  displayName: string;
  email: string;
  plan: string;
}

export function SettingsAccountSection({
  title,
  displayNameLabel,
  emailLabel,
  planLabel,
  editProfileCta,
  displayName,
  email,
  plan,
}: SettingsAccountSectionProps) {
  return (
    <Card padding="lg" className="rounded-[20px] border-border/50 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <Icon name="account_box" size={22} className="text-primary-container" />
        <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
      </div>

      <div className="space-y-4">
        <div>
          <span className="mb-1 block font-label-sm text-label-sm text-muted-text">
            {displayNameLabel}
          </span>
          <div className="rounded-lg border border-border bg-background px-4 py-3 font-body-md text-body-md text-on-surface">
            {displayName}
          </div>
        </div>

        <div>
          <span className="mb-1 block font-label-sm text-label-sm text-muted-text">
            {emailLabel}
          </span>
          <div className="rounded-lg border border-border bg-background px-4 py-3 font-body-md text-body-md text-on-surface">
            {email}
          </div>
        </div>

        <div>
          <span className="mb-1 block font-label-sm text-label-sm text-muted-text">
            {planLabel}
          </span>
          <div className="rounded-lg border border-border bg-background px-4 py-3 font-body-md text-body-md text-on-surface">
            {plan}
          </div>
        </div>

        <Button
          variant="ghost"
          disabled
          title="Belum tersedia di Sprint 1 — UI demo saja"
          className="mt-2 w-full rounded-xl opacity-70"
        >
          {editProfileCta}
        </Button>
      </div>
    </Card>
  );
}