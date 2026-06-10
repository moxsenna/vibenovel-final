import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/routes/paths";
import { CreditIndicator } from "./CreditIndicator";

/** Mobile top bar — visible below md breakpoint (Stitch: dashboard_penulis_refined) */
export function MobileHeader() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-surface px-lg">
      <div className="flex items-center gap-2">
        <h1 className="text-headline-md font-headline-md font-bold text-primary tracking-tight">
          Narraza
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <CreditIndicator compact />
        {session ? (
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate(ROUTES.login));
            }}
            className="rounded-lg px-2 py-1 font-label-sm text-label-sm text-muted-text hover:text-primary min-h-[40px]"
            aria-label="Keluar dari akun"
          >
            Keluar
          </button>
        ) : (
          <Link
            to={ROUTES.login}
            className="flex h-10 items-center px-2 font-label-sm text-label-sm text-primary"
          >
            Masuk
          </Link>
        )}
      </div>
    </header>
  );
}