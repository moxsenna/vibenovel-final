/** Centralized route paths — Sprint 1 skeleton */
export const ROUTES = {
  landing: "/",
  login: "/login",
  start: "/start",
  dashboard: "/dashboard",
  settings: "/settings",
  creditTopup: "/credits/topup",
  creditTopupMockReturn: "/credits/topup/mock-return",
  project: {
    intake: (id: string) => `/projects/${id}/intake`,
    concepts: (id: string) => `/projects/${id}/concepts`,
    foundation: (id: string) => `/projects/${id}/foundation`,
    outline: (id: string) => `/projects/${id}/outline`,
    write: (id: string) => `/projects/${id}/write`,
    summary: (id: string) => `/projects/${id}/summary`,
    publish: (id: string) => `/projects/${id}/publish`,
  },
} as const;

export const PLACEHOLDER_ROUTES = [
  { path: ROUTES.landing, label: "Landing / Selamat Datang", stitch: "vibenovel_selamat_datang_polished" },
  { path: ROUTES.start, label: "Mulai Proyek Baru", stitch: "mulai_proyek_baru_polished" },
  { path: ROUTES.dashboard, label: "Dashboard Penulis", stitch: "dashboard_penulis_refined" },
  { path: ROUTES.project.intake(":id"), label: "Chat Story Agent Intake", stitch: "beri_tahu_ide_ceritamu_refined" },
  { path: ROUTES.project.concepts(":id"), label: "Pilihan Konsep Cerita", stitch: "pilihan_konsep_cerita_refined" },
  { path: ROUTES.project.foundation(":id"), label: "Fondasi Cerita", stitch: "fondasi_cerita_refined" },
  { path: ROUTES.project.outline(":id"), label: "Outline Cerita", stitch: "outline_cerita_natural_terms" },
  { path: ROUTES.project.write(":id"), label: "Ruang Tulis", stitch: "tulis_bab / tulis_bab_mobile_polished" },
  { path: ROUTES.project.summary(":id"), label: "Ringkasan Bab", stitch: "ringkasan_bab_drama_consistent" },
  { path: ROUTES.project.publish(":id"), label: "Paket Publish", stitch: "paket_publish_bab_kbm_optimized" },
  { path: ROUTES.settings, label: "Pengaturan Pemakaian", stitch: "pengaturan_pemakaian" },
] as const;