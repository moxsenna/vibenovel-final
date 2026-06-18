import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { ROUTES } from "@/routes/paths";

export function AdminShell() {
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const apiMode = !shouldUseMocks();

  if (apiMode && authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-lg text-on-background">
        <p className="font-body-md text-body-md text-muted-text">Memeriksa sesi...</p>
      </div>
    );
  }

  if (apiMode && !session) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background text-on-background antialiased">
      <AdminSidebar />
      <div className="flex w-full flex-1 flex-col md:ml-64">
        <header className="hidden md:flex sticky top-0 z-40 h-16 shrink-0 items-center border-b border-border bg-surface px-xl">
          <p className="font-label-md text-label-md text-muted-text">Kontrol operasional private beta</p>
        </header>
        <main className="mx-auto w-full max-w-dashboard flex-1 overflow-x-hidden p-lg pb-24 md:p-xl md:pb-xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}