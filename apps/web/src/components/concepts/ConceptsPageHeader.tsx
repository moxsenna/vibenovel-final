export interface ConceptsPageHeaderProps {
  title: string;
  subtitle: string;
}

export function ConceptsPageHeader({ title, subtitle }: ConceptsPageHeaderProps) {
  return (
    <header className="mb-8 text-center md:mb-12 md:text-left">
      <h2 className="mb-3 font-display text-display text-on-background">{title}</h2>
      <p className="max-w-2xl font-body-lg text-body-lg text-muted-text">{subtitle}</p>
    </header>
  );
}