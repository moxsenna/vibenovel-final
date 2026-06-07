import { useState } from "react";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import {
  OutlineChapterCard,
  OutlineChapterEditor,
  OutlineLoadMoreButton,
  OutlinePageHeader,
  OutlineProgressCard,
  OutlineRetentionHint,
  OutlineTrackingPanels,
  OutlineWorkflowActions,
} from "@/components/outline";
import { Badge } from "@/components/ui";
import { useOutlineData } from "@/hooks/useOutlineData";

/**
 * Outline Cerita — Sprint 1 Task 1.10 (+ Sprint 4 Task 4.6 API integration)
 * Source: stitch-reference/outline_cerita_natural_terms
 * Wrapped by AppShell via router layout.
 */
export function OutlinePage() {
  const {
    outline,
    openLoops,
    reveals,
    notice,
    workflowNotice,
    loading,
    generating,
    approving,
    locking,
    savingChapterId,
    apiMode,
    hasApiOutline,
    needsGenerate,
    isLocked,
    getChapterDraft,
    updateChapterDraft,
    generateOutlinePlan,
    approveOutlinePlan,
    lockOutlinePlan,
    saveChapterEdits,
  } = useOutlineData();

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

      <IntegrationNotice message={notice} />
      <IntegrationNotice
        message={workflowNotice}
        className={
          isLocked ? "border-success-soft bg-success-soft text-on-surface" : undefined
        }
      />

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat outline cerita...
        </p>
      ) : null}

      {isLocked && (
        <Badge variant="primary" className="w-fit rounded-full px-3 py-1">
          Outline Terkunci
        </Badge>
      )}

      <OutlineWorkflowActions
        needsGenerate={needsGenerate}
        hasApiOutline={hasApiOutline}
        isLocked={isLocked}
        generating={generating}
        approving={approving}
        locking={locking}
        apiMode={apiMode}
        onGenerate={generateOutlinePlan}
        onApprove={approveOutlinePlan}
        onLock={lockOutlinePlan}
      />

      <OutlineProgressCard
        progress={outline.progress}
        arcSummary={outline.arcSummary}
        reviewNote={pageCopy.reviewNote}
      />

      {(hasApiOutline || !apiMode) && (
        <OutlineTrackingPanels openLoops={openLoops} reveals={reveals} />
      )}

      <OutlineRetentionHint
        title={pageCopy.retentionTitle}
        subtitle={pageCopy.retentionSubtitle}
        hints={outline.retentionHints}
      />

      <div className="flex flex-col gap-4">
        {outline.chapters.map((chapter) => {
          const isExpanded = expandedId === chapter.id;
          const draft = apiMode && hasApiOutline ? getChapterDraft(chapter.id) : null;

          return (
            <OutlineChapterCard
              key={chapter.id}
              chapter={chapter}
              isExpanded={isExpanded}
              isFirst={chapter.number === 1}
              onToggle={() =>
                setExpandedId((current) => (current === chapter.id ? "" : chapter.id))
              }
              expandedFooter={
                draft && isExpanded ? (
                  <OutlineChapterEditor
                    draft={draft}
                    disabled={isLocked}
                    saving={savingChapterId === chapter.id}
                    onChange={(field, value) => updateChapterDraft(chapter.id, field, value)}
                    onSave={() => saveChapterEdits(chapter.id)}
                  />
                ) : undefined
              }
            />
          );
        })}

        {!needsGenerate && (
          <OutlineLoadMoreButton
            label={pageCopy.loadMoreCta}
            hint={pageCopy.loadMoreHint}
          />
        )}
      </div>
    </div>
  );
}