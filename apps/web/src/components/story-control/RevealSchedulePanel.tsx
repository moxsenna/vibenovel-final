import { useState } from "react";
import {
  PLANNED_REVEAL_STATUSES,
  type PlannedRevealStatus,
} from "@vibenovel/shared";
import { Badge, Button, Card, Icon } from "@/components/ui";
import type { PlannedRevealPublic } from "@/services/outline";

export interface RevealSchedulePanelProps {
  reveals: PlannedRevealPublic[];
  savingKey: string | null;
  onStatusChange: (revealId: string, status: PlannedRevealStatus) => void;
  onReplaceTruth: (revealId: string, truth: string) => Promise<boolean>;
}

export function RevealSchedulePanel({
  reveals,
  savingKey,
  onStatusChange,
  onReplaceTruth,
}: RevealSchedulePanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replacementTruth, setReplacementTruth] = useState("");

  async function saveReplacement(revealId: string) {
    const saved = await onReplaceTruth(revealId, replacementTruth);
    if (saved) {
      setReplacementTruth("");
      setEditingId(null);
    }
  }

  return (
    <Card className="space-y-4" aria-labelledby="reveal-schedule-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="reveal-schedule-heading" className="font-headline-sm text-headline-sm text-on-surface">
            Jadwal Reveal
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text">
            Tampilan default selalu redacted; Writer hanya menerima breadcrumb yang aman.
          </p>
        </div>
        <Icon name="visibility_off" className="text-primary" />
      </div>

      {reveals.length === 0 ? (
        <p className="font-body-sm text-body-sm text-muted-text">Belum ada jadwal reveal.</p>
      ) : (
        <ul className="space-y-3">
          {reveals.map((reveal) => (
            <li key={reveal.id} className="rounded-xl border border-border bg-surface-soft p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={reveal.riskLevel === "high" ? "danger" : "warning"}>
                  Risiko {reveal.riskLevel}
                </Badge>
                <Badge>{reveal.status}</Badge>
                <Badge>Truth disembunyikan</Badge>
              </div>
              <p className="mt-3 font-body-md text-body-md font-medium text-on-surface">
                {reveal.title}
              </p>
              <p className="mt-1 font-body-sm text-body-sm text-muted-text">
                Hint aman: {reveal.readerFacingHint || "—"}
              </p>
              <p className="mt-1 font-body-sm text-body-sm text-muted-text">
                Terlarang sebelum bab: {reveal.forbiddenBeforeChapter ?? "tidak ditentukan"}
              </p>

              <label className="mt-3 block font-label-sm text-label-sm text-on-surface-variant">
                Status
                <select
                  className="mt-1 min-h-[40px] w-full rounded-md border border-border bg-surface px-3"
                  value={reveal.status}
                  disabled={savingKey === `reveal:${reveal.id}`}
                  onChange={(event) =>
                    onStatusChange(reveal.id, event.target.value as PlannedRevealStatus)
                  }
                >
                  {Object.values(PLANNED_REVEAL_STATUSES).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <div className="mt-3 border-t border-border pt-3">
                {editingId !== reveal.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReplacementTruth("");
                      setEditingId(reveal.id);
                    }}
                  >
                    Ganti rahasia author-only
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-lg border border-warning/30 bg-warning-soft p-3 font-body-sm text-body-sm text-warning">
                      Nilai lama sengaja tidak ditampilkan. Isi nilai pengganti hanya jika Anda
                      benar-benar ingin mengubah sumber kebenaran planner.
                    </p>
                    <label className="block font-label-sm text-label-sm text-on-surface-variant">
                      Planning truth pengganti
                      <textarea
                        aria-label={`Planning truth pengganti untuk ${reveal.title}`}
                        className="mt-1 min-h-28 w-full rounded-md border border-border bg-surface p-3 font-body-sm text-body-sm"
                        value={replacementTruth}
                        onChange={(event) => setReplacementTruth(event.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={savingKey === `truth:${reveal.id}` || !replacementTruth.trim()}
                        onClick={() => void saveReplacement(reveal.id)}
                      >
                        {savingKey === `truth:${reveal.id}` ? "Menyimpan..." : "Ganti planning truth"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
