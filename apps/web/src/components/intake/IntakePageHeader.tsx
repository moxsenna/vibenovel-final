export interface IntakePageHeaderProps {
  title: string;
}

/** In-page title — Stitch shows this on desktop inside workspace */
export function IntakePageHeader({ title }: IntakePageHeaderProps) {
  return (
    <div className="mb-md hidden md:block">
      <h2 className="font-headline-md text-headline-md text-on-background">{title}</h2>
    </div>
  );
}