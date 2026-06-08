import { Link } from "react-router-dom";
import type { Beat, ChapterDraft } from "@/types";
import { ROUTES } from "@/routes/paths";
import { Badge, Button, Card, Icon } from "@/components/ui";
import { WriterMobileCheckSheet } from "./WriterMobileCheckSheet";

export interface WriterMobileLayoutProps {
  draft: ChapterDraft;
  activeBeat: Beat;
  activeBeatId: string;
  onSelectBeat: (beatId: string) => void;
  editable?: boolean;
  proseText?: string;
  onProseChange?: (text: string) => void;
  onSave?: () => void;
  saving?: boolean;
  onFinish?: () => void;
  finishing?: boolean;
  onGenerateAi?: () => void;
  aiGenerating?: boolean;
  creditCostLabel?: string | null;
  creditBalance?: number | null;
  insufficientCredit?: boolean;
  insufficientCreditRewrite?: boolean;
  showCreditUi?: boolean;
  onRewriteProse?: () => void;
  rewriteGenerating?: boolean;
  rewriteModeLabel?: string | null;
  hasProseForRewrite?: boolean;
}

export function WriterMobileLayout({
  draft,
  activeBeat,
  activeBeatId,
  onSelectBeat,
  editable = false,
  proseText,
  onProseChange,
  onSave,
  saving = false,
  onFinish,
  finishing = false,
  onGenerateAi,
  aiGenerating = false,
  creditCostLabel = null,
  creditBalance = null,
  insufficientCredit = false,
  insufficientCreditRewrite = false,
  showCreditUi = false,
  onRewriteProse,
  rewriteGenerating = false,
  rewriteModeLabel = null,
  hasProseForRewrite = false,
}: WriterMobileLayoutProps) {
  const { pageCopy } = draft;
  const displayProse = proseText ?? activeBeat.prose;
  const paragraphs = displayProse.split("\n\n").filter(Boolean);
  const outlineRoute = ROUTES.project.outline(draft.projectId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
      {/* Top bar — task-focused mobile header */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-md shadow-sm">
        <Link
          to={outlineRoute}
          aria-label="Kembali ke outline"
          className="-ml-2 flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" size={24} />
        </Link>
        <div className="flex flex-col items-center px-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant opacity-80">
            {pageCopy.mobileWorkspaceLabel}
          </span>
          <span className="font-label-md text-label-md text-on-surface">
            Bab {draft.chapterNumber} — {draft.chapterTitle}
          </span>
          <Badge
            variant="neutral"
            className="mt-0.5 border-0 bg-surface-container px-2 py-0 text-[10px]"
          >
            {draft.chapterStatus === "draft" ? "Draft" : "Selesai"}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing}
          className="min-h-[44px] px-2 font-label-md text-label-md font-bold text-primary transition-colors hover:text-primary-dark disabled:opacity-60"
        >
          {finishing ? "…" : pageCopy.mobileSummaryCta}
        </button>
      </header>

      {/* Compact beat selector */}
      <div className="shrink-0 border-b border-border bg-surface-soft px-md py-3">
        <p className="mb-2 font-label-sm text-label-sm text-muted-text">Pilih adegan</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {draft.beats.map((beat) => {
            const isActive = beat.id === activeBeatId;
            return (
              <button
                key={beat.id}
                type="button"
                onClick={() => onSelectBeat(beat.id)}
                className={[
                  "min-h-[44px] shrink-0 rounded-full px-4 py-2 font-label-sm text-label-sm transition-colors",
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "border border-border bg-surface text-on-surface-variant hover:bg-surface-container",
                ].join(" ")}
              >
                Adegan {beat.number}
              </button>
            );
          })}
        </div>
        <p className="mt-2 line-clamp-1 font-body-sm text-body-sm text-on-surface-variant">
          {activeBeat.title}
        </p>
      </div>

      {/* Editor canvas */}
      <main className="relative z-0 w-full flex-1 overflow-y-auto overflow-x-hidden bg-surface px-lg py-xl pb-44">
        <Card
          padding="sm"
          shadow={false}
          className="mb-6 flex items-start gap-3 rounded-xl border-primary-fixed/30 bg-surface-soft"
        >
          <Icon name="lightbulb" size={20} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="mb-1 font-label-md text-label-md text-primary-container">
              {pageCopy.mobileDirectionLabel}
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {activeBeat.direction}
            </p>
          </div>
        </Card>

        <article className="mx-auto w-full max-w-full outline-none">
          {editable && onProseChange ? (
            <textarea
              value={displayProse}
              onChange={(event) => onProseChange(event.target.value)}
              className="mb-6 min-h-[280px] w-full resize-y border-0 bg-transparent font-body-editor text-[17px] leading-[1.8] text-on-surface outline-none"
              placeholder="Tulis narasi adegan di sini…"
              aria-label={`Narasi adegan ${activeBeat.number}`}
            />
          ) : (
            <>
              {paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className="mb-6 font-body-editor text-[17px] leading-[1.8] text-on-surface"
                >
                  {paragraph}
                </p>
              ))}
              <p className="mb-6 font-body-editor text-[17px] italic leading-[1.8] text-muted-text">
                ... (Kursor berkedip di sini)
              </p>
            </>
          )}
        </article>

        <p className="font-body-sm text-body-sm text-muted-text">
          {draft.wordCount} kata · {draft.lastSavedLabel}
          {showCreditUi && creditBalance != null ? ` · Saldo: ${creditBalance}` : ""}
          {showCreditUi && creditCostLabel ? ` · ${creditCostLabel}` : ""}
          {showCreditUi && insufficientCredit ? " · Kredit tidak cukup" : ""}
          {onRewriteProse && rewriteModeLabel ? ` · Mode rewrite: ${rewriteModeLabel}` : ""}
        </p>
      </main>

      {/* Floating action bar */}
      <div className="fixed bottom-[5.5rem] left-1/2 z-20 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(31,41,51,0.08)]">
        <div className="flex items-center gap-1">
          <Button
            variant="primary"
            pill
            disabled={!editable || !onSave || saving}
            onClick={onSave}
            className="min-h-[44px] gap-2 px-5"
            leftIcon={<Icon name={editable ? "save" : "auto_awesome"} size={20} filled={!editable} />}
          >
            {saving ? "…" : editable ? pageCopy.saveLabel : pageCopy.mobileWriteAction}
          </Button>
          <Button
            variant="ghost"
            pill
            disabled={!onGenerateAi || aiGenerating || insufficientCredit}
            onClick={onGenerateAi}
            className="min-h-[44px] gap-1.5 px-4 text-on-surface-variant"
            leftIcon={<Icon name="auto_awesome" size={20} />}
            aria-label="Tulis Beat dengan AI"
          >
            {aiGenerating ? "…" : onGenerateAi ? "AI" : pageCopy.mobileFixAction}
          </Button>
          <Button
            variant="ghost"
            pill
            disabled={
              !onRewriteProse ||
              rewriteGenerating ||
              insufficientCreditRewrite ||
              !hasProseForRewrite
            }
            onClick={onRewriteProse}
            className="min-h-[44px] gap-1.5 px-4 text-on-surface-variant"
            leftIcon={<Icon name="edit_note" size={20} />}
            aria-label="Perbaiki Teks"
          >
            {rewriteGenerating ? "…" : onRewriteProse ? "Perbaiki" : pageCopy.mobileFixAction}
          </Button>
        </div>
      </div>

      <WriterMobileCheckSheet
        title={pageCopy.mobileCheckSheetTitle}
        checks={draft.storyChecks}
      />
    </div>
  );
}