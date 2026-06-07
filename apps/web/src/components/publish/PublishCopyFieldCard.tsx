import type { ReactNode } from "react";
import { Card, CopyButton, Icon } from "@/components/ui";

export interface PublishCopyFieldCardProps {
  label: string;
  icon: string;
  value: string;
  children?: ReactNode;
  italic?: boolean;
  accentBorder?: boolean;
  preWrap?: boolean;
}

export function PublishCopyFieldCard({
  label,
  icon,
  value,
  children,
  italic = false,
  accentBorder = false,
  preWrap = false,
}: PublishCopyFieldCardProps) {
  return (
    <Card
      padding="sm"
      className="flex flex-col gap-sm rounded-xl border-border p-4 shadow-sm md:p-lg"
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
          <Icon name={icon} size={18} />
          {label}
        </h3>
        <CopyButton value={value} />
      </div>
      <div
        className={[
          "rounded-lg border border-surface-variant bg-surface-soft p-4",
          accentBorder ? "border-l-4 border-l-warning" : "",
          preWrap ? "whitespace-pre-wrap" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children ?? (
          <p
            className={[
              "m-0 font-body-editor text-body-editor text-on-background",
              italic ? "italic" : "",
            ].join(" ")}
          >
            {value}
          </p>
        )}
      </div>
    </Card>
  );
}