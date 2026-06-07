import type { PublishChecklistItem } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface PublishChecklistCardProps {
  title: string;
  items: PublishChecklistItem[];
}

export function PublishChecklistCard({ title, items }: PublishChecklistCardProps) {
  return (
    <Card padding="sm" className="rounded-xl border-border p-4 shadow-sm md:p-lg">
      <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md text-on-background">
        <Icon name="checklist" size={22} className="text-primary" />
        {title}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <Icon
              name={item.checked ? "check_circle" : "radio_button_unchecked"}
              size={20}
              className={item.checked ? "text-tertiary" : "text-muted-text"}
              filled={item.checked}
            />
            <span className="font-body-sm text-body-sm text-on-surface-variant">{item.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}