import { Button, Icon } from "@/components/ui";

export interface OutlineWorkflowActionsProps {
  needsGenerate: boolean;
  hasApiOutline: boolean;
  isLocked: boolean;
  generating: boolean;
  approving: boolean;
  locking: boolean;
  apiMode: boolean;
  onGenerate?: () => void | Promise<void>;
  onApprove?: () => void | Promise<void>;
  onLock?: () => void | Promise<void>;
}

export function OutlineWorkflowActions({
  needsGenerate,
  hasApiOutline,
  isLocked,
  generating,
  approving,
  locking,
  apiMode,
  onGenerate,
  onApprove,
  onLock,
}: OutlineWorkflowActionsProps) {
  if (!apiMode) return null;

  if (needsGenerate) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-bright p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-background">Belum Ada Rencana Bab</h3>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text">
            Fondasi harus sudah dikunci. Buat rencana 10 bab awal dari fondasi cerita kamu.
          </p>
        </div>
        {onGenerate && (
          <Button
            variant="primary"
            className="w-full rounded-xl md:w-auto"
            leftIcon={<Icon name="auto_awesome" size={20} />}
            disabled={generating}
            onClick={() => void onGenerate()}
          >
            {generating ? "Membuat rencana..." : "Buat Rencana 10 Bab"}
          </Button>
        )}
      </div>
    );
  }

  if (isLocked || !hasApiOutline) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-bright p-4 sm:flex-row sm:flex-wrap">
      {onApprove && (
        <Button
          variant="secondary"
          className="w-full rounded-xl sm:w-auto"
          leftIcon={<Icon name="fact_check" size={20} />}
          disabled={approving || locking}
          onClick={() => void onApprove()}
        >
          {approving ? "Menyetujui..." : "Setujui Outline"}
        </Button>
      )}
      {onLock && (
        <Button
          variant="primary"
          className="w-full rounded-xl sm:w-auto"
          leftIcon={<Icon name="lock" size={20} filled />}
          disabled={locking || approving}
          onClick={() => void onLock()}
        >
          {locking ? "Mengunci..." : "Kunci Outline"}
        </Button>
      )}
    </div>
  );
}