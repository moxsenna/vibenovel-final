export interface SummarySynopsisCardProps {
  synopsis: string;
}

export function SummarySynopsisCard({ synopsis }: SummarySynopsisCardProps) {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-border bg-surface p-6 shadow-sm md:p-xl">
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-[20px] bg-primary"
        aria-hidden="true"
      />
      <h2 className="mb-4 font-headline-md text-headline-md text-on-background">Intisari Bab</h2>
      <p className="font-body-editor text-body-editor leading-relaxed text-on-surface-variant">
        {synopsis}
      </p>
    </section>
  );
}