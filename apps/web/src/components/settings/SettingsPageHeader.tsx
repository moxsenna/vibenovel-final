export interface SettingsPageHeaderProps {
  title: string;
  subtitle: string;
}

export function SettingsPageHeader({ title, subtitle }: SettingsPageHeaderProps) {
  return (
    <header className="mb-2">
      <h2 className="mb-2 font-display text-display text-on-background">{title}</h2>
      <p className="font-body-md text-body-md text-muted-text">{subtitle}</p>
    </header>
  );
}