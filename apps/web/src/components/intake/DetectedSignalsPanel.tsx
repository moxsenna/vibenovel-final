import type { DetectedSignal } from "@/types";
import { Icon } from "@/components/ui";

export interface DetectedSignalsPanelProps {
  signals: DetectedSignal[];
}

export function DetectedSignalsPanel({ signals }: DetectedSignalsPanelProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-soft opacity-50 blur-3xl" />

      <div className="relative z-10 mb-4 flex items-center gap-2">
        <Icon name="radar" size={20} className="text-primary" />
        <h3 className="font-label-md text-label-md font-bold uppercase tracking-wider text-on-background">
          Sinyal Terdeteksi
        </h3>
        <span className="relative ml-auto flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
      </div>

      <div className="relative z-10 flex flex-wrap gap-2">
        {signals.map((signal) => (
          <span
            key={signal.id}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label-sm text-label-sm",
              signal.pending
                ? "border border-dashed border-border bg-background text-muted-text"
                : "border border-primary-fixed-dim bg-surface-soft text-primary-dark",
            ].join(" ")}
          >
            <Icon name={signal.icon} size={14} />
            {signal.label}
          </span>
        ))}
      </div>
    </div>
  );
}