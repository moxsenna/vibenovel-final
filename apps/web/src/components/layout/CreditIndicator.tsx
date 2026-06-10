import { Icon } from "@/components/ui";
import { useCreditBalance } from "@/hooks/useCreditBalance";

export interface CreditIndicatorProps {
  credits?: number;
  compact?: boolean;
}

export function CreditIndicator({
  credits,
  compact = false,
}: CreditIndicatorProps) {
  const apiCredits = useCreditBalance();

  const hasOverride = typeof credits === "number";
  const isAuthenticated = hasOverride ? true : apiCredits.isAuthenticated;
  const isMock = hasOverride ? false : apiCredits.isMock;
  const loading = hasOverride ? false : apiCredits.loading;
  const error = hasOverride ? false : apiCredits.error;
  const balance = hasOverride ? credits : apiCredits.balance;

  // Unauthenticated: hide or show message
  if (!isAuthenticated && !isMock) {
    if (compact) return null;
    return (
      <div className="font-label-sm text-label-sm text-muted-text">
        Masuk untuk melihat kredit
      </div>
    );
  }

  // Loading state
  if (loading) {
    if (compact) {
      return (
        <button
          type="button"
          aria-label="Memuat kredit..."
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant animate-pulse"
        >
          <Icon name="electric_bolt" size={22} />
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-pill bg-surface-container px-3 py-1.5 text-muted-text animate-pulse">
        <Icon name="electric_bolt" size={18} />
        <span className="font-label-md text-label-md">Memuat kredit...</span>
      </div>
    );
  }

  // Error state (no mock fallback on credit API failure)
  if (error || balance === null) {
    if (compact) {
      return (
        <button
          type="button"
          aria-label="Kredit tidak tersedia"
          title="Kredit tidak tersedia"
          className="w-10 h-10 rounded-full flex items-center justify-center text-error hover:bg-error-soft transition-colors"
        >
          <Icon name="error_outline" size={22} />
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-pill bg-error-soft px-3 py-1.5 text-error">
        <Icon name="error_outline" size={18} />
        <span className="font-label-md text-label-md">Kredit tidak tersedia</span>
      </div>
    );
  }

  const formatted = balance.toLocaleString("id-ID");

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