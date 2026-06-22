import type { TimelineEvent } from "@vibenovel/shared";
import { Card, Icon } from "@/components/ui";

export interface OutlineTimelineInspectorProps {
  events: TimelineEvent[];
}

/**
 * Sprint 17 — Advanced Mode continuity timeline (read-only).
 * Shows past/current chapter events materialized at chapter close. Never edits
 * canon and never exposes future planner truth.
 */
export function OutlineTimelineInspector({ events }: OutlineTimelineInspectorProps) {
  if (events.length === 0) return null;

  const ordered = [...events].sort(
    (a, b) => a.relativeOrder - b.relativeOrder || a.chapterNumber - b.chapterNumber,
  );

  return (
    <Card padding="lg" className="rounded-[20px] border-border/50 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon name="timeline" size={18} />
        </span>
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface">Linimasa Cerita</h3>
          <p className="mt-0.5 font-body-sm text-body-sm text-muted-text">
            Kejadian bab yang sudah selesai — hanya untuk pemeriksaan, tidak mengubah cerita.
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {ordered.map((event) => (
          <li
            key={event.id}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface-soft p-4"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-muted-text">
                Bab {event.chapterNumber}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface">{event.event}</p>
            {event.consequences.length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {event.consequences.map((consequence, index) => (
                  <li
                    key={index}
                    className="font-body-sm text-body-sm text-on-surface-variant"
                  >
                    {consequence}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
