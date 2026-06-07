import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

export interface StartProjectOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  iconFilled?: boolean;
  ctaLabel: string;
  to: string;
  badge?: string;
  /** Full-width card on desktop (Stitch bento prominent row) */
  prominent?: boolean;
}

/** Sprint 1 typed mock — entry flows from docs/02-user-personas-and-entry-flows.md */
export const mockStartProjectOptions: StartProjectOption[] = [
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
    to: ROUTES.project.intake(DEMO_PROJECT_ID),
    badge: "Cocok untuk pemula",
    prominent: true,
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
    to: ROUTES.project.intake(DEMO_PROJECT_ID),
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
    to: ROUTES.project.intake(DEMO_PROJECT_ID),
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
    to: ROUTES.project.outline(DEMO_PROJECT_ID),
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
    to: ROUTES.project.summary(DEMO_PROJECT_ID),
  },
];