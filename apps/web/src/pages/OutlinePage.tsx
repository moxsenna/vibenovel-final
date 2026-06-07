import { useState } from "react";
import {
  OutlineChapterCard,
  OutlineLoadMoreButton,
  OutlinePageHeader,
  OutlineProgressCard,
  OutlineRetentionHint,
} from "@/components/outline";
import { mockOutline } from "@/mocks/outline";

/**
 * Outline Cerita — Sprint 1 Task 1.10
 * Source: stitch-reference/outline_cerita_natural_terms
 * Content: Istri yang Mereka Buang
 * Wrapped by AppShell via router layout.
 */
export function OutlinePage() {
  const outline = mockOutline;
  const { pageCopy } = outline;
  const [expandedId, setExpandedId] = useState(outline.chapters[0]?.id ?? "");

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-lg">
      <OutlinePageHeader
        planBadge={pageCopy.planBadge}
        title={outline.seasonLabel}
        description={outline.description}
        startWritingCta={pageCopy.startWritingCta}
        writeRoute={outline.writeRoute}
      />

      <OutlineProgressCard
        progress={outline.progress}
        arcSummary={outline.arcSummary}
        reviewNote={pageCopy.reviewNote}
      />

      <OutlineRetentionHint
        title={pageCopy.retentionTitle}
        subtitle={pageCopy.retentionSubtitle}
        hints={outline.retentionHints}
      />

      <div className="flex flex-col gap-4">
        {outline.chapters.map((chapter) => (
          <OutlineChapterCard
            key={chapter.id}
            chapter={chapter}
            isExpanded={expandedId === chapter.id}
            isFirst={chapter.number === 1}
            onToggle={() =>
              setExpandedId((current) => (current === chapter.id ? "" : chapter.id))
            }
          />
        ))}

        <OutlineLoadMoreButton
          label={pageCopy.loadMoreCta}
          hint={pageCopy.loadMoreHint}
        />
      </div>
    </div>
  );
}