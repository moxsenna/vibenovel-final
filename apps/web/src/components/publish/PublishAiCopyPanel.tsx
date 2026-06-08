import {
  formatPublishCopyTierCostsLabel,
  PUBLISH_COPY_AI_FIELDS,
  type PublishCopyAiField,
  type PublishCopySuggestions,
} from "@/services/ai";
import { Button, Card, Icon } from "@/components/ui";

const FIELD_OPTIONS: { field: PublishCopyAiField; label: string }[] = [
  { field: PUBLISH_COPY_AI_FIELDS.teaser, label: "Teaser" },
  { field: PUBLISH_COPY_AI_FIELDS.caption, label: "Caption" },
  { field: PUBLISH_COPY_AI_FIELDS.readerQuestion, label: "Pertanyaan Pembaca" },
  { field: PUBLISH_COPY_AI_FIELDS.shortSynopsis, label: "Sinopsis Pendek" },
  { field: PUBLISH_COPY_AI_FIELDS.nextChapterTeaser, label: "Teaser Bab Berikutnya" },
];

function suggestionFieldLabel(field: PublishCopyAiField): string {
  return FIELD_OPTIONS.find((opt) => opt.field === field)?.label ?? field;
}

export interface PublishAiCopyPanelProps {
  apiMode: boolean;
  hasPackage: boolean;
  isExported: boolean;
  publishCopyAiLoading: boolean;
  publishCopyAiError: string | null;
  publishCopyAiNotice: string | null;
  suggestions: PublishCopySuggestions | null;
  selectedAiFields: PublishCopyAiField[];
  publishCopyInstruction: string;
  onSelectedAiFieldsChange: (fields: PublishCopyAiField[]) => void;
  onPublishCopyInstructionChange: (text: string) => void;
  onImprovePublishCopy?: () => void;
  onApplySuggestion?: (field: PublishCopyAiField) => void;
  onApplyAllSuggestions?: () => void;
  onDismissSuggestion?: (field: PublishCopyAiField) => void;
  applyingSuggestionField?: PublishCopyAiField | null;
  applyingAllSuggestions?: boolean;
  creditCostLabel?: string | null;
  qualityModeLabel?: string | null;
  creditBalance?: number | null;
  creditLoading?: boolean;
  creditError?: string | null;
  insufficientCredit?: boolean;
  remainingAfterImprove?: number | null;
  unavailableReason?: string | null;
}

