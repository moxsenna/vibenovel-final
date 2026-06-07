export interface FoundationPageHeaderProps {
  title: string;
  subtitle: string;
}

export function FoundationPageHeader({ title, subtitle }: FoundationPageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <h2 className="font-display text-display text-on-background">{title}</h2>
      <p className="font-body-lg text-body-lg text-muted-text">{subtitle}</p>
    </header>
  );
}