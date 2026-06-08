import type { SafeContextPreview } from "@/hooks/useWriteRoomData";
import type { ChapterDraft } from "@/types";
import {
  formatProseRewriteModeLabel,
  PROSE_REWRITE_MODES,
  type ProseRewriteMode,
} from "@/services/ai";
import { Button, Card, Icon } from "@/components/ui";

const REWRITE_MODE_OPTIONS: ProseRewriteMode[] = [
  PROSE_REWRITE_MODES.improve_emotion,
  PROSE_REWRITE_MODES.tighten_pacing,
  PROSE_REWRITE_MODES.natural_dialogue,
  PROSE_REWRITE_MODES.shorter,
  PROSE_REWRITE_MODES.longer,
  PROSE_REWRITE_MODES.custom,
];

export interface WriterAssistantPanelProps {
  draft: ChapterDraft;
  contextPreview?: SafeContextPreview | null;
  onBuildContext?: () => void;
  buildingContext?: boolean;
  onGenerateAi?: () => void;
  aiGenerating?: boolean;
  aiError?: string | null;
  aiNotice?: string | null;
  creditCostLabel?: string | null;
  creditActionCostLabel?: string | null;
  creditRewriteCostLabel?: string | null;
  qualityModeLabel?: string | null;
  creditBalance?: number | null;
  creditLoading?: boolean;
  creditError?: string | null;
  insufficientCredit?: boolean;
  insufficientCreditRewrite?: boolean;
  remainingAfterGenerate?: number | null;
  remainingAfterRewrite?: number | null;
  showCreditUi?: boolean;
  aiUnavailableReason?: string | null;
  onRewriteProse?: () => void;
  rewriteGenerating?: boolean;
  rewriteError?: string | null;
  rewriteNotice?: string | null;
  rewriteMode?: ProseRewriteMode;
  rewriteInstruction?: string;
  onRewriteModeChange?: (mode: ProseRewriteMode) => void;
  onRewriteInstructionChange?: (text: string) => void;
  rewriteUnavailableReason?: string | null;
  hasProseForRewrite?: boolean;
}

