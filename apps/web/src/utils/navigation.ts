import { DEMO_PROJECT_ID } from "@/mocks/projects";
import { ROUTES } from "@/routes/paths";

export interface NavItemConfig {
  id: string;
  label: string;
  icon: string;
  to: string;
  filledWhenActive?: boolean;
}

/** Sidebar navigation — Sprint 1 Task 1.3 */
export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "dashboard",
    label: "Beranda",
    icon: "dashboard",
    to: ROUTES.dashboard,
    filledWhenActive: true,
  },
  {
    id: "start",
    label: "Mulai Proyek",
    icon: "rocket_launch",
    to: ROUTES.start,
  },
  {
    id: "foundation",
    label: "Fondasi Cerita",
    icon: "menu_book",
    to: ROUTES.project.foundation(DEMO_PROJECT_ID),
    filledWhenActive: true,
  },
  {
    id: "outline",
    label: "Outline",
    icon: "format_list_bulleted",
    to: ROUTES.project.outline(DEMO_PROJECT_ID),
  },
  {
    id: "write",
    label: "Ruang Tulis",
    icon: "edit_note",
    to: ROUTES.project.write(DEMO_PROJECT_ID),
  },
  {
    id: "publish",
    label: "Paket Publish",
    icon: "auto_stories",
    to: ROUTES.project.publish(DEMO_PROJECT_ID),
  },
  {
    id: "settings",
    label: "Pengaturan",
    icon: "settings",
    to: ROUTES.settings,
    filledWhenActive: true,
  },
];

/** Tooltip for Sprint 1 buttons that look actionable but are UI-only */
export const SPRINT1_UI_ONLY_HINT =
  "Belum tersedia di Sprint 1 — hanya tampilan UI demo.";

/**
 * Match active nav item to current pathname.
 * Project routes match by section (foundation, outline, write, etc.).
 */
export function isNavItemActive(itemPath: string, pathname: string): boolean {
  if (itemPath === pathname) {
    return true;
  }

  if (itemPath.startsWith("/projects/") && pathname.startsWith("/projects/")) {
    const itemSection = itemPath.split("/")[3];
    const pathSection = pathname.split("/")[3];

    if (itemSection === pathSection) {
      return true;
    }

    // Ringkasan Bab is part of the Ruang Tulis flow
    if (itemSection === "write" && pathSection === "summary") {
      return true;
    }

    return false;
  }

  // Intake & konsep berasal dari alur Mulai Proyek
  if (itemPath === ROUTES.start && pathname.startsWith("/projects/")) {
    const pathSection = pathname.split("/")[3];
    return pathSection === "intake" || pathSection === "concepts";
  }

  return false;
}