import { Outlet, useLocation } from "react-router-dom";
import { CreditIndicator } from "./CreditIndicator";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";

/**
 * App workspace shell — Sprint 1 Task 1.3
 * Desktop: sidebar + content. Mobile: top header + content.
 */
export function AppShell() {
  const location = useLocation();
  const isWriteRoute = location.pathname.includes("/write");

  return (
    <div
      className={[
        "flex overflow-x-hidden bg-background text-on-background antialiased",
        isWriteRoute ? "h-screen overflow-hidden" : "min-h-screen",
      ].join(" ")}
    >
      <Sidebar />

      <div
        className={[
          "flex w-full flex-1 flex-col md:ml-64",
          isWriteRoute ? "min-h-0 overflow-hidden" : "min-h-screen",
        ].join(" ")}
      >
        {!isWriteRoute && <MobileHeader />}

        {/* Desktop top bar — credits aligned right (Stitch dashboard pattern) */}
        <header className="hidden md:flex sticky top-0 z-40 h-16 shrink-0 items-center justify-end gap-sm border-b border-border bg-surface px-xl">
          <CreditIndicator />
        </header>

        <main
          className={
            isWriteRoute
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "mx-auto w-full max-w-dashboard flex-1 overflow-x-hidden p-lg pb-24 md:p-xl md:pb-xl"
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}