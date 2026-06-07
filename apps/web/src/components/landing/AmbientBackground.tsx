/** Soft ambient blobs — Stitch vibenovel_selamat_datang_polished */
export function AmbientBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute -right-[5%] -top-[10%] z-0 h-[40vw] w-[40vw] rounded-full opacity-40 blur-[80px]"
        style={{
          background: "radial-gradient(circle, var(--color-primary-soft) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-[20%] -left-[10%] z-0 h-[50vw] w-[50vw] rounded-full opacity-40 blur-[80px]"
        style={{
          background: "radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
    </>
  );
}