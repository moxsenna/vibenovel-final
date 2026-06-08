import { useEffect, useState } from "react";
import type { PublishEditableFieldKey } from "@/lib/publish-mappers";
import { PublishCopyFieldCard } from "./PublishCopyFieldCard";
import { Button } from "@/components/ui";

export interface PublishEditableFieldProps {
  fieldKey: PublishEditableFieldKey;
  label: string;
  icon: string;
  value: string;
  copyValue?: string;
  editable?: boolean;
  saving?: boolean;
  italic?: boolean;
  accentBorder?: boolean;
  preWrap?: boolean;
  multiline?: boolean;
  onSave?: (field: PublishEditableFieldKey, value: string) => void;
}

export function PublishEditableField({
  fieldKey,
  label,
  icon,
  value,
  copyValue,
  editable = false,
  saving = false,
  italic = false,
  accentBorder = false,
  preWrap = false,
  multiline = true,
  onSave,
}: PublishEditableFieldProps) {
  const [draft, setDraft] = useState(value);
  const displayCopy = copyValue ?? value;
  const changed = draft !== value;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (!editable || !onSave) {
    const teaserDisplay = italic && value ? `"${value}"` : value;
    return (
      <PublishCopyFieldCard
        label={label}
        icon={icon}
        value={teaserDisplay}
        italic={italic}
        accentBorder={accentBorder}
        preWrap={preWrap}
      />
    );
  }

  return (
    <PublishCopyFieldCard
      label={label}
      icon={icon}
      value={displayCopy}
      italic={italic}
      accentBorder={accentBorder}
      preWrap={preWrap}
    >
      {multiline ? (
        <textarea
          className="min-h-[96px] w-full resize-y rounded-md border border-border bg-background p-3 font-body-editor text-body-editor text-on-background outline-none focus:border-primary"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
        />
      ) : (
        <input
          type="text"
          className="w-full rounded-md border border-border bg-background p-3 font-body-editor text-body-editor text-on-background outline-none focus:border-primary"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      {changed ? (
        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            disabled={saving || !draft.trim()}
            onClick={() => onSave(fieldKey, draft)}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      ) : null}
    </PublishCopyFieldCard>
  );
}