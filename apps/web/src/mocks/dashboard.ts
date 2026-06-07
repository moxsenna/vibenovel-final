import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

export type ProgressStepStatus = "done" | "current" | "pending";

export interface DashboardProgressStep {
  id: string;
  label: string;
  status: ProgressStepStatus;
}

export interface DashboardActiveProject {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  lastEditedLabel: string;
  statusBadge: string;
  currentChapter: number;
  writeRoute: string;
  progressSteps: DashboardProgressStep[];
}

export interface DashboardRecentProject {
  id: string;
  title: string;
  genre: string;
  genreBadgeClass: string;
  excerpt: string;
  lastEditedLabel: string;
  statusLabel: string;
  bookmarked?: boolean;
  route: string;
}

export interface DashboardUsageSummary {
  label: string;
  used: number;
  total: number;
}

/** Sprint 1 dashboard mock — replace with API in Sprint 2+ */
export const mockDashboardUsage: DashboardUsageSummary = {
  label: "Pemakaian AI Bulan Ini",
  used: 450,
  total: 1000,
};

export const mockDashboardActiveProject: DashboardActiveProject = {
  id: DEMO_PROJECT_ID,
  title: "Istri yang Mereka Buang",
  subtitle: "Kisah Nadira yang menemukan kebenaran perlahan",
  genre: "Drama Domestik",
  lastEditedLabel: "2 jam yang lalu",
  statusBadge: "Sedang Diedit",
  currentChapter: 1,
  writeRoute: ROUTES.project.write(DEMO_PROJECT_ID),
  progressSteps: [
    { id: "foundation", label: "Fondasi cerita selesai", status: "done" },
    { id: "outline", label: "Outline 10 bab siap", status: "done" },
    { id: "chapter", label: "Bab 1 sedang ditulis", status: "current" },
    { id: "publish", label: "Paket publish belum dibuat", status: "pending" },
  ],
};

export const mockDashboardRecentProjects: DashboardRecentProject[] = [
  {
    id: "demo-project-002",
    title: "Senja di Kaca Retak",
    genre: "Romansa",
    genreBadgeClass: "bg-accent-soft text-on-secondary-container",
    excerpt: "Kisah pertemuan tak terduga antara dua jiwa yang lelah di sudut kota lama.",
    lastEditedLabel: "2 hari lalu",
    statusLabel: "Bab 2",
    bookmarked: true,
    route: ROUTES.project.write("demo-project-002"),
  },
  {
    id: "demo-project-003",
    title: "Rahasia di Rumah Mertua",
    genre: "Drama Keluarga",
    genreBadgeClass: "bg-surface-container text-primary-dark",
    excerpt:
      "Nadira mulai menyadari keluarga suaminya menyimpan kebohongan lama yang perlahan menghancurkan rumah tangganya.",
    lastEditedLabel: "1 minggu lalu",
    statusLabel: "Outline",
    route: ROUTES.project.outline("demo-project-003"),
  },
  {
    id: "demo-project-004",
    title: "Bukan Istri Pilihan",
    genre: "Drama Domestik",
    genreBadgeClass: "bg-surface-dim text-on-surface-variant",
    excerpt:
      "Seorang istri yang selalu diremehkan akhirnya menemukan cara berdiri tegak tanpa kehilangan harga dirinya.",
    lastEditedLabel: "2 minggu lalu",
    statusLabel: "Fondasi cerita",
    route: ROUTES.project.foundation("demo-project-004"),
  },
];

export const DASHBOARD_GREETING = {
  title: "Halo, Penulis!",
  subtitle: "Siap lanjut menulis hari ini? Inspirasi sedang menunggumu.",
} as const;