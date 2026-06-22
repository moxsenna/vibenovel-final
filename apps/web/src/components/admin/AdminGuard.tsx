import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { shouldUseMocks } from "@/lib/env";
import { ROUTES } from "@/routes/paths";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAdminCheck();
  const useMocks = shouldUseMocks();

  if (useMocks) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-lg text-on-background">
        <p className="font-body-md text-body-md text-muted-text" role="status">
          Memeriksa akses admin...
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
}