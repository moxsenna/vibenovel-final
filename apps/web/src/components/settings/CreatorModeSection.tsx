import type { CreatorMode, CreatorModeOption } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface CreatorModeSectionProps {
  selectedMode: CreatorMode;
  onSelectMode: (mode: CreatorMode) => void;
}

const OPTIONS: CreatorModeOption[] = [
  {
    id: "simple",
    label: "Simple",
    description: "Default ringkas untuk alur tulis cepat.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Kontrol tambahan untuk rencana bab dan gaya serial.",
  },
];

export function CreatorModeSection({
  selectedMode,
  onSelectMode,
}: CreatorModeSectionProps) {
  return (
    <Card padding="lg" className="flex flex-col rounded-[20px] border-border/50 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <Icon name="tune" size={22} className="text-secondary" />
        <h3 className="font-headline-md text-headline-md text-on-surface">Mode Creator</h3>
      </div>

      <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Mode Creator">
        {OPTIONS.map((option) => {
          const selected = selectedMode === option.id;
          return (
            <label
              key={option.id}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                selected ? "border-2 border-primary bg-primary-soft/30" : "border-border hover:bg-surface-soft",
              ].join(" ")}
            >
              <input
                type="radio"
                name="creator_mode"
                value={option.id}
                checked={selected}
                onChange={() => onSelectMode(option.id)}
                className="mt-1 border-outline-variant text-primary focus:ring-primary"
              />
              <span className="flex flex-col">
                <span className={selected ? "font-label-md text-label-md text-primary" : "font-label-md text-label-md text-on-surface"}>
                  {option.label}
                </span>
                <span className="font-body-sm text-body-sm text-muted-text">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}
