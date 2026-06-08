import { Button } from "@/components/ui";

export interface PublishWorkflowActionsProps {
  apiMode: boolean;
  hasPackage: boolean;
  summaryApproved: boolean;
  isExported: boolean;
  generating: boolean;
  markingExported: boolean;
  onGenerate: () => void;
  onMarkExported: () => void;
}

export function PublishWorkflowActions({
  apiMode,
  hasPackage,
  summaryApproved,
  isExported,
  generating,
  markingExported,
  onGenerate,
  onMarkExported,
}: PublishWorkflowActionsProps) {
  if (!apiMode) return null;

  if (!hasPackage) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          disabled={!summaryApproved || generating}
          onClick={onGenerate}
        >
          {generating ? "Membuat paket…" : "Buat Paket Publish"}
        </Button>
        {!summaryApproved ? (
          <p className="font-body-sm text-body-sm text-muted-text">
            Setujui ringkasan bab di halaman Ringkasan terlebih dahulu.
          </p>
        ) : null}
      </div>
    );
  }

  if (isExported) {
    return (
      <p className="rounded-lg border border-border bg-surface-soft px-4 py-3 font-body-sm text-body-sm text-muted-text">
        Paket sudah ditandai disalin ke KBM. Editing dikunci — ini hanya penanda manual, bukan
        posting otomatis.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" disabled={markingExported} onClick={onMarkExported}>
        {markingExported ? "Menandai…" : "Tandai Sudah Disalin ke KBM"}
      </Button>
      <p className="font-body-sm text-body-sm text-muted-text">
        Tandai setelah kamu menyalin materi secara manual. Tidak ada posting otomatis ke KBM.
      </p>
    </div>
  );
}