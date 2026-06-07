import { useId } from "react";
import type { OutlineChapter } from "@/types";
import { Card, Icon } from "@/components/ui";
import { OutlineChapterBadge } from "./OutlineChapterBadge";

export interface OutlineChapterCardProps {
  chapter: OutlineChapter;
  isExpanded: boolean;
  isFirst: boolean;
  onToggle: () => void;
}

export function OutlineChapterCard({
  chapter,
  isExpanded,
  isFirst,
  onToggle,
}: OutlineChapterCardProps) {
  const panelId = useId();

  return (
    <Card
      padding="sm"
      shadow={false}
      className="overflow-hidden rounded-xl border-border shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary-soft"
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start justify-between p-4 text-left outline-none transition-colors hover:bg-surface-soft md:items-center md:p-6"
      >
        <div className="flex items-start gap-4 md:items-center">
          <div
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border font-headline-md text-headline-md",
              isFirst
                ? "border-primary-fixed bg-primary-soft text-primary"
                : "border-border bg-surface-container text-outline",
            ].join(" ")}
          >
            {chapter.number}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <h3 className="font-headline-md text-headline-md text-on-background">
              Bab {chapter.number}: {chapter.title}
            </h3>
            {chapter.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chapter.badges.map((badge) => (
                  <OutlineChapterBadge key={`${chapter.id}-${badge.type}`} badge={badge} />
                ))}
              </div>
            )}
          </div>
        </div>
        <Icon
          name="expand_more"
          size={24}
          className={[
            "mt-2 shrink-0 text-outline transition-transform duration-300 md:mt-0",
            isExpanded ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      <div
        id={panelId}
        className={[
          "grid border-t border-border bg-surface-bright transition-all duration-300",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 md:p-6">
            <Card
              padding="sm"
              className="rounded-lg border-outline-variant shadow-sm"
            >
              <h4 className="mb-2 flex items-center gap-2 font-label-md text-label-md text-secondary">
                <Icon name="flag" size={18} />
                Fungsi Bab
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant">{chapter.goal}</p>
            </Card>

            <Card
              padding="sm"
              className="rounded-lg border-outline-variant shadow-sm"
            >
              <h4 className="mb-2 flex items-center gap-2 font-label-md text-label-md text-tertiary-container">
                <Icon name="favorite" size={18} />
                Arah Emosi
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {chapter.emotionalGoal}
              </p>
            </Card>

            <Card
              padding="sm"
              shadow={false}
              className="rounded-lg border border-border bg-surface-soft md:col-span-2"
            >
              <h4 className="mb-2 flex items-center gap-2 font-label-md text-label-md text-on-background">
                <Icon name="subject" size={18} />
                Ringkasan
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant">{chapter.summary}</p>
            </Card>

            <Card
              padding="sm"
              shadow={false}
              className="flex items-start gap-4 rounded-lg border border-warning/30 bg-warning-soft md:col-span-2"
            >
              <Icon name="front_hand" size={24} className="mt-1 text-warning" />
              <div>
                <h4 className="mb-1 font-label-md text-label-md text-warning">Hook</h4>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {chapter.endingHook}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Card>
  );
}