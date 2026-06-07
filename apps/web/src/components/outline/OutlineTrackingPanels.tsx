import type { UiOpenLoop, UiPlannedReveal } from "@/lib/api-mappers";
import { Card, Icon } from "@/components/ui";

export interface OutlineTrackingPanelsProps {
  openLoops: UiOpenLoop[];
  reveals: UiPlannedReveal[];
}

export function OutlineTrackingPanels({ openLoops, reveals }: OutlineTrackingPanelsProps) {
  if (openLoops.length === 0 && reveals.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {openLoops.length > 0 && (
        <Card padding="sm" className="rounded-xl border-border shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-headline-md text-headline-md text-on-background">
            <Icon name="all_inclusive" size={22} className="text-primary" />
            Yang Masih Menggantung
          </h3>
          <ul className="space-y-3">
            {openLoops.map((loop) => (
              <li key={loop.id} className="rounded-lg border border-outline-variant bg-surface-bright p-3">
                <p className="font-body-md text-body-md text-on-background">{loop.question}</p>
                {loop.hint && (
                  <p className="mt-1 font-body-sm text-body-sm text-muted-text">{loop.hint}</p>
                )}
                <span className="mt-2 inline-block font-label-sm text-label-sm text-primary">
                  {loop.statusLabel}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reveals.length > 0 && (
        <Card padding="sm" className="rounded-xl border-border shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-headline-md text-headline-md text-on-background">
            <Icon name="schedule" size={22} className="text-secondary" />
            Jadwal Rahasia
          </h3>
          <p className="mb-3 font-body-sm text-body-sm text-muted-text">
            Petunjuk aman untuk perencanaan — kebenaran internal tidak ditampilkan.
          </p>
          <ul className="space-y-3">
            {reveals.map((reveal) => (
              <li key={reveal.id} className="rounded-lg border border-outline-variant bg-surface-bright p-3">
                <p className="font-body-md text-body-md font-medium text-on-background">{reveal.title}</p>
                {reveal.hint && (
                  <p className="mt-1 font-body-sm text-body-sm text-muted-text">{reveal.hint}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 font-label-sm text-label-sm text-subtle-text">
                  {reveal.plannedChapterNumber !== null && (
                    <span>Target Bab {reveal.plannedChapterNumber}</span>
                  )}
                  <span>Risiko {reveal.riskLabel}</span>
                  <span>{reveal.statusLabel}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}