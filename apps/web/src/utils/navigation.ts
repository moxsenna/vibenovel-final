import type { WorkflowPhase } from "@vibenovel/shared";
import { DEMO_PROJECT_ID } from "@/mocks/projects";
import { ROUTES } from "@/routes/paths";
import { resolveNavLocks } from "@/lib/workflow-truth";

export interface NavItemConfig {
  id: string;
  label: string;
  icon: string;
  to: string;
  filledWhenActive?: boolean;
  disabled?: boolean;
  lockHint?: string;
}

/** Sidebar navigation — Sprint 1 Task 1.3 (+ Task 10.26 real project routes) */
export function buildSidebarNavItems(
  projectId: string | null,
  workflowPhase?: WorkflowPhase | null,
): NavItemConfig[] {
  const locks = resolveNavLocks(workflowPhase);
  return [
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
      to: projectId ? ROUTES.project.foundation(projectId) : ROUTES.start,
      filledWhenActive: true,
      disabled: !projectId || !locks.foundation,
      lockHint: !locks.foundation ? "Selesaikan intake dan pilih konsep dulu." : undefined,
    },
    {
      id: "outline",
      label: "Outline",
      icon: "format_list_bulleted",
      to: projectId ? ROUTES.project.outline(projectId) : ROUTES.start,
      disabled: !projectId || !locks.outline,
      lockHint: !locks.outline ? "Kunci fondasi cerita terlebih dahulu." : undefined,
    },
    {
      id: "write",
      label: "Ruang Tulis",
      icon: "edit_note",
      to: projectId ? ROUTES.project.write(projectId) : ROUTES.start,
      disabled: !projectId || !locks.write,
      lockHint: !locks.write ? "Kunci outline terlebih dahulu." : undefined,
    },
    {
      id: "publish",
      label: "Paket Publish",
      icon: "auto_stories",
      to: projectId ? ROUTES.project.publish(projectId) : ROUTES.start,
      disabled: !projectId || !locks.publish,
      lockHint: "Belum tersedia di private beta.",
    },
    {
      id: "settings",
      label: "Pengaturan",
      icon: "settings",
      to: ROUTES.settings,
      filledWhenActive: true,
    },
  ];
}

/** Legacy static nav for mock-only tooling — prefer buildSidebarNavItems. */
export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = buildSidebarNavItems(DEMO_PROJECT_ID);

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