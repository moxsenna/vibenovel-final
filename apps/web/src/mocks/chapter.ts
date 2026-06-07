import type { ChapterDraft } from "@/types";
import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

const summaryRoute = ROUTES.project.summary(DEMO_PROJECT_ID);

/** Bab 1: Makan Malam yang Dingin — Sprint 1 typed mock. TODO: Sprint 5+ writing API */
export const mockChapterDraft: ChapterDraft = {
  projectId: DEMO_PROJECT_ID,
  chapterNumber: 1,
  chapterTitle: "Makan Malam yang Dingin",
  chapterStatus: "draft",
  wordCount: 312,
  lastSavedLabel: "Tersimpan 2 menit lalu",
  summaryRoute,
  pageCopy: {
    sceneListTitle: "Daftar Adegan",
    assistantTitle: "Asisten AI",
    directionTitle: "Arahan Adegan",
    storyCheckTitle: "Cek Cerita",
    writeSceneAction: "Tulis Adegan Ini",
    strengthenEmotionAction: "Perkuat Emosi",
    addDialogAction: "Tambah Dialog",
    recheckLabel: "Cek Ulang Cerita",
    finishCta: "Selesai & Lihat Ringkasan Bab",
    previewLabel: "Pratinjau",
    saveLabel: "Simpan",
    mobileWorkspaceLabel: "Ruang Tulis",
    mobileDirectionLabel: "Arahan",
    mobileWriteAction: "Tulis",
    mobileFixAction: "Perbaiki",
    mobileCheckAction: "Cek",
    mobileSummaryCta: "Ringkasan",
    mobileCheckSheetTitle: "Cek Cerita",
  },
  beats: [
    {
      id: "beat-001",
      number: 1,
      title: "Nadira menyiapkan makan malam",
      summary:
        "Nadira sibuk di dapur sambil berusaha tampak tenang, padahal malam ini ada makan malam keluarga.",
      status: "draft",
      direction:
        "Tunjukkan rutinitas Nadira yang hafal di luar kepala — dia tahu apa yang diharapkan keluarga, tapi jangan buat dia terlihat lemah total.",
      prose:
        "Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala. Enam orang akan makan malam di rumah ini — dan semua hidangan harus tampak sempurna, seolah hidup mereka juga demikian.\n\nAroma sup ayam mengisi ruangan. Dia mengecek jam dinding: Arman belum pulang. Belum juga.\n\n\"Tinggal satu jam lagi,\" gumamnya, lebih kepada dirinya sendiri daripada kepada siapa pun.",
    },
    {
      id: "beat-002",
      number: 2,
      title: "Keluarga Arman datang",
      summary:
        "Tamu keluarga mulai berdatangan; suasana ramai tapi Nadira merasa seperti tamu di rumahnya sendiri.",
      status: "empty",
      direction:
        "Buat kontras antara keramaian dan kesendirian Nadira — dia sibuk melayani, tapi jarang dipanggil namanya.",
      prose:
        "Pintu depan dibuka sebelum Nadira sempat mengeringkan tangan. Suara tawa dan langkah kaki memenuhi ruang tamu.\n\n\"Nadira, minumannya mana?\" tanya seseorang tanpa menoleh.\n\nDia tersenyum. Senyum yang sudah dipakai terlalu sering malam seperti ini.",
    },
    {
      id: "beat-003",
      number: 3,
      title: "Sindiran mertua",
      summary:
        "Bu Siti menyindir Nadira di depan tamu dengan kalimat yang terdengar sopan tapi menusuk.",
      status: "empty",
      direction:
        "Sindiran harus terasa halus di permukaan, tajam di bawah — pembaca ikut merasakan malu yang ditahan Nadira.",
      prose:
        "\"Masih sama ya, Nadira?\" Bu Siti tertawa kecil sambil menyuap lauk. \"Kalau saya dulu, sudah pasti meja ini lebih rapi.\"\n\nBeberapa tamu ikut tertawa. Nadira menunduk ke piringnya, menghitung napas seperti yang sudah diajarkan bertahun-tahun.",
    },
    {
      id: "beat-004",
      number: 4,
      title: "Arman tidak membela Nadira",
      summary:
        "Sindiran makin tajam; Arman memilih diam dan mengalihkan topik.",
      status: "empty",
      direction:
        "Fokus pada keheningan Arman — bukan sekadar marah, tapi kecewa karena dia tidak berdiri di sisi Nadira.",
      prose:
        "Nadira menunggu. Satu pandangan. Satu kalimat kecil. Cukup satu.\n\nArman malah membuka topik kerja. \"Besok ada rapat penting,\" katanya, seolah malam ini hanya tentang jadwal.\n\nNadira menarik napas pelan. Dada sesak, tapi wajahnya tetap datar.",
    },
    {
      id: "beat-005",
      number: 5,
      title: "Pesan mencurigakan di ponsel",
      summary:
        "Saat makan malam hampir selesai, ponsel Arman bergetar — Nadira melihat nama yang tidak dikenalnya.",
      status: "empty",
      direction:
        "Akhiri dengan hook kuat: nama Siska terlihat sekilas, Arman buru-buru mematikan layar. Rahasia belum terbuka penuh.",
      prose:
        "Ponsel Arman bergetar di meja. Layar menyala setengah detik — cukup bagi Nadira untuk membaca dua huruf pertama dari sebuah nama.\n\nArman langsung membalikkan ponselnya. \"Laporan kerja,\" katanya cepat.\n\nTapi nadanya tidak meyakinkan. Dan malam yang sudah dingin terasa semakin dingin.",
    },
  ],
  storyChecks: [
    {
      id: "check-001",
      label: "Cerita nyambung",
      status: "ok",
      statusLabel: "Aman",
    },
    {
      id: "check-002",
      label: "Rahasia belum bocor",
      status: "ok",
      statusLabel: "Aman",
    },
    {
      id: "check-003",
      label: "Format enak dibaca di HP",
      status: "ok",
      statusLabel: "Aman",
    },
    {
      id: "check-004",
      label: "Ending perlu diperkuat",
      status: "warning",
      statusLabel: "Perlu Dicek",
      detail: "Adegan terakhir sudah menarik, tapi bisa ditambah satu kalimat penutup yang bikin penasaran.",
    },
  ],
};