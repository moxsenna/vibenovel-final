import type { StoryFoundation } from "@/types";
import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

const outlineRoute = ROUTES.project.outline(DEMO_PROJECT_ID);

/** Konsep: Istri yang Mereka Buang — Sprint 1 typed mock. TODO: Sprint 3+ Story Foundation API */
export const mockStoryFoundation: StoryFoundation = {
  projectId: DEMO_PROJECT_ID,
  readiness: {
    percent: 82,
    title: "Kesiapan Fondasi",
    statusLabel: "Hampir siap dikunci",
    hint: "Sebagian besar fondasi sudah lengkap. Lengkapi beberapa bagian sebelum lanjut ke outline.",
    missingItems: ["Rahasia cerita", "Target pembaca"],
  },
  premise:
    "Nadira, istri yang selama ini diremehkan keluarga suaminya, mulai curiga ketika jejak pengkhianatan Arman terkuak. Di tengah penghinaan dan tekanan, dia perlahan mengumpulkan bukti dan merencanakan bangkit.",
  mainCharacters: [
    {
      id: "char-001",
      name: "Nadira",
      role: "Tokoh Utama",
      description: "Istri yang diremehkan namun mulai bangkit dan mengambil kendali atas hidupnya.",
    },
    {
      id: "char-002",
      name: "Arman",
      role: "Suami",
      description: "Suami yang tidak membela Nadira dan menyimpan rahasia dari masa lalunya.",
    },
  ],
  supportingCharacters: [
    {
      id: "char-003",
      name: "Bu Siti",
      role: "Ibu Mertua",
      description: "Anggota keluarga yang kerap merendahkan Nadira di depan orang lain.",
    },
    {
      id: "char-004",
      name: "Siska",
      role: "Tokoh Penting",
      description: "Wanita dari masa lalu Arman yang kembali menghantui rumah tangga mereka.",
    },
  ],
  lockedFacts: [
    {
      id: "fact-001",
      label: "Tokoh utama",
      value: "Nadira adalah tokoh utama.",
      isLocked: true,
    },
    {
      id: "fact-002",
      label: "Suami",
      value: "Arman adalah suami yang tidak membela Nadira.",
      isLocked: true,
    },
    {
      id: "fact-003",
      label: "Keluarga",
      value: "Keluarga Arman meremehkan Nadira.",
      isLocked: true,
    },
    {
      id: "fact-004",
      label: "Akar konflik",
      value: "Konflik utama dimulai dari pengkhianatan dan penghinaan keluarga.",
      isLocked: true,
    },
  ],
  mainConflict:
    "Nadira terjebak antara bertahan demi anak-anak atau menghadapi pengkhianatan dan penghinaan keluarga — sambil membangun kekuatan untuk bangkit tanpa kehilangan harga dirinya.",
  readerPromiseItems: [
    "Pengkhianatan yang menusuk dan terasa dekat dengan kehidupan sehari-hari",
    "Proses bangkit yang perlahan tapi memuaskan dibaca",
    "Penyesalan orang yang pernah meremehkan Nadira",
    "Balas dendam emosional yang terasa adil, bukan instan",
  ],
  storySecretsPreview:
    "Siska bukan sekadar nama asing — dia terhubung dengan masa lalu Arman yang sengaja disembunyikan dari Nadira.",
  secretSchedule: [
    {
      id: "sched-001",
      chapterLabel: "Bab 1",
      description: "Petunjuk kecil bahwa Arman menyimpan sesuatu dari Nadira.",
    },
    {
      id: "sched-002",
      chapterLabel: "Bab 3",
      description: "Nadira menemukan bukti yang belum sepenuhnya ia pahami.",
    },
    {
      id: "sched-003",
      chapterLabel: "Bab 8",
      description: "Kaitan Siska dengan masa lalu Arman mulai terlihat.",
    },
    {
      id: "sched-004",
      chapterLabel: "Bab 12",
      description: "Pengkhianatan terbuka; Nadira memutuskan untuk bangkit.",
    },
  ],
  storyStyleTags: [
    "Drama Rumah Tangga",
    "Revenge Emosional",
    "POV Perempuan",
    "Serial Bab Pendek",
  ],
  outlineRoute,
  isLocked: false,
  pageCopy: {
    title: "Fondasi Cerita",
    subtitle:
      "Ringkasan arah cerita dari konsep yang kamu pilih. Kamu masih bisa meninjau dan menyesuaikan sebelum dikunci.",
    warningTitle: "Perhatian",
    warningBody:
      "Mengubah fondasi cerita nanti bisa memengaruhi outline dan bab berikutnya. Tinjau dulu bagian yang masih bisa diedit sebelum kamu mengunci.",
    warningNote: "Setelah dikunci, perubahan besar sebaiknya dilakukan dengan hati-hati.",
    lockCtaLabel: "Kunci Fondasi & Lanjut ke Outline",
  },
};