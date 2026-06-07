import { Link } from "react-router-dom";
import { Icon } from "@/components/ui";
import { ROUTES } from "@/routes/paths";

/**
 * Landing top bar — no AppShell.
 * Masuk/Daftar are dummy entry points (Sprint 1 — no real auth).
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border/50 bg-background/80 px-lg backdrop-blur-md">
      <Link to={ROUTES.landing} className="flex items-center gap-2">
        <Icon name="auto_awesome" size={24} filled className="text-primary-container" />
        <span className="text-headline-md font-headline-md font-bold text-primary">VibeNovel</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link
          to={ROUTES.dashboard}
          className="hidden font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary md:block"
        >
          Masuk
        </Link>
        <Link
          to={ROUTES.start}
          className="font-label-md text-label-md rounded-lg bg-primary-container px-4 py-2 text-on-primary transition-colors hover:bg-primary-dark"
        >
          Daftar
        </Link>
      </div>
    </header>
  );
}