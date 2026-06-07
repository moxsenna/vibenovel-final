import { Button, Icon } from "@/components/ui";

export interface SettingsActionSectionProps {
  cancelCta: string;
  saveCta: string;
  onCancel?: () => void;
  onSave?: () => void;
}

export function SettingsActionSection({
  cancelCta,
  saveCta,
  onCancel,
  onSave,
}: SettingsActionSectionProps) {
  return (
    <div className="mt-4 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end sm:gap-4">
      <Button
        variant="ghost"
        className="rounded-xl border-0 text-muted-text hover:bg-surface-variant"
        onClick={onCancel}
      >
        {cancelCta}
      </Button>
      <Button
        className="rounded-xl shadow-md"
        leftIcon={<Icon name="save" size={18} />}
        title="Simpan preferensi secara lokal di peramban (Sprint 1)"
        onClick={onSave}
      >
        {saveCta}
      </Button>
    </div>
  );
}