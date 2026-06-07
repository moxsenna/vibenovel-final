import type { Beat } from "@/types";
import { Icon } from "@/components/ui";

const STATUS_CONFIG = {
  done: { label: "Selesai", className: "bg-success-soft text-tertiary-container" },
  draft: { label: "Draft", className: "bg-surface-container text-muted-text" },
  empty: { label: "Kosong", className: "bg-surface-variant text-muted-text" },
} as const;

export interface WriterBeatListProps {
  chapterLabel: string;
  beats: Beat[];
  activeBeatId: string;
  onSelectBeat: (beatId: string) => void;
  title: string;
}

export function WriterBeatList({
  chapterLabel,
  beats,
  activeBeatId,
  onSelectBeat,
  title,
}: WriterBeatListProps) {
  return (
    <aside className="hidden h-full w-[300px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface-soft lg:flex">
      <div className="sticky top-0 z-10 border-b border-border bg-surface-soft/90 p-lg backdrop-blur-md">
        <h2 className="flex items-center justify-between font-headline-md text-headline-md text-on-surface">
          {title}
          <button
            type="button"
            aria-label="Tambah adegan"
            className="rounded-full p-1 text-primary transition-colors hover:bg-primary-soft"
            disabled
          >
            <Icon name="add" size={20} />
          </button>
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-muted-text">{chapterLabel}</p>
      </div>

      <div className="flex flex-col gap-4 p-md">
        {beats.map((beat, index) => {
          const isActive = beat.id === activeBeatId;
          const isLast = index === beats.length - 1;
          const status = STATUS_CONFIG[beat.status];

          return (
            <div key={beat.id} className="relative pl-6 pb-2">
              {!isLast && (
                <div
                  className="absolute bottom-[-16px] left-[7px] top-2 w-[2px] bg-border"
                  aria-hidden="true"
                />
              )}
              <div
                className={[
                  "absolute left-0 top-1 z-10 rounded-full border-2 bg-surface",
                  isActive ? "h-4 w-4 border-primary" : "left-[2px] h-3 w-3 border-0 bg-border",
                ].join(" ")}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => onSelectBeat(beat.id)}
                className={[
                  "w-full rounded-xl p-md text-left shadow-sm transition-all",
                  isActive
                    ? "cursor-pointer border border-primary-soft bg-surface ring-1 ring-primary/20"
                    : "cursor-pointer border border-transparent bg-surface opacity-70 hover:border-border hover:opacity-100",
                ].join(" ")}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span
                    className={[
                      "font-label-sm text-label-sm uppercase tracking-wider",
                      isActive ? "text-primary" : "text-muted-text",
                    ].join(" ")}
                  >
                    Adegan {beat.number}
                  </span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 font-label-sm text-label-sm text-[10px]",
                      status.className,
                    ].join(" ")}
                  >
                    {status.label}
                  </span>
                </div>
                <p
                  className={[
                    "line-clamp-3 font-body-sm text-body-sm",
                    beat.status === "empty" && !isActive
                      ? "italic text-muted-text"
                      : "text-on-surface",
                  ].join(" ")}
                >
                  {beat.title}
                </p>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}