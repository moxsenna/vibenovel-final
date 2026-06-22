import { Link, useLocation } from "react-router-dom";
import { Icon } from "@/components/ui";
import { ROUTES } from "@/routes/paths";

const NAV_ITEMS = [
  { path: ROUTES.admin.root, label: "Ringkasan", icon: "dashboard" as const },
  { path: ROUTES.admin.users, label: "Pengguna", icon: "group" as const },
  { path: ROUTES.admin.projects, label: "Proyek", icon: "folder" as const },
  { path: ROUTES.admin.proposals, label: "Proposal AI", icon: "auto_awesome" as const },
  { path: ROUTES.admin.generationAttempts, label: "Percobaan AI", icon: "smart_toy" as const },
  { path: ROUTES.admin.system, label: "Sistem", icon: "settings" as const },
  { path: ROUTES.admin.auditLogs, label: "Audit Log", icon: "history" as const },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <nav
      className="hidden md:flex fixed left-0 top-0 z-50 h-screen w-64 flex-col border-r border-border bg-surface p-md"
      aria-label="Navigasi admin"
    >
      <div className="mb-lg px-4 pt-4">
        <p className="font-label-sm text-label-sm uppercase tracking-wide text-muted-text">Narraza</p>
        <h1 className="font-headline-sm text-headline-sm text-on-surface">Admin</h1>
      </div>

      <div className="flex flex-1 flex-col gap-unit overflow-y-auto px-1">
        {NAV_ITEMS.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path !== ROUTES.admin.root && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 font-label-md text-label-md transition-colors",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-on-surface-variant hover:bg-surface-soft",
              ].join(" ")}
            >
              <Icon name={item.icon} className="text-[20px]" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto border-t border-border pt-sm px-1">
        <Link
          to={ROUTES.dashboard}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-label-md text-label-md text-on-surface-variant hover:bg-surface-soft"
        >
          <Icon name="arrow_back" className="text-[20px]" />
          Kembali ke App
        </Link>
      </div>
    </nav>
  );
}