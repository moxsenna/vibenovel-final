export type RevealDensity = "rendah" | "sedang" | "padat";
export type RetentionIntensity = "ringan" | "seimbang" | "tinggi";

export interface OutlineAdvancedControlValues {
  chapterCount: number;
  revealDensity: RevealDensity;
  retentionIntensity: RetentionIntensity;
  proseStyleTarget: string;
}

export interface OutlineAdvancedControlsProps {
  values: OutlineAdvancedControlValues;
  disabled?: boolean;
  onChange: <K extends keyof OutlineAdvancedControlValues>(
    key: K,
    value: OutlineAdvancedControlValues[K],
  ) => void;
}

export function OutlineAdvancedControls({
  values,
  disabled = false,
  onChange,
}: OutlineAdvancedControlsProps) {
  return (
    <section className="rounded-lg border border-border bg-surface-bright p-4">
      <div className="mb-4">
        <h3 className="font-headline-md text-headline-md text-on-background">
          Kontrol Creator Advanced
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 font-label-md text-label-md text-on-surface">
          Jumlah bab
          <input
            type="number"
            min={6}
            max={30}
            value={values.chapterCount}
            disabled={disabled}
            onChange={(event) => onChange("chapterCount", Number(event.target.value))}
            className="h-11 rounded-md border border-border bg-surface px-3 font-body-md text-body-md text-on-surface"
          />
        </label>

        <label className="flex flex-col gap-2 font-label-md text-label-md text-on-surface">
          Kepadatan reveal
          <select
            value={values.revealDensity}
            disabled={disabled}
            onChange={(event) => onChange("revealDensity", event.target.value as RevealDensity)}
            className="h-11 rounded-md border border-border bg-surface px-3 font-body-md text-body-md text-on-surface"
          >
            <option value="rendah">rendah</option>
            <option value="sedang">sedang</option>
            <option value="padat">padat</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 font-label-md text-label-md text-on-surface">
          Intensitas retensi
          <select
            value={values.retentionIntensity}
            disabled={disabled}
            onChange={(event) =>
              onChange("retentionIntensity", event.target.value as RetentionIntensity)
            }
            className="h-11 rounded-md border border-border bg-surface px-3 font-body-md text-body-md text-on-surface"
          >
            <option value="ringan">ringan</option>
            <option value="seimbang">seimbang</option>
            <option value="tinggi">tinggi</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 font-label-md text-label-md text-on-surface">
          Target gaya prosa
          <input
            type="text"
            value={values.proseStyleTarget}
            disabled={disabled}
            onChange={(event) => onChange("proseStyleTarget", event.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3 font-body-md text-body-md text-on-surface"
          />
        </label>
      </div>
    </section>
  );
}
