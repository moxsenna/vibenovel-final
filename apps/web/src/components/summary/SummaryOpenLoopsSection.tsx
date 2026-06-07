import type { SummaryListItem } from "@/types";
import { Icon } from "@/components/ui";

export interface SummaryOpenLoopsSectionProps {
  openLoops: SummaryListItem[];
}

export function SummaryOpenLoopsSection({ openLoops }: SummaryOpenLoopsSectionProps) {
  return (
    <div className="rounded-xl border border-warning/10 bg-warning-soft/30 p-md">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="help" size={18} className="text-warning" />
        <h4 className="font-label-md text-label-md text-on-background">Yang Masih Menggantung</h4>
      </div>
      <ul className="flex list-disc flex-col gap-2 pl-6 font-body-sm text-body-sm text-on-surface-variant marker:text-warning/50">
        {openLoops.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </div>
  );
}