export function PublishAiCopyPanel({
  apiMode,
  hasPackage,
  isExported,
  publishCopyAiLoading,
  publishCopyAiError,
  publishCopyAiNotice,
  suggestions,
  selectedAiFields,
  publishCopyInstruction,
  onSelectedAiFieldsChange,
  onPublishCopyInstructionChange,
  onImprovePublishCopy,
  onApplySuggestion,
  onApplyAllSuggestions,
  onDismissSuggestion,
  applyingSuggestionField = null,
  applyingAllSuggestions = false,
  creditCostLabel = null,
  qualityModeLabel = null,
  creditBalance = null,
  creditLoading = false,
  creditError = null,
  insufficientCredit = false,
  remainingAfterImprove = null,
  unavailableReason = null,
}: PublishAiCopyPanelProps) {
  const showPanel = apiMode && hasPackage;
  if (!showPanel) {
    if (!apiMode) {
      return (
        <Card
          padding="sm"
          className="rounded-xl border-dashed border-border bg-surface-soft/40 p-4"
          data-testid="publish-ai-copy-panel"
        >
          <p className="m-0 font-body-sm text-body-sm text-muted-text">
            Perbaiki copy dengan AI hanya tersedia dalam mode API dengan paket publish aktif.
          </p>
        </Card>
      );
    }
    return null;
  }

  const toggleField = (field: PublishCopyAiField) => {
    if (selectedAiFields.includes(field)) {
      onSelectedAiFieldsChange(selectedAiFields.filter((f) => f !== field));
    } else {
      onSelectedAiFieldsChange([...selectedAiFields, field]);
    }
  };

  const suggestionEntries = suggestions
    ? (Object.entries(suggestions) as [PublishCopyAiField, string][])
    : [];

  const exportedMessage = isExported
    ? "Paket sudah ditandai exported; perbaikan copy AI tidak tersedia."
    : null;

  return (
    <Card
      padding="sm"
      className="flex flex-col gap-md rounded-xl border-border p-4 shadow-sm md:p-lg"
      data-testid="publish-ai-copy-panel"
    >
      <div className="flex items-center gap-2">
        <Icon name="auto_awesome" size={20} className="text-primary" />
        <h2 className="m-0 font-headline-sm text-headline-sm text-on-surface">
          Perbaiki Copy dengan AI
        </h2>
      </div>

      <p className="m-0 font-body-sm text-body-sm text-muted-text">
        AI hanya membuat saran. Paket publish tidak berubah sampai Anda menekan Terapkan.
      </p>

      {exportedMessage ? (
        <p className="m-0 font-body-sm text-body-sm text-warning">{exportedMessage}</p>
      ) : null}

      {unavailableReason && !isExported ? (
        <p className="m-0 font-body-sm text-body-sm text-muted-text">{unavailableReason}</p>
      ) : null}

      {!isExported ? (
        <>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 font-label-md text-label-md text-on-surface-variant">
              Field yang ingin diperbaiki
            </legend>
            {FIELD_OPTIONS.map(({ field, label }) => (
              <label
                key={field}
                className="flex cursor-pointer items-center gap-2 font-body-sm text-body-sm text-on-surface"
              >
                <input
                  type="checkbox"
                  checked={selectedAiFields.includes(field)}
                  onChange={() => toggleField(field)}
                  disabled={publishCopyAiLoading || isExported}
                  data-testid={`publish-ai-field-${field}`}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1 font-body-sm text-body-sm">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Instruksi tambahan (opsional, maks. 500 karakter)
            </span>
            <textarea
              className="min-h-[72px] rounded-lg border border-border bg-surface px-3 py-2 font-body-sm text-body-sm text-on-surface"
              value={publishCopyInstruction}
              maxLength={500}
              onChange={(e) => onPublishCopyInstructionChange(e.target.value)}
              disabled={publishCopyAiLoading || !onImprovePublishCopy}
              data-testid="publish-ai-instruction"
            />
          </label>

          <div className="flex flex-col gap-1 font-body-sm text-body-sm text-muted-text">
            <span>{formatPublishCopyTierCostsLabel()}</span>
            {creditCostLabel ? <span>{creditCostLabel}</span> : null}
            {qualityModeLabel ? <span>Mode kualitas: {qualityModeLabel}</span> : null}
            {creditLoading ? <span>Memuat saldo kredit…</span> : null}
            {creditError ? <span>{creditError}</span> : null}
            {!creditLoading && creditBalance != null ? (
              <span>Saldo: {creditBalance} kredit</span>
            ) : !creditLoading && creditBalance == null && !creditError ? (
              <span>Saldo belum bisa dimuat; server tetap memvalidasi saat klik.</span>
            ) : null}
            {remainingAfterImprove != null ? (
              <span>Sisa setelah saran: {remainingAfterImprove} kredit</span>
            ) : null}
            {insufficientCredit ? (
              <span className="text-warning">Kredit tidak cukup untuk aksi ini.</span>
            ) : null}
          </div>

          <Button
            variant="primary"
            className="w-full"
            disabled={
              !onImprovePublishCopy ||
              publishCopyAiLoading ||
              insufficientCredit ||
              selectedAiFields.length === 0
            }
            onClick={onImprovePublishCopy}
            data-testid="publish-ai-buat-saran"
          >
            {publishCopyAiLoading ? "Membuat saran…" : "Buat Saran Copy"}
          </Button>
        </>
      ) : null}

      {publishCopyAiError ? (
        <p className="m-0 font-body-sm text-body-sm text-error" role="alert">
          {publishCopyAiError}
        </p>
      ) : null}

      {publishCopyAiNotice ? (
        <p className="m-0 font-body-sm text-body-sm text-primary" role="status">
          {publishCopyAiNotice}
        </p>
      ) : null}

      {suggestionEntries.length > 0 ? (
        <div className="flex flex-col gap-md" data-testid="publish-ai-suggestions">
          {onApplyAllSuggestions && suggestionEntries.length > 1 ? (
            <Button
              variant="ghost"
              className="self-start"
              disabled={applyingAllSuggestions || applyingSuggestionField != null}
              onClick={onApplyAllSuggestions}
              data-testid="publish-ai-terapkan-semua"
            >
              {applyingAllSuggestions ? "Menerapkan…" : "Terapkan Semua"}
            </Button>
          ) : null}

          {suggestionEntries.map(([field, text]) => (
            <Card
              key={field}
              padding="sm"
              shadow={false}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-soft p-3"
              data-testid={`publish-ai-suggestion-${field}`}
            >
              <h3 className="m-0 font-label-md text-label-md text-on-surface">
                {suggestionFieldLabel(field)}
              </h3>
              <p className="m-0 whitespace-pre-wrap font-body-sm text-body-sm text-on-background">
                {text}
              </p>
              <div className="flex flex-wrap gap-2">
                {onApplySuggestion ? (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={
                      applyingAllSuggestions ||
                      (applyingSuggestionField != null && applyingSuggestionField !== field)
                    }
                    onClick={() => onApplySuggestion(field)}
                    data-testid={`publish-ai-terapkan-${field}`}
                  >
                    {applyingSuggestionField === field ? "Menerapkan…" : "Terapkan"}
                  </Button>
                ) : null}
                {onDismissSuggestion ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={applyingSuggestionField === field || applyingAllSuggestions}
                    onClick={() => onDismissSuggestion(field)}
                    data-testid={`publish-ai-abaikan-${field}`}
                  >
                    Abaikan
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </Card>
  );
}