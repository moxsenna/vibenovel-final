import { Button } from "@/components/ui";

export interface SummaryWorkflowActionsProps {
  hasSummary: boolean;
  readyForSummary: boolean;
  isApproved: boolean;
  hasDelta: boolean;
  generating: boolean;
  extracting: boolean;
  onGenerate: () => void;
  onExtract: () => void;
}

export function SummaryWorkflowActions({
  hasSummary,
  readyForSummary,
  isApproved,
  hasDelta,
  generating,
  extracting,
  onGenerate,
  onExtract,
}: SummaryWorkflowActionsProps) {
  if (!readyForSummary && !hasSummary) {
    return (
      <p className="rounded-lg border border-border bg-surface-soft px-4 py-3 font-body-sm text-body-sm text-muted-text">
        Selesaikan bab di Ruang Tulis dan tandai siap ringkasan sebelum membuat ringkasan bab.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!hasSummary ? (
        <Button variant="primary" disabled={!readyForSummary || generating} onClick={onGenerate}>
          {generating ? "Membuat ringkasan…" : "Buat Ringkasan Bab"}
        </Button>
      ) : null}

      {hasSummary && !isApproved ? (
        <Button variant="secondary" disabled={extracting} onClick={onExtract}>
          {extracting
            ? "Mengekstrak…"
            : hasDelta
              ? "Perbarui Ekstraksi Perubahan"
              : "Ekstrak Perubahan Cerita"}
        </Button>
      ) : null}
    </div>
  );
}