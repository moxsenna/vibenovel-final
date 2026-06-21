import { OPEN_LOOP_STATUSES, type OpenLoop, type OpenLoopStatus } from "@vibenovel/shared";
import { Badge, Card, Icon } from "@/components/ui";

export interface OpenLoopsPanelProps {
  openLoops: OpenLoop[];
  savingKey: string | null;
  onStatusChange: (loopId: string, status: OpenLoopStatus) => void;
}

export function OpenLoopsPanel({
  openLoops,
  savingKey,
  onStatusChange,
}: OpenLoopsPanelProps) {
  return (
    <Card className="space-y-4" aria-labelledby="open-loops-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="open-loops-heading" className="font-headline-sm text-headline-sm text-on-surface">
            Open Loops
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text">
            Pertanyaan pembaca yang harus dikembangkan atau dibayar.
          </p>
        </div>
        <Icon name="all_inclusive" className="text-primary" />
      </div>

      {openLoops.length === 0 ? (
        <p className="font-body-sm text-body-sm text-muted-text">Belum ada open loop.</p>
      ) : (
        <ul className="space-y-3">
          {openLoops.map((loop) => (
            <li key={loop.id} className="rounded-xl border border-border bg-surface-soft p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={loop.status === "paid_off" ? "success" : "primary"}>
                  {loop.status}
                </Badge>
                <Badge>{loop.importance}</Badge>
              </div>
              <p className="mt-3 font-body-md text-body-md text-on-surface">{loop.question}</p>
              {loop.readerFacingHint ? (
                <p className="mt-1 font-body-sm text-body-sm text-muted-text">
                  Hint aman: {loop.readerFacingHint}
                </p>
              ) : null}
              <label className="mt-3 block font-label-sm text-label-sm text-on-surface-variant">
                Status
                <select
                  className="mt-1 min-h-[40px] w-full rounded-md border border-border bg-surface px-3"
                  value={loop.status}
                  disabled={savingKey === `loop:${loop.id}`}
                  onChange={(event) =>
                    onStatusChange(loop.id, event.target.value as OpenLoopStatus)
                  }
                >
                  {Object.values(OPEN_LOOP_STATUSES).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
