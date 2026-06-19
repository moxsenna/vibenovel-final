import { Fragment, useState } from "react";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import {
  OutlineAdvancedControls,
  OutlineChapterCard,
  OutlineChapterEditor,
  OutlineLoadMoreButton,
  OutlinePageHeader,
  OutlineProgressCard,
  OutlineRetentionHint,
  OutlineTimelineInspector,
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
    creatorMode,
    advancedControls,
    miniArcs,
    timelineEvents,
    updateAdvancedControl,
    getChapterDraft,
    updateChapterDraft,
    generateOutlinePlan,
    approveOutlinePlan,
    lockOutlinePlan,
    saveChapterEdits,
    creditCostLabel,
    creditLoading,
    creditError,
    creditInsufficient,
  } = useOutlineData();

  const { pageCopy } = outline;
  const [expandedId, setExpandedId] = useState(outline.chapters[0]?.id ?? "");

  /** Sprint 17 — find the mini-arc a chapter number belongs to (range lookup). */
  const arcForChapter = (chapterNumber: number) =>
    miniArcs.find(
      (arc) => chapterNumber >= arc.startChapter && chapterNumber <= arc.endChapter,
    ) ?? null;

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
        creditCostLabel={creditCostLabel}
        creditLoading={creditLoading}
        creditError={creditError}
        creditInsufficient={creditInsufficient}
        onGenerate={generateOutlinePlan}
        onApprove={approveOutlinePlan}
        onLock={lockOutlinePlan}
      />

      {creatorMode === "advanced" ? (
        <OutlineAdvancedControls
          values={advancedControls}
          disabled={generating || isLocked}
          onChange={updateAdvancedControl}
        />
      ) : null}

      <OutlineProgressCard
        progress={outline.progress}
        arcSummary={outline.arcSummary}
        reviewNote={pageCopy.reviewNote}
      />

      {(hasApiOutline || !apiMode) && (
        <OutlineTrackingPanels openLoops={openLoops} reveals={reveals} />
      )}

      {creatorMode === "advanced" && timelineEvents.length > 0 ? (
        <OutlineTimelineInspector events={timelineEvents} />
      ) : null}

      <OutlineRetentionHint
        title={pageCopy.retentionTitle}
        subtitle={pageCopy.retentionSubtitle}
        hints={outline.retentionHints}
      />

      <div className="flex flex-col gap-4">
        {outline.chapters.map((chapter, index) => {
          const isExpanded = expandedId === chapter.id;
          const draft = apiMode && hasApiOutline ? getChapterDraft(chapter.id) : null;

          const arc = arcForChapter(chapter.number);
          const prevArc =
            index > 0 ? arcForChapter(outline.chapters[index - 1].number) : null;
          const showArcHeader = arc !== null && arc.id !== prevArc?.id;

          return (
            <Fragment key={chapter.id}>
              {showArcHeader && arc ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-l-2 border-primary-fixed-dim/40 pl-3">
                  <span className="font-label-md text-label-md text-primary-container">
                    {arc.title}
                  </span>
                  <span className="font-body-sm text-body-sm text-muted-text">
                    Bab {arc.startChapter}–{arc.endChapter}
                  </span>
                  {arc.payoff ? (
                    <Badge variant="primary" className="rounded-full px-2.5 py-0.5">
                      Payoff: {arc.payoff}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              <OutlineChapterCard
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
            </Fragment>
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
