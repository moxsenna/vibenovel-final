import type { ChapterProseVersion } from "@vibenovel/shared";
import { Button, Card, Icon } from "@/components/ui";

export interface WriterVersionHistoryPanelProps {
  versions: ChapterProseVersion[];
  currentVersionId?: string | null;
  selectedVersionId?: string | null;
  onSelectVersion?: (versionId: string) => void;
  onUseSelectedVersion?: () => void;
  applying?: boolean;
  pendingAiVersionId?: string | null;
  onAcceptPendingAiVersion?: () => void;
  onRejectPendingAiVersion?: () => void;
}

function sourceLabel(source: ChapterProseVersion["source"], isPendingAiVersion = false): string {
  if (isPendingAiVersion) return "AI";

  switch (source) {
    case "ai_generated":
      return "AI";
    case "stub_deterministic":
      return "Draft awal";
    case "user_edited":
    default:
      return "Manual";
  }
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Baru dibuat";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeWords(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function wordBag(words: string[]): Map<string, number> {
  const bag = new Map<string, number>();
  for (const word of words) {
    const key = word.toLocaleLowerCase("id-ID").replace(/[.,!?;:"'()]/g, "");
    if (!key) continue;
    bag.set(key, (bag.get(key) ?? 0) + 1);
  }
  return bag;
}

function diffWords(fromText: string, toText: string): string[] {
  const fromWords = normalizeWords(fromText);
  const toWords = normalizeWords(toText);
  const fromBag = wordBag(fromWords);
  const changed: string[] = [];

  for (const word of toWords) {
    const key = word.toLocaleLowerCase("id-ID").replace(/[.,!?;:"'()]/g, "");
    const remaining = fromBag.get(key) ?? 0;
    if (remaining > 0) {
      fromBag.set(key, remaining - 1);
    } else {
      changed.push(word);
    }
  }

  return changed.slice(0, 28);
}

function DiffChipList({ words, emptyLabel }: { words: string[]; emptyLabel: string }) {
  if (words.length === 0) {
    return <p className="font-body-sm text-body-sm text-muted-text">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="rounded-md bg-surface-container px-2 py-1 font-body-sm text-body-sm text-on-surface"
        >
          {word}
        </span>
      ))}
    </div>
  );
}

export function WriterVersionHistoryPanel({
  versions,
  currentVersionId = null,
  selectedVersionId = null,
  onSelectVersion,
  onUseSelectedVersion,
  applying = false,
  pendingAiVersionId = null,
  onAcceptPendingAiVersion,
  onRejectPendingAiVersion,
}: WriterVersionHistoryPanelProps) {
  const currentVersion =
    versions.find((version) => version.id === currentVersionId) ??
    versions.find((version) => version.isCurrent) ??
    versions[0] ??
    null;
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ??
    currentVersion;
  const canUseSelected =
    Boolean(selectedVersion) &&
    Boolean(onUseSelectedVersion) &&
    selectedVersion?.id !== currentVersion?.id;
  const addedInCurrent =
    selectedVersion && currentVersion
      ? diffWords(selectedVersion.proseText, currentVersion.proseText)
      : [];
  const removedFromCurrent =
    selectedVersion && currentVersion
      ? diffWords(currentVersion.proseText, selectedVersion.proseText)
      : [];
  const pendingVersion = versions.find((version) => version.id === pendingAiVersionId);
  const hasPendingAiReview = Boolean(pendingAiVersionId);

  return (
    <Card
      padding="md"
      shadow={false}
      className="rounded-xl border-border bg-surface"
      data-testid="writer-version-history"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
            <Icon name="history" size={20} className="text-primary" />
            Riwayat Versi
          </h3>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text">
            Bandingkan versi prose lalu pilih versi aktif untuk adegan ini.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canUseSelected || applying}
          onClick={onUseSelectedVersion}
        >
          {applying ? "Memakai..." : "Pakai versi ini"}
        </Button>
      </div>

      {hasPendingAiReview ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary-soft bg-primary-soft/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface">
              Versi AI baru menunggu review
            </p>
            <p className="mt-1 font-body-sm text-body-sm text-muted-text">
              {pendingVersion
                ? `v${pendingVersion.versionNumber} siap dibandingkan sebelum diterima.`
                : "Bandingkan perubahan sebelum menerima versi ini."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!onRejectPendingAiVersion || applying}
              onClick={onRejectPendingAiVersion}
            >
              Tolak versi AI
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!onAcceptPendingAiVersion || applying}
              onClick={onAcceptPendingAiVersion}
            >
              Terima versi AI
            </Button>
          </div>
        </div>
      ) : null}

      {versions.length === 0 ? (
        <p className="font-body-sm text-body-sm text-muted-text">
          Belum ada versi tersimpan untuk adegan ini.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
            {versions.map((version) => {
              const isCurrent = version.id === currentVersion?.id;
              const isSelected = version.id === selectedVersion?.id;
              const isPendingAiVersion = version.id === pendingAiVersionId;
              return (
                <button
                  key={version.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectVersion?.(version.id)}
                  className={[
                    "min-w-[180px] rounded-lg border px-3 py-2 text-left transition-colors xl:min-w-0",
                    isSelected
                      ? "border-primary bg-primary-soft/30"
                      : "border-border bg-surface-soft hover:bg-surface-container",
                  ].join(" ")}
                >
                  <span className="block font-label-md text-label-md text-on-surface">
                    v{version.versionNumber} · {sourceLabel(version.source, isPendingAiVersion)}
                  </span>
                  <span className="mt-1 block font-body-sm text-body-sm text-muted-text">
                    {version.wordCount} kata · {formatCreatedAt(version.createdAt)}
                  </span>
                  {isCurrent ? (
                    <span className="mt-2 inline-flex rounded-full bg-success-soft px-2 py-0.5 font-label-sm text-label-sm text-tertiary">
                      Aktif
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface-soft p-3">
              <h4 className="mb-2 font-label-md text-label-md text-on-surface">
                Ditambahkan di versi aktif
              </h4>
              <DiffChipList
                words={addedInCurrent}
                emptyLabel="Tidak ada tambahan besar dibanding versi ini."
              />
            </div>
            <div className="rounded-lg border border-border bg-surface-soft p-3">
              <h4 className="mb-2 font-label-md text-label-md text-on-surface">
                Dihapus dari versi aktif
              </h4>
              <DiffChipList
                words={removedFromCurrent}
                emptyLabel="Tidak ada bagian besar yang hilang dari versi ini."
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