export function WriterAssistantPanel({
  draft,
  contextPreview = null,
  onBuildContext,
  buildingContext = false,
  onGenerateAi,
  aiGenerating = false,
  aiError = null,
  aiNotice = null,
  creditCostLabel = null,
  creditActionCostLabel = null,
  creditRewriteCostLabel = null,
  qualityModeLabel = null,
  creditBalance = null,
  creditLoading = false,
  creditError = null,
  insufficientCredit = false,
  insufficientCreditRewrite = false,
  remainingAfterGenerate = null,
  remainingAfterRewrite = null,
  showCreditUi = false,
  aiUnavailableReason = null,
  onRewriteProse,
  rewriteGenerating = false,
  rewriteError = null,
  rewriteNotice = null,
  rewriteMode = PROSE_REWRITE_MODES.improve_emotion,
  rewriteInstruction = "",
  onRewriteModeChange,
  onRewriteInstructionChange,
  rewriteUnavailableReason = null,
  hasProseForRewrite = false,
}: WriterAssistantPanelProps) {
  const { pageCopy, storyChecks } = draft;

  return (
    <aside className="z-10 hidden h-full w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface shadow-[-4px_0_24px_rgba(31,41,51,0.02)] xl:flex">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface p-lg">
        <h2 className="flex items-center gap-2 font-headline-md text-headline-md text-on-surface">
          <Icon name="auto_awesome" size={22} className="text-primary" />
          {pageCopy.assistantTitle}
        </h2>
        <button
          type="button"
          aria-label="Tutup panel asisten"
          className="rounded-full p-1 text-muted-text transition-colors hover:text-on-surface"
          disabled
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-6 p-lg">
        {onBuildContext ? (
          <div className="flex flex-col gap-3">
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
              Konteks Aman Bab Ini
            </h3>
            <Button
              variant="ghost"
              className="w-full rounded-xl border border-primary-soft bg-primary-soft/20 py-3 text-primary hover:bg-primary-soft/40"
              leftIcon={<Icon name="shield" size={20} />}
              disabled={buildingContext}
              onClick={onBuildContext}
            >
              {buildingContext ? "Menyiapkan…" : "Siapkan Konteks Aman"}
            </Button>
            {contextPreview ? (
              <Card padding="sm" shadow={false} className="rounded-xl border border-border bg-surface-soft">
                <p className="font-label-md text-label-md text-on-surface">{contextPreview.chapterTitle}</p>
                <p className="mt-1 font-body-sm text-body-sm text-muted-text">
                  Bab {contextPreview.chapterNumber}
                </p>
                <ul className="mt-3 space-y-1 font-body-sm text-body-sm text-on-surface-variant">
                  <li>Item wajib: {contextPreview.mustIncludeCount}</li>
                  <li>Item dilarang: {contextPreview.mustNotIncludeCount}</li>
                  <li>Cek cerita aman: {contextPreview.storyCheckLabels.length}</li>
                  {contextPreview.packetHashShort ? (
                    <li>Hash paket: {contextPreview.packetHashShort}…</li>
                  ) : null}
                </ul>
                {contextPreview.direction ? (
                  <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
                    {contextPreview.direction}
                  </p>
                ) : null}
                {contextPreview.storyCheckLabels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {contextPreview.storyCheckLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-success-soft px-2 py-0.5 font-label-sm text-label-sm text-tertiary"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : (
              <p className="font-body-sm text-body-sm text-muted-text">
                Siapkan konteks aman sebelum menyimpan narasi. Tidak menampilkan data teknis internal.
              </p>
            )}
          </div>
        ) : null}

        {onBuildContext ? <div className="h-px w-full bg-border/50" /> : null}

        {showCreditUi ? (
          <>
            <div className="flex flex-col gap-3">
              <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
                Saldo Kredit
              </h3>
              <Card padding="sm" shadow={false} className="rounded-xl border border-border bg-surface-soft">
                <p className="font-display text-display text-primary">
                  {creditLoading
                    ? "…"
                    : creditError
                      ? "—"
                      : creditBalance != null
                        ? creditBalance.toLocaleString("id-ID")
                        : "—"}
                </p>
                <p className="font-label-sm text-label-sm text-muted-text">kredit tersisa</p>
                {creditError ? (
                  <p className="mt-2 font-body-sm text-body-sm text-warning">{creditError}</p>
                ) : null}
                {qualityModeLabel ? (
                  <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
                    Mode kualitas: <span className="font-medium text-on-surface">{qualityModeLabel}</span>
                  </p>
                ) : null}
                {creditActionCostLabel ? (
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                    {creditActionCostLabel}
                  </p>
                ) : null}
                {remainingAfterGenerate != null && !insufficientCredit ? (
                  <p className="mt-1 font-body-sm text-body-sm text-muted-text">
                    Estimasi sisa setelah generate: {remainingAfterGenerate} kredit
                  </p>
                ) : null}
                {insufficientCredit ? (
                  <p className="mt-2 font-body-sm text-body-sm text-warning">
                    Kredit tidak cukup untuk aksi ini.
                  </p>
                ) : null}
                <p className="mt-2 font-body-sm text-body-sm text-muted-text">
                  Top up belum tersedia di versi ini.
                </p>
              </Card>
            </div>
            <div className="h-px w-full bg-border/50" />
          </>
        ) : null}

        <div className="flex flex-col gap-3">
          <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
            Bantu Menulis
          </h3>
          <Button
            variant="primary"
            className="w-full rounded-xl py-3.5 shadow-md shadow-primary/20"
            leftIcon={<Icon name="auto_awesome" size={20} />}
            disabled={!onGenerateAi || aiGenerating || insufficientCredit}
            onClick={onGenerateAi}
          >
            {aiGenerating ? "Menghasilkan narasi…" : "Tulis Beat dengan AI"}
          </Button>
          {creditCostLabel ? (
            <p className="font-body-sm text-body-sm text-muted-text">{creditCostLabel}</p>
          ) : null}
          {aiNotice ? (
            <p className="rounded-xl border border-success-soft bg-success-soft/40 px-3 py-2 font-body-sm text-body-sm text-on-surface">
              {aiNotice}
            </p>
          ) : null}
          {aiError ? (
            <p className="rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 font-body-sm text-body-sm text-on-surface">
              {aiError}
            </p>
          ) : null}
          {aiUnavailableReason && !onGenerateAi ? (
            <p className="font-body-sm text-body-sm text-muted-text">{aiUnavailableReason}</p>
          ) : null}
        </div>

        <div className="h-px w-full bg-border/50" />

        {onRewriteProse || rewriteUnavailableReason ? (
          <div className="flex flex-col gap-3">
            <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
              Perbaiki Teks dengan AI
            </h3>
            {onRewriteProse ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="font-label-sm text-label-sm text-muted-text">Mode perbaikan</span>
                  <select
                    value={rewriteMode}
                    disabled={rewriteGenerating}
                    onChange={(event) =>
                      onRewriteModeChange?.(event.target.value as ProseRewriteMode)
                    }
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
                    aria-label="Mode perbaikan teks"
                  >
                    {REWRITE_MODE_OPTIONS.map((mode) => (
                      <option key={mode} value={mode}>
                        {formatProseRewriteModeLabel(mode)}
                      </option>
                    ))}
                  </select>
                </label>
                {rewriteMode === PROSE_REWRITE_MODES.custom ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="font-label-sm text-label-sm text-muted-text">
                      Instruksi khusus (maks. 500 karakter)
                    </span>
                    <textarea
                      value={rewriteInstruction}
                      maxLength={500}
                      disabled={rewriteGenerating}
                      onChange={(event) => onRewriteInstructionChange?.(event.target.value)}
                      rows={3}
                      placeholder="Contoh: buat dialog lebih natural tanpa mengubah plot."
                      className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
                      aria-label="Instruksi perbaikan khusus"
                    />
                  </label>
                ) : null}
                {creditRewriteCostLabel ? (
                  <p className="font-body-sm text-body-sm text-muted-text">{creditRewriteCostLabel}</p>
                ) : null}
                {remainingAfterRewrite != null && !insufficientCreditRewrite ? (
                  <p className="font-body-sm text-body-sm text-muted-text">
                    Estimasi sisa setelah rewrite: {remainingAfterRewrite} kredit
                  </p>
                ) : null}
                <Button
                  variant="ghost"
                  className="w-full rounded-xl border border-primary-soft bg-primary-soft/20 py-3 text-primary hover:bg-primary-soft/40"
                  leftIcon={<Icon name="edit_note" size={20} />}
                  disabled={
                    !onRewriteProse ||
                    rewriteGenerating ||
                    insufficientCreditRewrite ||
                    !hasProseForRewrite ||
                    (rewriteMode === PROSE_REWRITE_MODES.custom && !rewriteInstruction.trim())
                  }
                  onClick={onRewriteProse}
                >
                  {rewriteGenerating ? "Memperbaiki teks…" : "Perbaiki Teks"}
                </Button>
                {rewriteNotice ? (
                  <p className="rounded-xl border border-success-soft bg-success-soft/40 px-3 py-2 font-body-sm text-body-sm text-on-surface">
                    {rewriteNotice}
                  </p>
                ) : null}
                {rewriteError ? (
                  <p className="rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 font-body-sm text-body-sm text-on-surface">
                    {rewriteError}
                  </p>
                ) : null}
              </>
            ) : rewriteUnavailableReason ? (
              <p className="font-body-sm text-body-sm text-muted-text">{rewriteUnavailableReason}</p>
            ) : null}
          </div>
        ) : null}

        <div className="h-px w-full bg-border/50" />

        <div className="flex flex-col gap-3">
          <h3 className="font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
            {pageCopy.storyCheckTitle}
          </h3>
          <div className="flex flex-col gap-2">
            {storyChecks.map((check) =>
              check.status === "ok" ? (
                <Card
                  key={check.id}
                  padding="sm"
                  shadow={false}
                  className="flex items-center justify-between rounded-xl border border-success-soft bg-success-soft/50"
                >
                  <div className="flex items-center gap-3">
                    <Icon name="check_circle" size={20} className="text-tertiary" />
                    <span className="font-body-sm text-body-sm text-on-surface">{check.label}</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-tertiary">
                    {check.statusLabel}
                  </span>
                </Card>
              ) : (
                <Card
                  key={check.id}
                  padding="sm"
                  shadow={false}
                  className="flex flex-col gap-2 rounded-xl border border-warning/20 bg-warning-soft"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon name="warning" size={20} className="text-warning" />
                      <span className="font-body-sm text-body-sm text-on-surface">
                        {check.label}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm font-bold text-warning">
                      {check.statusLabel}
                    </span>
                  </div>
                  {check.detail && (
                    <p className="pl-8 font-body-sm text-body-sm text-on-surface-variant">
                      {check.detail}
                    </p>
                  )}
                </Card>
              ),
            )}
          </div>
          <Button
            variant="ghost"
            className="mt-2 w-full rounded-xl border border-border text-primary hover:border-primary hover:bg-primary-soft"
            leftIcon={<Icon name="checklist" size={18} />}
            disabled
          >
            {pageCopy.recheckLabel}
          </Button>
        </div>
      </div>
    </aside>
  );
}