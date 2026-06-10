import {
  PublishActionSection,
  PublishAiCopyPanel,
  PublishChecklistPanel,
  PublishEditableField,
  PublishIntegrationNotice,
  PublishMobilePreview,
  PublishPageHeader,
  PublishTagsCard,
  PublishWorkflowActions,
} from "@/components/publish";
import { WorkflowLockedState } from "@/components/common/WorkflowLockedState";
import { usePublishData } from "@/hooks/usePublishData";
import { ROUTES } from "@/routes/paths";
import { uiValueForField } from "@/lib/publish-mappers";

/**
 * Paket Publish — Sprint 1 layout + Sprint 7 API integration (Task 7.4)
 * Mock fallback when VITE_USE_MOCKS=true or API unavailable.
 */
export function PublishPage() {
  const {
    pkg,
    loading,
    apiMode,
    hasPackage,
    isExported,
    isReadonly,
    summaryApproved,
    genre,
    generating,
    savingField,
    savingChecklist,
    markingExported,
    notice,
    workflowNotice,
    actionError,
    publishCopyAiLoading,
    publishCopyAiError,
    publishCopyAiNotice,
    publishCopySuggestions,
    selectedAiFields,
    publishCopyInstruction,
    applyingSuggestionField,
    applyingAllSuggestions,
    publishCopyCreditCostLabel,
    publishCopyQualityModeLabel,
    publishCopyCreditBalance,
    publishCopyCreditLoading,
    publishCopyCreditError,
    publishCopyInsufficientCredit,
    publishCopyRemainingAfterImprove,
    publishCopyAiUnavailableReason,
    setSelectedAiFields,
    setPublishCopyInstruction,
    generatePackageAction,
    saveFieldAction,
    toggleChecklistItem,
    markExportedAction,
    improvePublishCopyWithAi,
    applyPublishCopySuggestion,
    applyAllPublishCopySuggestions,
    dismissPublishCopySuggestion,
    lockedTitle,
    lockedDescription,
    source,
  } = usePublishData();

  const { pageCopy } = pkg;
  const editable = apiMode && hasPackage && !isExported;
  const showPackageContent = !apiMode || hasPackage;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-lg">
        <p className="font-body-md text-body-md text-muted-text">Memuat paket publish…</p>
      </div>
    );
  }

  if ((source === "locked" || source === "error") && lockedTitle) {
    return (
      <div className="mx-auto flex w-full max-w-detail flex-col gap-lg p-lg">
        <PublishIntegrationNotice message={notice} />
        <WorkflowLockedState
          title={lockedTitle}
          description={lockedDescription ?? ""}
          backRoute={ROUTES.dashboard}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-lg">
      <PublishIntegrationNotice message={notice} />
      <PublishIntegrationNotice message={workflowNotice} />
      <PublishIntegrationNotice message={actionError} />

      <PublishPageHeader
        badgeLabel={pageCopy.badgeLabel}
        title={pageCopy.title}
        subtitle={pageCopy.subtitle}
      />

      <PublishWorkflowActions
        apiMode={apiMode}
        hasPackage={hasPackage}
        summaryApproved={summaryApproved}
        isExported={isExported}
        generating={generating}
        markingExported={markingExported}
        onGenerate={() => void generatePackageAction()}
        onMarkExported={() => void markExportedAction()}
      />

      {showPackageContent ? (
        <div className="grid grid-cols-1 gap-lg lg:grid-cols-12 lg:items-start">
          <div className="flex flex-col gap-md lg:col-span-7">
            <PublishAiCopyPanel
              apiMode={apiMode}
              hasPackage={hasPackage}
              isExported={isExported}
              publishCopyAiLoading={publishCopyAiLoading}
              publishCopyAiError={publishCopyAiError}
              publishCopyAiNotice={publishCopyAiNotice}
              suggestions={publishCopySuggestions}
              selectedAiFields={selectedAiFields}
              publishCopyInstruction={publishCopyInstruction}
              onSelectedAiFieldsChange={setSelectedAiFields}
              onPublishCopyInstructionChange={setPublishCopyInstruction}
              onImprovePublishCopy={
                apiMode && hasPackage && !isExported
                  ? () => void improvePublishCopyWithAi()
                  : undefined
              }
              onApplySuggestion={
                apiMode && hasPackage && !isExported
                  ? (field) => void applyPublishCopySuggestion(field)
                  : undefined
              }
              onApplyAllSuggestions={
                apiMode && hasPackage && !isExported
                  ? () => void applyAllPublishCopySuggestions()
                  : undefined
              }
              onDismissSuggestion={dismissPublishCopySuggestion}
              applyingSuggestionField={applyingSuggestionField}
              applyingAllSuggestions={applyingAllSuggestions}
              creditCostLabel={publishCopyCreditCostLabel}
              qualityModeLabel={publishCopyQualityModeLabel}
              creditBalance={publishCopyCreditBalance}
              creditLoading={publishCopyCreditLoading}
              creditError={publishCopyCreditError}
              insufficientCredit={publishCopyInsufficientCredit}
              remainingAfterImprove={publishCopyRemainingAfterImprove}
              unavailableReason={publishCopyAiUnavailableReason}
            />

            <PublishEditableField
              fieldKey="displayTitle"
              label={pageCopy.titleLabel}
              icon="title"
              value={uiValueForField(pkg, "displayTitle")}
              editable={editable}
              saving={savingField === "displayTitle"}
              multiline={false}
              onSave={(field, value) => void saveFieldAction(field, value)}
            />

            <PublishEditableField
              fieldKey="teaser"
              label={pageCopy.teaserLabel}
              icon="electric_bolt"
              value={uiValueForField(pkg, "teaser")}
              copyValue={`"${pkg.teaser}"`}
              editable={editable}
              saving={savingField === "teaser"}
              italic
              onSave={(field, value) => void saveFieldAction(field, value)}
            />

            <PublishEditableField
              fieldKey="shortSynopsis"
              label={pageCopy.blurbLabel}
              icon="description"
              value={uiValueForField(pkg, "shortSynopsis")}
              editable={editable}
              saving={savingField === "shortSynopsis"}
              onSave={(field, value) => void saveFieldAction(field, value)}
            />

            <PublishEditableField
              fieldKey="caption"
              label={pageCopy.captionLabel}
              icon="chat"
              value={uiValueForField(pkg, "caption")}
              editable={editable}
              saving={savingField === "caption"}
              preWrap
              onSave={(field, value) => void saveFieldAction(field, value)}
            />

            <PublishEditableField
              fieldKey="readerQuestion"
              label={pageCopy.commentBaitLabel}
              icon="forum"
              value={uiValueForField(pkg, "readerQuestion")}
              editable={editable}
              saving={savingField === "readerQuestion"}
              onSave={(field, value) => void saveFieldAction(field, value)}
            />

            <PublishEditableField
              fieldKey="nextChapterTeaser"
              label={pageCopy.nextChapterLabel}
              icon="fast_forward"
              value={uiValueForField(pkg, "nextChapterTeaser")}
              editable={editable}
              saving={savingField === "nextChapterTeaser"}
              accentBorder
              onSave={(field, value) => void saveFieldAction(field, value)}
            />
          </div>

          <div className="flex flex-col gap-md lg:col-span-5">
            {editable ? (
              <>
                <PublishEditableField
                  fieldKey="tags"
                  label={pageCopy.tagsLabel}
                  icon="tag"
                  value={uiValueForField(pkg, "tags")}
                  editable
                  saving={savingField === "tags"}
                  onSave={(field, value) => void saveFieldAction(field, value)}
                />
                <PublishEditableField
                  fieldKey="genre"
                  label="Genre"
                  icon="category"
                  value={uiValueForField(pkg, "genre", genre)}
                  editable
                  saving={savingField === "genre"}
                  multiline={false}
                  onSave={(field, value) => void saveFieldAction(field, value)}
                />
              </>
            ) : (
              <PublishTagsCard label={pageCopy.tagsLabel} tags={pkg.tags} />
            )}

            <PublishChecklistPanel
              title={pageCopy.checklistTitle}
              items={pkg.checklist}
              interactive={editable}
              saving={savingChecklist}
              onToggle={(itemId) => void toggleChecklistItem(itemId)}
            />

            <PublishEditableField
              fieldKey="mobilePreviewExcerpt"
              label={pageCopy.mobilePreviewTitle}
              icon="smartphone"
              value={uiValueForField(pkg, "mobilePreviewExcerpt")}
              editable={editable}
              saving={savingField === "mobilePreviewExcerpt"}
              onSave={(field, value) => void saveFieldAction(field, value)}
            />

            <PublishMobilePreview title={pageCopy.mobilePreviewTitle} preview={pkg.mobilePreview} />

            <PublishActionSection
              dashboardCta={pageCopy.dashboardCta}
              summaryCta={pageCopy.summaryCta}
              nextChapterCta={pageCopy.nextChapterCta}
              nextChapterHint={pageCopy.nextChapterHint}
              dashboardRoute={pkg.dashboardRoute}
              summaryRoute={pkg.summaryRoute}
              outlineRoute={pkg.outlineRoute}
              compact
            />
          </div>
        </div>
      ) : null}

      {isReadonly && isExported ? (
        <p className="font-body-sm text-body-sm text-muted-text">
          Paket publish siap disalin. Status diekspor hanya penanda manual di VibeNovel.
        </p>
      ) : null}
    </div>
  );
}