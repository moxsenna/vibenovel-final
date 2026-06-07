import {
  AmbientBackground,
  EditorPreviewMock,
  LandingHeader,
  LandingHero,
  ValuePropsSection,
} from "@/components/landing";

/**
 * Landing / Selamat Datang — Sprint 1 Task 1.4
 * Source: stitch-reference/vibenovel_selamat_datang_polished
 * No AppShell — standalone marketing page.
 */
export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-body-md text-on-surface selection:bg-primary-soft selection:text-primary-dark">
      <AmbientBackground />
      <LandingHeader />

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] max-w-dashboard flex-col items-center justify-center px-lg py-lg">
        <LandingHero />
        <EditorPreviewMock />
        <ValuePropsSection />
      </main>
    </div>
  );
}