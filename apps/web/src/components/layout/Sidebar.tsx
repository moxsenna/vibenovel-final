import { Link } from "react-router-dom";
import { Icon } from "@/components/ui";
import { SHELL_MOCK } from "@/mocks/shell";
import { ROUTES } from "@/routes/paths";
import { SIDEBAR_NAV_ITEMS } from "@/utils/navigation";
import { NavItem } from "./NavItem";

/** Desktop sidebar — fixed left, w-64 (Stitch: dashboard_penulis_refined) */
export function Sidebar() {
  const mainItems = SIDEBAR_NAV_ITEMS.filter((item) => item.id !== "settings");
  const settingsItem = SIDEBAR_NAV_ITEMS.find((item) => item.id === "settings");

  return (
    <nav
      className="hidden md:flex fixed left-0 top-0 z-50 h-screen w-64 flex-col border-r border-border bg-surface p-md gap-2"
      aria-label="Navigasi utama"
    >
      <div className="mb-lg px-4 pt-4">
        <h1 className="text-headline-lg font-headline-lg font-bold text-primary">VibeNovel</h1>
        <p className="font-label-sm text-label-sm text-subtle-text mt-1">
          Workspace Penulis Serial
        </p>
      </div>

      <Link
        to={ROUTES.start}
        className="mb-md mx-4 flex w-auto items-center justify-center gap-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md py-3 px-4 hover:bg-primary-dark transition-colors shadow-sm min-h-[44px]"
      >
        <Icon name="add" size={18} />
        Proyek Baru
      </Link>

      <div className="mx-4 mb-md rounded-xl border border-border bg-surface-soft p-3">
        <p className="font-label-sm text-label-sm text-subtle-text uppercase tracking-wide">
          Proyek Aktif
        </p>
        <p className="font-label-md text-label-md text-on-surface truncate mt-1">
          {SHELL_MOCK.projectTitle}
        </p>
        <p className="font-label-sm text-label-sm text-primary mt-0.5">
          {SHELL_MOCK.projectStatus}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-unit overflow-y-auto px-1">
        {mainItems.map((item) => (
          <NavItem
            key={item.id}
            to={item.to}
            label={item.label}
            icon={item.icon}
            filledWhenActive={item.filledWhenActive}
          />
        ))}
      </div>

      <div className="mt-auto border-t border-border pt-sm">
        {settingsItem && (
          <NavItem
            to={settingsItem.to}
            label={settingsItem.label}
            icon={settingsItem.icon}
            filledWhenActive={settingsItem.filledWhenActive}
          />
        )}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-variant flex-shrink-0 flex items-center justify-center text-on-surface-variant">
            <Icon name="person" size={18} />
          </div>
          <div className="flex-grow overflow-hidden min-w-0">
            <p className="font-label-md text-label-md text-on-surface truncate">
              {SHELL_MOCK.userName}
            </p>
            <p className="font-label-sm text-label-sm text-subtle-text truncate">
              {SHELL_MOCK.planLabel}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}