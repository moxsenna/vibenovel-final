import { Icon } from "@/components/ui";

/** Decorative workspace preview — visual only, not interactive */
export function EditorPreviewMock() {
  return (
    <section className="relative mb-12 mt-8 w-full max-w-[960px]">
      <div className="relative z-10 rounded-2xl border border-border/60 bg-surface p-2 shadow-[0_8px_32px_rgba(31,41,51,0.06)] sm:p-4">
        <div className="mb-4 flex items-center justify-between border-b border-border px-2 pb-3">
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full bg-border" />
            <div className="h-3 w-3 rounded-full bg-border" />
            <div className="h-3 w-3 rounded-full bg-border" />
          </div>
          <div className="font-label-sm text-label-sm text-muted-text">
            Bab 1: Suamiku Pulang Membawa Masalah Baru
          </div>
          <Icon name="dock_to_right" size={18} className="text-muted-text" />
        </div>

        <div className="relative flex flex-col gap-6 md:flex-row">
          <div className="flex-1 rounded-xl border border-border/40 bg-background/50 p-4 md:p-8">
            <div className="mb-6 h-6 w-3/4 animate-pulse rounded-md bg-surface-variant" />
            <div className="mb-3 h-4 w-full animate-pulse rounded-md bg-surface-variant/60" />
            <div className="mb-3 h-4 w-full animate-pulse rounded-md bg-surface-variant/60" />
            <div className="mb-6 h-4 w-5/6 animate-pulse rounded-md bg-surface-variant/60" />
            <div className="mb-3 h-4 w-full animate-pulse rounded-md bg-surface-variant/60" />
            <div className="mb-3 h-4 w-4/5 animate-pulse rounded-md bg-surface-variant/60" />
            <div className="h-4 w-full animate-pulse rounded-md bg-surface-variant/60" />
          </div>

          <div className="flex w-full flex-col gap-3 md:w-64">
            <div className="rounded-xl border border-primary-fixed-dim bg-surface-soft p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Icon name="auto_awesome" size={16} className="text-primary-container" />
                <span className="font-label-sm text-label-sm text-primary-dark">Asisten Menulis</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Sikap mertua di bab ini bertentangan dengan deskripsi di Bab 3. Pertimbangkan
                untuk merevisi dialognya agar lebih pasif-agresif.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Icon name="menu_book" size={16} className="text-secondary" />
                <span className="font-label-sm text-label-sm text-on-surface">Story Bible</span>
              </div>
              <div className="mb-2 h-2 w-full rounded-md bg-border/50" />
              <div className="h-2 w-2/3 rounded-md bg-border/50" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-4 top-1/4 z-20 hidden items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-[0_4px_16px_rgba(31,41,51,0.08)] sm:flex lg:-right-12 animate-bounce [animation-duration:4s]">
        <span className="flex items-center justify-center rounded-full bg-tertiary p-1.5 text-success-soft">
          <Icon name="check_circle" size={16} filled className="text-on-tertiary" />
        </span>
        <span className="font-label-sm text-label-sm">Cerita Tetap Nyambung</span>
      </div>

      <div className="absolute -left-4 bottom-1/4 z-20 hidden items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-[0_4px_16px_rgba(31,41,51,0.08)] sm:flex lg:-left-8 [animation:bounce_5s_infinite_reverse]">
        <span className="flex items-center justify-center rounded-full bg-warning p-1.5 text-warning-soft">
          <Icon name="vpn_key" size={16} filled className="text-on-primary" />
        </span>
        <span className="font-label-sm text-label-sm">Rahasia Terjaga</span>
      </div>
    </section>
  );
}