import type { ReactNode } from "react";
import { Card, Icon } from "@/components/ui";

export interface SummarySectionCardProps {
  title: string;
  icon: string;
  iconFilled?: boolean;
  iconClassName?: string;
  children: ReactNode;
  className?: string;
}

export function SummarySectionCard({
  title,
  icon,
  iconFilled = false,
  iconClassName = "text-primary",
  children,
  className = "",
}: SummarySectionCardProps) {
  return (
    <Card
      padding="sm"
      className={[
        "flex flex-col rounded-[20px] border-border p-6 shadow-sm md:p-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-6 flex items-center gap-3 border-b border-border/50 pb-4">
        <Icon name={icon} size={24} filled={iconFilled} className={iconClassName} />
        <h3 className="font-headline-md text-headline-md text-on-background">{title}</h3>
      </div>
      {children}
    </Card>
  );
}