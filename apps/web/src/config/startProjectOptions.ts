import { PROJECT_ENTRY_PATHS, type ProjectEntryPath } from "@vibenovel/shared";
import { DEMO_PROJECT_ID } from "@/mocks/projects";
import { ROUTES } from "@/routes/paths";

export type StartProjectTarget = "intake" | "outline" | "summary";

export interface StartProjectOptionDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  iconFilled?: boolean;
  ctaLabel: string;
  badge?: string;
  prominent?: boolean;
  entryPath: ProjectEntryPath;
  defaultTitle: string;
  target: StartProjectTarget;
  demoOnly?: boolean;
}

export const START_PROJECT_OPTIONS: StartProjectOptionDef[] = [
  {
    id: "no-idea",
    title: "Aku belum punya ide",
    description:
      "Mulai dari nol lewat obrolan hangat. Asisten bantu menangkap rasa ceritamu, lalu arahkan ke fondasi dan outline.",
    icon: "auto_awesome",
    iconBg: "bg-surface-container-low",
    iconColor: "text-secondary",
    iconFilled: true,
    ctaLabel: "Mulai dari nol",
    badge: "Cocok untuk pemula",
    prominent: true,
    entryPath: PROJECT_ENTRY_PATHS.no_idea,
    defaultTitle: "Cerita Baru",
    target: "intake",
  },
  {
    id: "rough-idea",
    title: "Aku punya ide kasar",
    description:
      "Kembangkan ide yang masih setengah matang — dari satu paragraf menjadi arah cerita yang lebih jelas.",
    icon: "edit_note",
    iconBg: "bg-warning-soft",
    iconColor: "text-warning",
    iconFilled: true,
    ctaLabel: "Kembangkan ide",
    entryPath: PROJECT_ENTRY_PATHS.rough_idea,
    defaultTitle: "Ide Kasar",
    target: "intake",
  },
  {
    id: "has-draft",
    title: "Aku sudah punya draft",
    description:
      "Lanjutkan naskah yang sudah ada. Kami bantu merapikan fondasi dan melanjutkan tulis bab berikutnya.",
    icon: "upload_file",
    iconBg: "bg-primary-soft",
    iconColor: "text-primary",
    ctaLabel: "Lanjutkan draft",
    entryPath: PROJECT_ENTRY_PATHS.has_draft,
    defaultTitle: "Draft Saya",
    target: "intake",
    badge: "Upload nyata — nanti",
  },
  {
    id: "has-outline",
    title: "Aku sudah punya outline",
    description:
      "Ubah outline jadi bab. Langsung ke daftar bab dan mulai menulis adegan per adegan.",
    icon: "format_list_bulleted",
    iconBg: "bg-accent-soft",
    iconColor: "text-secondary",
    ctaLabel: "Ke outline",
    entryPath: PROJECT_ENTRY_PATHS.has_outline,
    defaultTitle: "Outline Saya",
    target: "outline",
  },
  {
    id: "repair-only",
    title: "Aku hanya mau memperbaiki cerita",
    description:
      "Cek dan perbaiki cerita yang sudah ada — intisari bab, fakta baru, dan saran perbaikan.",
    icon: "auto_fix_high",
    iconBg: "bg-success-soft",
    iconColor: "text-tertiary-container",
    ctaLabel: "Cek cerita",
    entryPath: PROJECT_ENTRY_PATHS.repair_only,
    defaultTitle: "Perbaikan Cerita",
    target: "summary",
  },
];

export function resolveStartProjectRoute(
  projectId: string,
  target: StartProjectTarget,
): string {
  switch (target) {
    case "outline":
      return ROUTES.project.outline(projectId);
    case "summary":
      return ROUTES.project.summary(projectId);
    default:
      return ROUTES.project.intake(projectId);
  }
}

export function resolveDemoStartProjectRoute(target: StartProjectTarget): string {
  return resolveStartProjectRoute(DEMO_PROJECT_ID, target);
}