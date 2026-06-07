import type { SummaryListItem } from "@/types";
import { Icon } from "@/components/ui";

export interface SummaryMiniVictoryBannerProps {
  items: SummaryListItem[];
}

export function SummaryMiniVictoryBanner({ items }: SummaryMiniVictoryBannerProps) {
  return (
    <section className="flex items-start gap-4 rounded-[20px] border border-tertiary-fixed-dim bg-success-soft p-6 md:p-lg">
      <div className="mt-1 flex shrink-0 rounded-full bg-tertiary-container p-2">
        <Icon name="emoji_events" size={24} filled className="text-on-tertiary-container" />
      </div>
      <div>
        <h3 className="mb-2 font-headline-md text-headline-md text-on-tertiary-fixed-variant">
          Kemenangan Kecil
        </h3>
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="font-body-md text-body-md text-on-tertiary-fixed-variant opacity-90"
            >
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}