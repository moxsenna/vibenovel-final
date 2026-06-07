import { Icon } from "@/components/ui";
import { CreditIndicator } from "./CreditIndicator";

/** Mobile top bar — visible below md breakpoint (Stitch: dashboard_penulis_refined) */
export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-surface px-lg">
      <div className="flex items-center gap-2">
        <h1 className="text-headline-md font-headline-md font-bold text-primary tracking-tight">
          VibeNovel
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <CreditIndicator compact />
        <button
          type="button"
          aria-label="Profil — belum tersedia di Sprint 1"
          title="Belum tersedia di Sprint 1 — UI demo saja"
          disabled
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant opacity-60"
        >
          <Icon name="account_circle" size={24} />
        </button>
      </div>
    </header>
  );
}