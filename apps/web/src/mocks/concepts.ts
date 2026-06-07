import type { StoryConcept } from "@/types";
import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

const foundationRoute = ROUTES.project.foundation(DEMO_PROJECT_ID);

/** Sprint 1 typed mock — 3 konsep dari intake dummy. TODO: Sprint 3 AI generation */
export const mockConcepts: StoryConcept[] = [
  {
    id: "concept-001",
    title: "Luka yang Dibayar Mahal",
    pitchShort:
      "Seorang istri yang bertahun-tahun menahan diri akhirnya menghadapi kebenaran tentang keluarga suaminya — setiap luka punya harganya, dan dia tidak lagi mau diam.",
    badgeLabel: "Drama Rumah Tangga / Emosional",
    badgeIcon: "favorite",
    badgeToneClass: "text-primary-dark",
    mainConflict:
      "Memilih antara mempertahankan rumah tangga demi anak-anak atau menuntut keadilan yang bisa menghancurkan segalanya.",
    readerPromise:
      "Perjalanan realistis seorang perempuan yang perlahan menemukan suara dan harga dirinya — tanpa keajaiban instan.",
    commercialStrength:
      "Konflik keluarga yang dekat dengan kehidupan sehari-hari; pembaca mudah merasa ikut dan ingin tahu apa yang dia lakukan selanjutnya.",
    decorativeAccent: "primary-soft",
    foundationRoute,
  },
  {
    id: "concept-002",
    title: "Setelah Aku Pergi",
    pitchShort:
      "Dia pergi membawa hati yang remuk. Bertahun-tahun kemudian, keputusan itu kembali menghantui semua orang yang pernah meremehkannya.",
    badgeLabel: "Drama Keluarga / Penyesalan",
    badgeIcon: "auto_awesome",
    badgeToneClass: "text-secondary",
    mainConflict:
      "Mantan istri yang bangkit harus berhadapan lagi dengan keluarga yang dulu merendahkannya — tanpa kehilangan kedamaian yang sudah dibangunnya.",
    readerPromise:
      "Momen baper dan penyesalan yang menyentuh; pembaca ingin tahu apakah ada ruang untuk pengampunan atau kebenaran yang lebih pahit.",
    commercialStrength:
      "Adegan konfrontasi emosional dan klimaks penyesalan yang bikin pembaca betah baca bab demi bab.",
    decorativeAccent: "secondary-container",
    featured: true,
    foundationRoute,
  },
  {
    id: "concept-003",
    title: "Istri yang Mereka Buang",
    pitchShort:
      "Diremehkan, dianggap lemah, lalu dibuang begitu saja — tapi dia bangkit dengan rencana yang tenang, mematikan, dan memuaskan.",
    badgeLabel: "Balas Dendam / Satisfying",
    badgeIcon: "local_fire_department",
    badgeToneClass: "text-tertiary-container",
    mainConflict:
      "Menjalankan pembalasan elegan tanpa kehilangan moral sebagai ibu dan perempuan yang ingin dihormati.",
    readerPromise:
      "Kemenangan kecil di tiap bab dan ending yang menggoda — pembaca ingin unlock bab berikutnya untuk melihat kejutan berikutnya.",
    commercialStrength:
      "Ritme revenge yang memuaskan dengan hook kuat di akhir bab; cocok untuk serial mobile yang dibaca bertahap.",
    decorativeAccent: "success-soft",
    foundationRoute,
  },
];

export const CONCEPTS_PAGE_COPY = {
  title: "Pilih Arah Ceritamu",
  subtitle:
    "Kami meramu 3 arah cerita dari obrolan tadi. Pilih yang paling cocok dengan rasa ceritamu — kamu bisa ubah lagi nanti di fondasi.",
} as const;