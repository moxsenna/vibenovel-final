import type { SummaryListItem } from "@/types";
import { Icon } from "@/components/ui";

export interface SummaryBulletListProps {
  items: SummaryListItem[];
  icon?: string;
}

export function SummaryBulletList({ items, icon = "check_circle" }: SummaryBulletListProps) {
  return (
    <ul className="flex flex-col gap-4 font-body-sm text-body-sm text-on-surface-variant">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-outline-variant" />
          <span>
            {item.emphasis && <strong>{item.emphasis}: </strong>}
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}