import { Icon } from "@/components/ui";
import { SHELL_MOCK } from "@/mocks/shell";

export interface CreditIndicatorProps {
  credits?: number;
  compact?: boolean;
}

/** Dummy credit display — Sprint 1 UI only. TODO: Sprint 2+ real credit API */
export function CreditIndicator({
  credits = SHELL_MOCK.credits,
  compact = false,
}: CreditIndicatorProps) {
  const formatted = credits.toLocaleString("id-ID");

  if (compact) {
    return (
      <button
        type="button"
        aria-label={`${formatted} kredit`}
        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-primary-soft hover:text-primary transition-colors"
      >
        <Icon name="electric_bolt" size={22} />
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-pill bg-primary-soft px-3 py-1.5 text-primary"
      aria-label={`${formatted} kredit tersisa`}
    >
      <Icon name="electric_bolt" size={18} filled />
      <span className="font-label-md text-label-md">{formatted}</span>
      <span className="font-label-sm text-label-sm text-primary/80">kredit</span>
    </div>
  );
}