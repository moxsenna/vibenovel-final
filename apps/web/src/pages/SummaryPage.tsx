import {
  SummaryActionFooter,
  SummaryBulletList,
  SummaryCharacterChanges,
  SummaryMiniVictoryBanner,
  SummaryOpenLoopsSection,
  SummaryPageHeader,
  SummaryProposalReviewPanel,
  SummarySectionCard,
  SummaryStoryCheckNotes,
  SummarySynopsisCard,
  SummaryWorkflowActions,
} from "@/components/summary";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { WorkflowLockedState } from "@/components/common/WorkflowLockedState";
import { ROUTES } from "@/routes/paths";
import { useSummaryData } from "@/hooks/useSummaryData";

/**
 * Ringkasan Bab — Sprint 1 layout + Sprint 6 API integration (Task 6.5)
 * Mock fallback when VITE_USE_MOCKS=true or API unavailable.
 */
export function SummaryPage() {
  const {
    summary,
    loading,
    generating,
    extracting,
    approving,
    notice,
    workflowNotice,
    actionError,
    apiMode,
    hasSummary,
    readyForSummary,
    isApproved,
    hasDelta,
    proposals,
    actionProposalId,
    generateSummaryAction,
    extractDeltaAction,
    approveSummaryAction,
    acceptProposal,
    rejectProposal,
    lockedTitle,
    lockedDescription,
    source,
  } = useSummaryData();

  const { pageCopy } = summary;
  const chapterLabel = `Bab ${summary.chapterNumber}: ${summary.chapterTitle}`;
  const statusLabel =
    summary.status === "ready_for_review" ? pageCopy.statusReady : pageCopy.statusDraft;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-lg">
        <p className="font-body-md text-body-md text-muted-text">Memuat ringkasan bab…</p>
      </div>
    );
  }

  if ((source === "locked" || source === "error") && lockedTitle) {
    return (
      <div className="mx-auto flex w-full max-w-editor flex-col gap-lg p-lg">
        <IntegrationNotice message={notice} />
        <WorkflowLockedState
          title={lockedTitle}
          description={lockedDescription ?? ""}
          backRoute={ROUTES.dashboard}
        />
      </div>
    );
  }

  const showEmptySynopsis = apiMode && !hasSummary && !summary.synopsis.trim();

  return (
    <>
      <div className="mx-auto flex w-full max-w-editor flex-col gap-lg pb-32">
        <IntegrationNotice message={notice} />
        <IntegrationNotice message={workflowNotice} />
        <IntegrationNotice message={actionError} />

        <SummaryPageHeader
          badgeLabel={pageCopy.badgeLabel}
          title={pageCopy.title}
          subtitle={pageCopy.subtitle}
          chapterLabel={chapterLabel}
          statusLabel={statusLabel}
        />

        {apiMode ? (
          <SummaryWorkflowActions
            hasSummary={hasSummary}
            readyForSummary={readyForSummary}
            isApproved={isApproved}
            hasDelta={hasDelta}
            generating={generating}
            extracting={extracting}
            onGenerate={() => void generateSummaryAction()}
            onExtract={() => void extractDeltaAction()}
          />
        ) : null}

        {showEmptySynopsis ? (
          <p className="rounded-lg border border-border bg-surface-soft px-4 py-3 font-body-sm text-body-sm text-muted-text">
            Belum ada ringkasan bab untuk bab ini.
          </p>
        ) : (
          <SummarySynopsisCard synopsis={summary.synopsis || "Ringkasan belum tersedia."} />
        )}

        {summary.miniVictories.length > 0 ? (
          <SummaryMiniVictoryBanner items={summary.miniVictories} />
        ) : null}

        <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <SummarySectionCard title="Fakta Baru" icon="menu_book">
            <SummaryBulletList items={summary.newFacts} />
          </SummarySectionCard>

          <SummarySectionCard
            title="Perubahan Tokoh"
            icon="psychology"
            iconClassName="text-secondary"
          >
            <SummaryCharacterChanges changes={summary.characterChanges} />
          </SummarySectionCard>

          <SummarySectionCard title="Perubahan Relasi" icon="groups" iconClassName="text-primary">
            <SummaryBulletList items={summary.relationChanges} icon="swap_horiz" />
          </SummarySectionCard>

          <SummarySectionCard
            title="Rahasia yang Masih Ditahan"
            icon="lock"
            iconFilled
            iconClassName="text-primary"
          >
            <SummaryBulletList items={summary.heldSecrets} icon="visibility_off" />
          </SummarySectionCard>

          <SummarySectionCard
            title="Yang Masih Menggantung"
            icon="all_inclusive"
            iconClassName="text-warning"
            className="md:col-span-2"
          >
            <SummaryOpenLoopsSection openLoops={summary.openLoops} />
          </SummarySectionCard>

          <SummarySectionCard
            title="Catatan Cek Cerita"
            icon="checklist"
            iconClassName="text-primary"
            className="md:col-span-2"
          >
            <SummaryStoryCheckNotes notes={summary.storyCheckNotes} />
          </SummarySectionCard>

          {apiMode && hasSummary ? (
            <SummarySectionCard
              title="Usulan Perubahan Canon"
              icon="fact_check"
              iconClassName="text-primary"
              className="md:col-span-2"
            >
              <SummaryProposalReviewPanel
                proposals={proposals}
                isApproved={isApproved}
                actionProposalId={actionProposalId}
                actionError={actionError}
                onAccept={(id) => void acceptProposal(id)}
                onReject={(id) => void rejectProposal(id)}
              />
            </SummarySectionCard>
          ) : null}
        </div>
      </div>

      <SummaryActionFooter
        approveCta={pageCopy.approveCta}
        backToWriteCta={pageCopy.backToWriteCta}
        publishRoute={summary.publishRoute}
        writeRoute={summary.writeRoute}
        onApprove={apiMode && hasSummary && !isApproved ? () => void approveSummaryAction() : undefined}
        approveDisabled={!hasSummary || isApproved}
        approving={approving}
        approveHint={
          apiMode && isApproved
            ? "Ringkasan disetujui. Tinjau usulan canon di atas sebelum publish."
            : apiMode && hasSummary
              ? "Menyetujui ringkasan tidak otomatis memasukkan semua usulan ke canon."
              : null
        }
        showPublishLink={!apiMode || isApproved}
      />
    </>
  );
}