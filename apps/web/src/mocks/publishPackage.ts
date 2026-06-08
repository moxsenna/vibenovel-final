import type { PublishPackage } from "@/types";
import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

/** Bab 1: Makan Malam yang Dingin — Sprint 1 typed mock; API mode via usePublishData (Task 7.4). */
export const mockPublishPackage: PublishPackage = {
  projectId: DEMO_PROJECT_ID,
  chapterNumber: 1,
  chapterTitle: "Makan Malam yang Dingin",
  title: "Bab 1: Makan Malam yang Dingin",
  blurb:
    "Nadira berusaha menjaga makan malam keluarga tetap harmonis, tetapi sindiran dan keheningan Arman membuat malam itu terasa semakin dingin — sampai satu pesan di ponsel mengubah segalanya.",
  teaser:
    "Nadira hanya ingin makan malam berjalan tenang. Tapi malam itu, satu pesan di ponsel Arman membuatnya sadar bahwa diamnya sang suami mungkin menyimpan sesuatu.",
  caption:
    "Di depan keluarga suaminya, Nadira berusaha tetap tersenyum. Namun ketika sindiran datang bertubi-tubi dan Arman memilih diam, Nadira mulai menyadari satu hal: mungkin selama ini ia sedang berjuang sendirian.",
  commentBait:
    "Kalau jadi Nadira, kamu akan langsung bertanya ke Arman atau diam-diam mencari bukti?",
  nextChapterTeaser:
    "Bab berikutnya, Nadira menemukan pesan yang membuatnya sulit tidur semalaman.",
  tags: [
    "drama rumah tangga",
    "istri tersakiti",
    "revenge emosional",
    "penyesalan suami",
    "keluarga toxic",
  ],
  checklist: [
    { id: "chk-001", label: "Teaser menggoda tanpa membuka rahasia besar", checked: true },
    { id: "chk-002", label: "Caption siap untuk sosial media", checked: true },
    { id: "chk-003", label: "Tag/genre sudah sesuai arah cerita", checked: true },
    { id: "chk-004", label: "Pertanyaan pembaca sudah ada", checked: true },
    { id: "chk-005", label: "Preview terbaca nyaman di layar HP", checked: true },
  ],
  mobilePreview: {
    appName: "Preview KBM",
    chapterLabel: "Bab 1 · Makan Malam yang Dingin",
    excerpt:
      "Nadira hanya ingin makan malam berjalan tenang. Tapi malam itu, satu pesan di ponsel Arman membuatnya sadar bahwa diamnya sang suami mungkin menyimpan sesuatu.",
    readMoreLabel: "Lanjut baca →",
  },
  dashboardRoute: ROUTES.dashboard,
  summaryRoute: ROUTES.project.summary(DEMO_PROJECT_ID),
  outlineRoute: ROUTES.project.outline(DEMO_PROJECT_ID),
  pageCopy: {
    badgeLabel: "Paket Publish",
    title: "Aset Publikasi: Bab 1",
    subtitle:
      "Materi siap salin untuk platform serial. Kamu bisa menyesuaikan lagi sebelum benar-benar tayang.",
    blurbLabel: "Sinopsis Pendek",
    titleLabel: "Judul Bab",
    teaserLabel: "Teaser Bab",
    captionLabel: "Caption Promosi",
    commentBaitLabel: "Pertanyaan untuk Pembaca",
    nextChapterLabel: "Teaser Bab Berikutnya",
    tagsLabel: "Tag / Genre",
    checklistTitle: "Checklist Sebelum Publish",
    mobilePreviewTitle: "Preview Mobile",
    dashboardCta: "Kembali ke Dashboard",
    summaryCta: "Kembali ke Ringkasan",
    nextChapterCta: "Lihat Outline Bab Berikutnya",
    nextChapterHint: "Menulis Bab 2 akan tersedia setelah kamu siap melanjutkan cerita.",
  },
};