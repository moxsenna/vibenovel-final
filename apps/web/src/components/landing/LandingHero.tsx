import { Link } from "react-router-dom";
import { Icon } from "@/components/ui";
import { ROUTES } from "@/routes/paths";

export function LandingHero() {
  return (
    <section className="mb-lg flex max-w-[800px] flex-col items-center text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-fixed bg-primary-soft px-4 py-2 font-label-sm text-label-sm text-primary-dark">
        <Icon name="edit_note" size={16} />
        <span>Workspace Penulis Serial</span>
      </div>

      <h1 className="mb-6 font-display text-display capitalize leading-tight text-on-surface">
        Menulis serial panjang jadi lebih{" "}
        <span className="relative inline-block text-primary-container">
          terarah
          <svg
            className="absolute -bottom-2 left-0 h-3 w-full text-primary-fixed"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 100 20"
            aria-hidden="true"
          >
            <path
              d="M0 10 Q 50 20 100 10"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="4"
            />
          </svg>
        </span>
        .
      </h1>

      <p className="mb-8 max-w-[640px] font-body-lg text-body-lg text-muted-text">
        Dari ide, fondasi cerita, outline, sampai bab siap publish — VibeNovel bantu
        menjaga alur, karakter, rahasia cerita, dan format bacaan HP.
      </p>

      <div className="flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
        <Link
          to={ROUTES.start}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-8 py-4 font-label-md text-label-md text-on-primary shadow-[0_8px_24px_rgba(159,79,104,0.2)] transition-all hover:bg-primary-dark sm:w-auto min-h-[44px]"
        >
          <span>Mulai Tulis Cerita</span>
          <Icon
            name="arrow_forward"
            size={18}
            className="transition-transform group-hover:translate-x-1"
          />
        </Link>
        <a
          href="#kenapa-vibenovel"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-8 py-4 font-label-md text-label-md text-on-surface transition-all hover:border-outline-variant hover:bg-surface-soft sm:w-auto min-h-[44px]"
        >
          <Icon name="play_circle" size={18} />
          <span>Lihat Cara Kerja</span>
        </a>
      </div>
    </section>
  );
}