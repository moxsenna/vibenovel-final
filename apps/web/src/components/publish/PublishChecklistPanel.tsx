import type { PublishChecklistItem } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface PublishChecklistPanelProps {
  title: string;
  items: PublishChecklistItem[];
  interactive?: boolean;
  saving?: boolean;
  onToggle?: (itemId: string) => void;
}

export function PublishChecklistPanel({
  title,
  items,
  interactive = false,
  saving = false,
  onToggle,
}: PublishChecklistPanelProps) {
  return (
    <Card padding="sm" className="rounded-xl border-border p-4 shadow-sm md:p-lg">
      <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md text-on-background">
        <Icon name="checklist" size={22} className="text-primary" />
        {title}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const content = (
            <>
              <Icon
                name={item.checked ? "check_circle" : "radio_button_unchecked"}
                size={20}
                className={item.checked ? "text-tertiary" : "text-muted-text"}
                filled={item.checked}
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">{item.label}</span>
            </>
          );

          if (interactive && onToggle) {
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-md text-left transition-colors hover:bg-surface-soft disabled:opacity-60"
                  disabled={saving}
                  onClick={() => onToggle(item.id)}
                >
                  {content}
                </button>
              </li>
            );
          }

          return (
            <li key={item.id} className="flex items-start gap-3">
              {content}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}