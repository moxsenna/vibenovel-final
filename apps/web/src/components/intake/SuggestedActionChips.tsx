export interface SuggestedActionChipsProps {
  actions: string[];
  onSelect: (action: string) => void;
}

export function SuggestedActionChips({ actions, onSelect }: SuggestedActionChipsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => onSelect(action)}
          className="rounded-pill border border-border bg-surface px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:border-primary-container hover:bg-primary-soft hover:text-primary"
        >
          {action}
        </button>
      ))}
    </div>
  );
}