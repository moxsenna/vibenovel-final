import type { ReactNode } from "react";
import { Card, Icon } from "@/components/ui";

export interface FoundationSectionCardProps {
  title: string;
  icon: string;
  iconFilled?: boolean;
  children: ReactNode;
  className?: string;
  showEdit?: boolean;
}

export function FoundationSectionCard({
  title,
  icon,
  iconFilled = true,
  children,
  className = "",
  showEdit = true,
}: FoundationSectionCardProps) {
  return (
    <Card
      padding="sm"
      className={[
        "group relative overflow-hidden rounded-[20px] border-border p-4 shadow-sm transition-shadow hover:shadow-md md:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name={icon} size={22} filled={iconFilled} />
          </div>
          <h3 className="font-headline-md text-headline-md text-on-background">{title}</h3>
        </div>
        {showEdit && (
          <button
            type="button"
            aria-label={`Edit ${title}`}
            className="p-1 text-subtle-text transition-colors hover:text-primary"
            disabled
          >
            <Icon name="edit" size={20} />
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}