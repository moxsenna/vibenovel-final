import type { ChapterSummary } from "@/types";
import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

const publishRoute = ROUTES.project.publish(DEMO_PROJECT_ID);
const writeRoute = ROUTES.project.write(DEMO_PROJECT_ID);

/** Bab 1: Makan Malam yang Dingin — Sprint 1 typed mock. TODO: Sprint 6+ Chapter Delta extractor */
export const mockChapterSummary: ChapterSummary = {
  projectId: DEMO_PROJECT_ID,
  chapterNumber: 1,
  chapterTitle: "Makan Malam yang Dingin",
  status: "ready_for_review",
  synopsis:
    "Nadira berusaha menjaga makan malam tetap hangat, tetapi sindiran keluarga Arman membuat posisinya makin terlihat rapuh. Di akhir bab, sebuah pesan mencurigakan di ponsel Arman menambah kecurigaan tanpa membuka rahasia sepenuhnya.",
  newFacts: [
    {
      id: "fact-001",
      emphasis: "Nadira",
      text: "belum dihargai di keluarga Arman.",
    },
    {
      id: "fact-002",
      emphasis: "Arman",
      text: "memilih diam saat Nadira disudutkan.",
    },
    {
      id: "fact-003",
      text: "Ada pesan mencurigakan di ponsel Arman.",
    },
  ],
  characterChanges: [
    {
      id: "char-001",
      characterName: "Nadira",
      initial: "N",
      change: "mulai menahan diri dan mengamati, bukan langsung meledak.",
    },
    {
      id: "char-002",
      characterName: "Arman",
      initial: "A",
      change: "terlihat menghindari konflik dan gelisah saat ponselnya berbunyi.",
    },
  ],
  relationChanges: [
    {
      id: "rel-001",
      emphasis: "Nadira & keluarga Arman",
      text: "jarak emosional makin terasa di meja makan.",
    },
    {
      id: "rel-002",
      emphasis: "Nadira & Arman",
      text: "kepercayaan mulai retak setelah Arman tidak membela Nadira.",
    },
  ],
  miniVictories: [
    {
      id: "win-001",
      text: "Nadira tidak menangis di depan keluarga Arman.",
    },
    {
      id: "win-002",
      text: "Nadira mulai sadar ada yang tidak beres.",
    },
  ],
  heldSecrets: [
    {
      id: "secret-001",
      text: "Identitas perempuan di ponsel Arman belum dibuka penuh.",
    },
  ],
  openLoops: [
    { id: "loop-001", text: "Siapa pengirim pesan itu?" },
    { id: "loop-002", text: "Kenapa Arman terlihat gelisah?" },
    { id: "loop-003", text: "Apa yang akan Nadira lakukan setelah makan malam?" },
  ],
  storyCheckNotes: [
    {
      id: "check-001",
      status: "ok",
      label: "Cerita nyambung",
      detail: "Alur adegan di meja makan mengalir natural dari awal sampai hook ponsel.",
    },
    {
      id: "check-002",
      status: "ok",
      label: "Rahasia belum bocor",
      detail: "Nama pengirim pesan belum diungkap — cocok untuk bab berikutnya.",
    },
    {
      id: "check-003",
      status: "ok",
      label: "Format enak dibaca di HP",
      detail: "Paragraf cukup pendek dan dialog tidak terlalu panjang.",
    },
    {
      id: "check-004",
      status: "warning",
      label: "Ending perlu diperkuat",
      detail: "Hook ponsel sudah ada, tapi bisa ditambah satu kalimat reaksi Nadira agar penasaran makin kuat.",
    },
  ],
  publishRoute,
  writeRoute,
  pageCopy: {
    badgeLabel: "Bab Selesai",
    title: "Ringkasan Bab",
    subtitle: "Tinjau perkembangan cerita sebelum lanjut ke paket publish.",
    statusDraft: "Draft",
    statusReady: "Siap Ditinjau",
    approveCta: "Setujui & Buat Paket Publish",
    backToWriteCta: "Kembali ke Ruang Tulis",
  },
};