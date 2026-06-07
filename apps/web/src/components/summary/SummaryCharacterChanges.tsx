import type { CharacterChange } from "@/types";

export interface SummaryCharacterChangesProps {
  changes: CharacterChange[];
}

export function SummaryCharacterChanges({ changes }: SummaryCharacterChangesProps) {
  return (
    <ul className="flex flex-col gap-4 font-body-sm text-body-sm text-on-surface-variant">
      {changes.map((change, index) => (
        <li key={change.id} className="flex items-start gap-3">
          <div
            className={[
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
              index === 0 ? "bg-secondary-container" : "bg-surface-dim",
            ].join(" ")}
          >
            <span
              className={[
                "font-label-sm text-label-sm",
                index === 0 ? "text-on-secondary-container" : "text-on-surface",
              ].join(" ")}
            >
              {change.initial}
            </span>
          </div>
          <span>
            <strong>{change.characterName}:</strong> {change.change}
          </span>
        </li>
      ))}
    </ul>
  );
}