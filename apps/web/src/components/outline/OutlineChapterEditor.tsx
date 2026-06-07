import { Button, Icon } from "@/components/ui";

export interface OutlineChapterDraft {
  title: string;
  summary: string;
  endingHook: string;
  miniVictory: string;
}

export interface OutlineChapterEditorProps {
  draft: OutlineChapterDraft;
  disabled?: boolean;
  saving?: boolean;
  onChange: (field: keyof OutlineChapterDraft, value: string) => void;
  onSave: () => void | Promise<void>;
}

export function OutlineChapterEditor({
  draft,
  disabled = false,
  saving = false,
  onChange,
  onSave,
}: OutlineChapterEditorProps) {
  return (
    <div className="border-t border-border bg-surface-soft p-4 md:p-6">
      <h4 className="mb-3 flex items-center gap-2 font-label-md text-label-md text-on-background">
        <Icon name="edit" size={18} />
        Edit Rencana Bab
      </h4>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="font-label-sm text-label-sm text-muted-text">Judul Bab</span>
          <input
            type="text"
            value={draft.title}
            disabled={disabled}
            onChange={(e) => onChange("title", e.target.value)}
            className="rounded-lg border border-border bg-surface-bright px-3 py-2 font-body-md text-body-md text-on-background outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="font-label-sm text-label-sm text-muted-text">Ringkasan</span>
          <textarea
            value={draft.summary}
            disabled={disabled}
            rows={3}
            onChange={(e) => onChange("summary", e.target.value)}
            className="rounded-lg border border-border bg-surface-bright px-3 py-2 font-body-md text-body-md text-on-background outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="font-label-sm text-label-sm text-muted-text">Hook Akhir Bab</span>
          <textarea
            value={draft.endingHook}
            disabled={disabled}
            rows={2}
            onChange={(e) => onChange("endingHook", e.target.value)}
            className="rounded-lg border border-border bg-surface-bright px-3 py-2 font-body-md text-body-md text-on-background outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="font-label-sm text-label-sm text-muted-text">Kemenangan Kecil (opsional)</span>
          <input
            type="text"
            value={draft.miniVictory}
            disabled={disabled}
            onChange={(e) => onChange("miniVictory", e.target.value)}
            className="rounded-lg border border-border bg-surface-bright px-3 py-2 font-body-md text-body-md text-on-background outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          variant="secondary"
          className="rounded-xl"
          leftIcon={<Icon name="save" size={18} />}
          disabled={disabled || saving}
          onClick={() => void onSave()}
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </div>
  );
}