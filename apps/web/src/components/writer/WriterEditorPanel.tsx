import { useState } from "react";
import type { ChapterProseVersion } from "@vibenovel/shared";
import type { Beat, ChapterDraft } from "@/types";
import { Button, Card, Icon } from "@/components/ui";
import { WriterVersionHistoryPanel } from "./WriterVersionHistoryPanel";

export interface WriterEditorPanelProps {
  draft: ChapterDraft;
  activeBeat: Beat;
  editable?: boolean;
  proseText?: string;
  onProseChange?: (text: string) => void;
  onSave?: () => void;
  saving?: boolean;
  onFinish?: () => void;
  finishing?: boolean;
  rewriteGenerating?: boolean;
  rewriteNotice?: string | null;
  rewriteError?: string | null;
  proseVersions?: ChapterProseVersion[];
  currentProseVersionId?: string | null;
  selectedProseVersionId?: string | null;
  onSelectProseVersion?: (versionId: string) => void;
  onUseSelectedProseVersion?: () => void;
  versionApplying?: boolean;
  pendingAiVersionId?: string | null;
  onAcceptPendingAiVersion?: () => void;
  onRejectPendingAiVersion?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndoProse?: () => void;
  onRedoProse?: () => void;
}

export function WriterEditorPanel({
  draft,
  activeBeat,
  editable = false,
  proseText,
  onProseChange,
  onSave,
  saving = false,
  onFinish,
  finishing = false,
  rewriteGenerating = false,
  rewriteNotice = null,
  rewriteError = null,
  proseVersions = [],
  currentProseVersionId = null,
  selectedProseVersionId = null,
  onSelectProseVersion,
  onUseSelectedProseVersion,
  versionApplying = false,
  pendingAiVersionId = null,
  onAcceptPendingAiVersion,
  onRejectPendingAiVersion,
  canUndo = false,
  canRedo = false,
  onUndoProse,
  onRedoProse,
}: WriterEditorPanelProps) {
  const { pageCopy } = draft;
  const [previewOpen, setPreviewOpen] = useState(false);
  const displayProse = proseText ?? activeBeat.prose;
  const paragraphs = displayProse.split("\n\n").filter(Boolean);

  return (
    <div className="flex flex-1 justify-center overflow-y-auto bg-background p-4 md:p-lg">
      <div className="flex w-full max-w-editor flex-col gap-6">
        <div className="sticky top-0 z-20 border-b border-border/50 bg-background/95 py-4 pb-6 backdrop-blur-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  Bab {draft.chapterNumber} — {draft.chapterTitle}
                </h2>
                <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-muted-text">
                  {draft.chapterStatus === "draft" ? "Draft" : "Selesai"}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-muted-text">
                Adegan {activeBeat.number}: {activeBeat.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 font-body-sm text-body-sm text-muted-text">
                <span>{draft.wordCount} kata</span>
                <span>•</span>
                <span>{draft.lastSavedLabel}</span>
                {rewriteGenerating ? (
                  <>
                    <span>•</span>
                    <span className="text-primary">Memperbaiki teks…</span>
                  </>
                ) : null}
                {!rewriteGenerating && rewriteNotice ? (
                  <>
                    <span>•</span>
                    <span className="text-tertiary">Teks diperbaiki</span>
                  </>
                ) : null}
                {!rewriteGenerating && rewriteError ? (
                  <>
                    <span>•</span>
                    <span className="text-warning">Perbaikan gagal</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[36px] px-3"
                disabled={!canUndo || !onUndoProse}
                onClick={onUndoProse}
                aria-label="Undo"
              >
                <Icon name="undo" size={20} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[36px] px-3"
                disabled={!canRedo || !onRedoProse}
                onClick={onRedoProse}
                aria-label="Redo"
              >
                <Icon name="redo" size={20} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 border border-primary-soft bg-surface text-primary shadow-sm"
                disabled={!editable || !onSave || saving}
                onClick={onSave}
                leftIcon={<Icon name="save" size={18} />}
              >
                {saving ? "Menyimpan…" : pageCopy.saveLabel}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="border border-primary-soft bg-surface text-primary shadow-sm"
                onClick={() => setPreviewOpen((open) => !open)}
                leftIcon={<Icon name="visibility" size={18} />}
                aria-pressed={previewOpen}
              >
                {pageCopy.previewLabel}
              </Button>
            </div>
          </div>

          <Card
            padding="sm"
            shadow={false}
            className="relative mt-4 flex items-start gap-4 overflow-hidden rounded-xl border-primary-fixed-dim/30 bg-surface-soft"
          >
            <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary-fixed-dim" aria-hidden="true" />
            <Icon name="assignment" size={22} className="mt-0.5 text-primary-container" />
            <div className="flex-1">
              <h3 className="mb-1 font-label-md text-label-md text-primary-container">
                {pageCopy.directionTitle}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {activeBeat.direction}
              </p>
            </div>
          </Card>
        </div>

        <WriterVersionHistoryPanel
          versions={proseVersions}
          currentVersionId={currentProseVersionId}
          selectedVersionId={selectedProseVersionId}
          onSelectVersion={onSelectProseVersion}
          onUseSelectedVersion={onUseSelectedProseVersion}
          applying={versionApplying}
          pendingAiVersionId={pendingAiVersionId}
          onAcceptPendingAiVersion={onAcceptPendingAiVersion}
          onRejectPendingAiVersion={onRejectPendingAiVersion}
        />

        {previewOpen ? (
          <section
            role="region"
            aria-label="Pratinjau pembaca"
            className="rounded-xl border border-border bg-surface-soft p-4 md:p-6"
          >
            <div className="mx-auto w-full max-w-[360px] rounded-[28px] border border-border bg-surface px-5 py-6 shadow-sm">
              <div className="mb-5 border-b border-border pb-3">
                <p className="font-label-md text-label-md text-primary">
                  Pratinjau pembaca
                </p>
                <p className="mt-1 font-body-sm text-body-sm text-muted-text">
                  Bab {draft.chapterNumber} · Adegan {activeBeat.number}
                </p>
              </div>
              <div className="font-body-editor text-[16px] leading-[1.85] text-on-surface">
                {paragraphs.length > 0 ? (
                  paragraphs.map((paragraph, index) => (
                    <p key={index} className="mb-4 whitespace-pre-wrap last:mb-0">
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className="italic text-muted-text">Belum ada narasi.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <Card
          padding="lg"
          className="min-h-[480px] cursor-text rounded-xl border-border p-6 shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-primary/20 md:p-10 lg:p-[60px]"
        >
          {editable && onProseChange ? (
            <textarea
              value={displayProse}
              onChange={(event) => onProseChange(event.target.value)}
              className="min-h-[400px] w-full resize-y border-0 bg-transparent font-body-editor text-body-editor leading-[1.8] text-on-surface outline-none"
              placeholder="Tulis narasi adegan di sini…"
              aria-label={`Narasi adegan ${activeBeat.number}`}
            />
          ) : (
            <div className="font-body-editor text-body-editor leading-[1.8] text-on-surface outline-none">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="mb-4 whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
              <p className="italic text-muted-text">... (Kursor berkedip di sini)</p>
            </div>
          )}
        </Card>

        <div className="flex justify-end pb-4">
          <Button
            variant="primary"
            className="rounded-xl shadow-md"
            disabled={finishing}
            onClick={onFinish}
            rightIcon={<Icon name="arrow_forward" size={18} />}
          >
            {finishing ? "Menandai…" : pageCopy.finishCta}
          </Button>
        </div>
      </div>
    </div>
  );
}
