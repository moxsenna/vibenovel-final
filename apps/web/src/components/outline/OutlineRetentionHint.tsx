import type { OutlineRetentionHint as OutlineRetentionHintType } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface OutlineRetentionHintProps {
  title: string;
  subtitle: string;
  hints: OutlineRetentionHintType[];
}

const toneClasses: Record<OutlineRetentionHintType["tone"], string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-secondary",
  success: "bg-success-soft text-tertiary",
  warning: "bg-warning-soft text-warning",
};

export function OutlineRetentionHint({ title, subtitle, hints }: OutlineRetentionHintProps) {
  return (
    <Card padding="lg" className="rounded-[20px] border-border/50 shadow-sm">
      <div className="mb-4">
        <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
        <p className="mt-1 font-body-sm text-body-sm text-muted-text">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {hints.map((hint) => (
          <div
            key={hint.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface-soft p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  toneClasses[hint.tone],
                ].join(" ")}
              >
                <Icon name={hint.icon} size={18} />
              </span>
              <span className="font-label-md text-label-md text-on-surface">{hint.label}</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{hint.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}