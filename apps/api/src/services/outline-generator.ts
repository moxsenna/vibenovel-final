import {
  CHAPTER_EMOTIONS,
  CHAPTER_FUNCTIONS,
  CHAPTER_OUTLINE_STATUSES,
  FACT_IMPORTANCE,
  GENERATION_TYPES,
  OPEN_LOOP_STATUSES,
  OUTLINE_PLAN_STATUSES,
  PLANNED_REVEAL_STATUSES,
  REVEAL_RISK_LEVELS,
  RETENTION_MARKER_TYPES,
  WRITER_QUALITY_MODES,
  type ChapterEmotion,
  type ChapterFunction,
  type ChapterOutlineMarker,
  type FactImportance,
  type OpenLoopStatus,
  type RevealRiskLevel,
} from "@vibenovel/shared";
import type { OutlineCanonSnapshot } from "./outline-snapshot.js";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { generateWithModelRouter } from "./model-router.js";
import {
  CREDIT_LEDGER_REASONS,
  debitCreditsForAttempt,
  refundCreditsForAttempt,
} from "./credit-ledger.js";
import {
  createGenerationAttempt,
  markGenerationAttemptFailed,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
} from "./generation-attempt.js";
import { generateCorrelationId } from "./audit-snapshot.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";

export const GENERATOR_MARKER = "outline_stub_deterministic";

/** MVP Sprint 4 default — parity supabase/seed.sql (3 each). */
export const DEFAULT_OPEN_LOOP_COUNT = 3;
export const DEFAULT_PLANNED_REVEAL_COUNT = 3;
/** Sprint 4 API cap before Reveal Gate / CRUD tasks expand planning data. */
export const MAX_OPEN_LOOP_COUNT = 4;
export const MAX_PLANNED_REVEAL_COUNT = 4;

export interface ChapterDraft {
  chapterNumber: number;
  title: string;
  summary: string;
  purpose: string;
  chapterFunction: ChapterFunction;
  emotionalDirection: ChapterEmotion;
  hook: string;
  endingHook: string;
  miniVictory: string | null;
  markers: ChapterOutlineMarker[];
}

export interface OpenLoopDraft {
  question: string;
  readerFacingHint: string;
  openedChapterNumber: number;
  payoffChapterNumber: number | null;
  status: OpenLoopStatus;
  importance: FactImportance;
}

export interface PlannedRevealDraft {
  title: string;
  planningTruth: string;
  readerFacingHint: string;
  plannedChapterNumber: number | null;
  forbiddenBeforeChapter: number;
  status: "planned" | "armed";
  riskLevel: RevealRiskLevel;
  relatedFactId: string | null;
  relatedProposalId: string | null;
}

export interface OutlineGenerationDraft {
  seasonLabel: string;
  arcSummary: string;
  retentionSummary: string;
  planningNotes: string;
  chapters: ChapterDraft[];
  openLoops: OpenLoopDraft[];
  plannedReveals: PlannedRevealDraft[];
}

/** Parity baseline: apps/web/src/mocks/outline.ts (Bab 1–10). */
const MOCK_CHAPTER_BASE: Omit<ChapterDraft, "chapterNumber">[] = [
  {
    title: "Makan Malam yang Dingin",
    summary:
      "Nadira duduk di meja makan malam keluarga yang terasa dingin; sindiran halus dari ibu mertua membuatnya semakin kecil di kursinya.",
    purpose:
      "Perkenalkan dinamika keluarga dan posisi Nadira yang diremehkan tanpa langsung membuatnya korban total.",
    chapterFunction: CHAPTER_FUNCTIONS.setup,
    emotionalDirection: CHAPTER_EMOTIONS.curious,
    hook: "Meja makan malam terasa lebih dingin dari biasanya — dan Nadira mulai memperhatikan.",
    endingHook:
      "Arman mematikan ponselnya saat notifikasi berbunyi — Nadira melihat nama \"Siska\" sekilas sebelum layar gelap.",
    miniVictory: null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.emotional_payoff, label: "Emosi" },
      { type: RETENTION_MARKER_TYPES.reversal, label: "Konflik" },
      { type: RETENTION_MARKER_TYPES.open_loop, label: "Open Loop" },
    ],
  },
  {
    title: "Pesan di Ponsel Arman",
    summary:
      "Nadira tidak sengaja melihat pesan yang terhapus cepat, tapi cukup untuk membuat hatinya tidak tenang sepanjang malam.",
    purpose: "Tanam petunjuk pertama tanpa konfrontasi langsung — rahasia masih ditahan.",
    chapterFunction: CHAPTER_FUNCTIONS.escalation,
    emotionalDirection: CHAPTER_EMOTIONS.curious,
    hook: "Satu notifikasi yang terhapus terlalu cepat mengubah malam Nadira.",
    endingHook: 'Pesan yang sempat terbaca berakhir dengan kalimat: "Sampai jumpa besok."',
    miniVictory: null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.secret_hint, label: "Rahasia" },
      { type: RETENTION_MARKER_TYPES.open_loop, label: "Open Loop" },
    ],
  },
  {
    title: "Senyum yang Terlalu Akrab",
    summary:
      "Di acara keluarga, Nadira memperhatikan bagaimana Arman dan seorang wanita saling bertukar senyum yang terasa terlalu akrab.",
    purpose: "Naikkan ketegangan sosial tanpa membuka identitas wanita itu terlalu cepat.",
    chapterFunction: CHAPTER_FUNCTIONS.escalation,
    emotionalDirection: CHAPTER_EMOTIONS.anxious,
    hook: "Di tengah keramaian, satu senyum terasa salah — terlalu akrab untuk sekadar tamu.",
    endingHook:
      'Wanita itu memanggil Arman dengan nama kecil yang bukan "Sayang" — dan Nadira mendengarnya.',
    miniVictory: null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.reversal, label: "Konflik" },
      { type: RETENTION_MARKER_TYPES.secret_hint, label: "Rahasia" },
      { type: RETENTION_MARKER_TYPES.open_loop, label: "Open Loop" },
    ],
  },
  {
    title: "Sindiran yang Tak Dibela",
    summary:
      "Bu Siti menyinggung Nadira di depan tamu; Arman diam. Nadira tersenyum tipis — pertama kali ia tidak langsung menunduk.",
    purpose:
      "Tunjukkan Nadira sendirian di medan pertempuran rumah tangga, sekaligus isyarat agency kecil.",
    chapterFunction: CHAPTER_FUNCTIONS.conflict,
    emotionalDirection: CHAPTER_EMOTIONS.angry,
    hook: "Sindiran di depan tamu biasanya membuat Nadira menunduk — kali ini tidak.",
    endingHook:
      'Setelah tamu pulang, Nadira berkata pelan: "Kamu tidak perlu membelaku. Tapi jangan pura-pura tidak melihat."',
    miniVictory: null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.emotional_payoff, label: "Emosi" },
      { type: RETENTION_MARKER_TYPES.reversal, label: "Konflik" },
    ],
  },
  {
    title: "Nadira Mulai Diam",
    summary:
      "Nadira berhenti membela diri dengan argumen panjang dan memilih mengamati — diam bukan berarti menyerah.",
    purpose: "Tandai perubahan strategi Nadira: dari reaktif menjadi pengamat yang sadar.",
    chapterFunction: CHAPTER_FUNCTIONS.mini_victory,
    emotionalDirection: CHAPTER_EMOTIONS.hopeful,
    hook: "Nadira memilih diam — bukan karena kalah, tapi karena mulai mengamati.",
    endingHook:
      "Di buku catatannya, Nadira menulis daftar hal kecil yang selama ini diabaikan — halaman pertama penuh.",
    miniVictory: "Nadira mulai mengambil kendali atas dirinya dengan mengamati, bukan menyerah.",
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.mini_victory, label: "Kemenangan Kecil" },
    ],
  },
  {
    title: "Bukti Kecil di Laci",
    summary:
      "Nadira menemukan struk dan foto lama di laci Arman — belum cukup untuk konfrontasi, tapi cukup untuk keyakinan.",
    purpose: "Beri Nadira bukti tanpa membuka rahasia besar Siska terlalu dini.",
    chapterFunction: CHAPTER_FUNCTIONS.mini_victory,
    emotionalDirection: CHAPTER_EMOTIONS.satisfying,
    hook: "Laci yang selama ini dianggap biasa menyimpan jejak yang tidak cocok dengan cerita Arman.",
    endingHook: "Di balik foto, ada tanggal yang tidak cocok dengan cerita Arman soal masa lalunya.",
    miniVictory: "Nadira punya bukti kecil — bukti bahwa curigaannya tidak berimajinasi.",
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.secret_hint, label: "Rahasia" },
      { type: RETENTION_MARKER_TYPES.mini_victory, label: "Kemenangan Kecil" },
    ],
  },
  {
    title: "Siska Datang ke Rumah",
    summary:
      "Tamu tak diundang muncul di pintu — Nadira akhirnya mendengar nama itu diucapkan langsung di rumahnya sendiri.",
    purpose: "Eskalasi konflik; Siska masuk sebagai tokoh aktif tanpa reveal hubungan penuh.",
    chapterFunction: CHAPTER_FUNCTIONS.cliffhanger,
    emotionalDirection: CHAPTER_EMOTIONS.anxious,
    hook: "Bel pintu berbunyi — dan nama yang selama ini hanya berupa notifikasi kini hadir di depan mata.",
    endingHook:
      'Siska berkata santai: "Aku kira kamu sudah bilang ke istri kamu." Ruang tamu mendadak hening.',
    miniVictory: null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.reversal, label: "Konflik" },
      { type: RETENTION_MARKER_TYPES.cliffhanger, label: "Cliffhanger" },
      { type: RETENTION_MARKER_TYPES.open_loop, label: "Open Loop" },
    ],
  },
  {
    title: "Nadira Menahan Air Mata",
    summary:
      "Konfrontasi hampir pecah di depan keluarga; Nadira menahan air mata dan memilih pergi ke kamar.",
    purpose: "Puncak emosional awal tanpa reveal pengkhianatan penuh — rahasia masih ditahan.",
    chapterFunction: CHAPTER_FUNCTIONS.emotional_turn,
    emotionalDirection: CHAPTER_EMOTIONS.hurt,
    hook: "Air mata hampir jatuh di depan semua orang — Nadira memilih mundur ke kamar.",
    endingHook:
      'Arman menarik Nadira ke kamar dan berkata: "Besok kita bicara." Nadira mengangguk, tapi matanya sudah berbeda.',
    miniVictory: null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.emotional_payoff, label: "Emosi" },
    ],
  },
  {
    title: "Keputusan Pertama Nadira",
    summary:
      "Nadira membuat langkah pertama: menghubungi teman lama untuk minta saran soal dokumen rumah tangga.",
    purpose: "Tunjukkan Nadira mulai bertindak, bukan hanya menderita — agency yang konkret.",
    chapterFunction: CHAPTER_FUNCTIONS.mini_victory,
    emotionalDirection: CHAPTER_EMOTIONS.hopeful,
    hook: "Untuk pertama kalinya, Nadira menghubungi seseorang di luar keluarga untuk minta saran.",
    endingHook: 'Teman lamanya bilang: "Ada satu hal yang perlu kamu cek dulu sebelum konfrontasi."',
    miniVictory: "Nadira mengambil langkah konkret menuju rencana, bukan sekadar menderita.",
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.mini_victory, label: "Kemenangan Kecil" },
      { type: RETENTION_MARKER_TYPES.cliffhanger, label: "Cliffhanger" },
      { type: RETENTION_MARKER_TYPES.open_loop, label: "Open Loop" },
    ],
  },
  {
    title: "Malam Ketika Arman Pulang Terlambat",
    summary:
      "Arman pulang larut malam dengan alasan rapat; Nadira sudah menunggu di ruang tamu dengan daftar pertanyaan.",
    purpose: "Tutup arc 10 bab dengan open loop kuat menuju bab berikutnya.",
    chapterFunction: CHAPTER_FUNCTIONS.cliffhanger,
    emotionalDirection: CHAPTER_EMOTIONS.tense,
    hook: "Nadira menunggu di ruang tamu — daftar pertanyaan di tangannya sudah siap sebelum Arman membuka pintu.",
    endingHook:
      "Arman membuka jas dan struk restoran jatuh — bukan dari kantor, tapi dari tempat yang Nadira kenal.",
    miniVictory: null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.cliffhanger, label: "Cliffhanger" },
      { type: RETENTION_MARKER_TYPES.secret_hint, label: "Rahasia" },
      { type: RETENTION_MARKER_TYPES.open_loop, label: "Open Loop" },
    ],
  },
];

/** Seed-parity MVP templates (used by default). */
const MVP_OPEN_LOOP_TEMPLATES: Array<{
  question: string;
  hint: string;
  opened: number;
  payoff: number | null;
  status: OpenLoopStatus;
  importance: FactImportance;
}> = [
  {
    question: "Siapa Siska dan apa hubungannya dengan Arman?",
    hint: "Nama itu muncul di ponsel Arman — pembaca ingin tahu lebih.",
    opened: 1,
    payoff: 7,
    status: OPEN_LOOP_STATUSES.opened,
    importance: FACT_IMPORTANCE.core,
  },
  {
    question: "Apa isi pesan yang Arman hapus begitu cepat?",
    hint: 'Satu kalimat sempat terbaca — "Sampai jumpa besok."',
    opened: 2,
    payoff: 7,
    status: OPEN_LOOP_STATUSES.developed,
    importance: FACT_IMPORTANCE.major,
  },
  {
    question: "Apa yang akan terjadi saat Nadira konfrontasi Arman dengan daftar pertanyaannya?",
    hint: "Struk restoran jatuh dari jas Arman — konfrontasi tak terhindarkan.",
    opened: 10,
    payoff: null,
    status: OPEN_LOOP_STATUSES.opened,
    importance: FACT_IMPORTANCE.core,
  },
];

/** Extended pool — slice via `openLoopCount` (max 4) in future tasks; not default. */
const EXTENDED_OPEN_LOOP_TEMPLATES: typeof MVP_OPEN_LOOP_TEMPLATES = [
  { question: "Mengapa wanita itu memanggil Arman dengan nama kecil?", hint: "Bukan \"Sayang\".", opened: 3, payoff: 7, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.major },
  { question: "Apakah Arman sengaja tidak membela Nadira di depan tamu?", hint: "Diam saat Bu Siti menyinggung.", opened: 4, payoff: 8, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.major },
  { question: "Apa yang Nadira tulis di buku catatannya?", hint: "Halaman pertama penuh daftar hal kecil.", opened: 5, payoff: 9, status: OPEN_LOOP_STATUSES.developed, importance: FACT_IMPORTANCE.major },
  { question: "Apa arti tanggal di balik foto lama?", hint: "Tidak cocok dengan cerita Arman.", opened: 6, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.core },
  { question: "Apakah Arman sudah memberi tahu Nadira soal Siska?", hint: "Siska mengira istri sudah tahu.", opened: 7, payoff: 10, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.core },
  { question: "Apa yang akan dibicarakan Arman dan Nadira besok?", hint: "Janji bicara setelah konfrontasi tertahan.", opened: 8, payoff: 10, status: OPEN_LOOP_STATUSES.developed, importance: FACT_IMPORTANCE.major },
  { question: "Dokumen apa yang disarankan teman Nadira untuk dicek?", hint: "Sebelum konfrontasi penuh.", opened: 9, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.major },
  { question: "Dari restoran mana struk yang jatuh dari jas Arman?", hint: "Bukan dari kantor.", opened: 10, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.core },
  { question: "Mengapa Bu Siti konsisten meremehkan Nadira?", hint: "Sindiran berulang di meja makan.", opened: 1, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.minor },
  { question: "Apakah Arman menyembunyikan riwayat chat dengan Siska?", hint: "Ponsel dimatikan cepat.", opened: 2, payoff: 6, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.major },
  { question: "Siapa wanita yang tersenyum akrab di acara keluarga?", hint: "Belum disebut namanya di Bab 3.", opened: 3, payoff: 7, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.major },
  { question: "Apakah Nadira akan tetap diam atau mulai bertanya?", hint: "Agency kecil di Bab 4–5.", opened: 4, payoff: 5, status: OPEN_LOOP_STATUSES.developed, importance: FACT_IMPORTANCE.minor },
  { question: "Apa isi struk yang ditemukan Nadira di laci?", hint: "Bukti kecil sebelum konfrontasi.", opened: 6, payoff: 10, status: OPEN_LOOP_STATUSES.developed, importance: FACT_IMPORTANCE.major },
  { question: "Mengapa Siska datang tanpa diundang?", hint: "Kunjungan tak terduga ke rumah.", opened: 7, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.major },
  { question: "Apakah keluarga Arman tahu soal Siska?", hint: "Reaksi hening di ruang tamu.", opened: 7, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.minor },
  { question: "Apakah Nadira akan menangis di depan umum lagi?", hint: "Bab 8 — ia menahan diri.", opened: 8, payoff: 9, status: OPEN_LOOP_STATUSES.developed, importance: FACT_IMPORTANCE.minor },
  { question: "Siapa teman lama yang dihubungi Nadira?", hint: "Saran soal dokumen rumah tangga.", opened: 9, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.minor },
  { question: "Apakah Arman benar-benar dari rapat?", hint: "Pulang larut malam Bab 10.", opened: 10, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.major },
  { question: "Apakah Nadira sudah siap konfrontasi penuh?", hint: "Daftar pertanyaan di ruang tamu.", opened: 10, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.core },
  { question: "Apakah ada bukti lain selain foto dan struk?", hint: "Nadira mengumpulkan hal kecil.", opened: 5, payoff: 6, status: OPEN_LOOP_STATUSES.developed, importance: FACT_IMPORTANCE.minor },
  { question: "Bagaimana reaksi Arman saat Nadira mulai diam?", hint: "Perubahan strategi Nadira.", opened: 5, payoff: 8, status: OPEN_LOOP_STATUSES.developed, importance: FACT_IMPORTANCE.minor },
  { question: "Apakah rahasia Siska akan terbuka dalam 10 bab ini?", hint: "Arc awal menahan reveal penuh.", opened: 1, payoff: null, status: OPEN_LOOP_STATUSES.opened, importance: FACT_IMPORTANCE.core },
];

const OPEN_LOOP_TEMPLATE_POOL = [...MVP_OPEN_LOOP_TEMPLATES, ...EXTENDED_OPEN_LOOP_TEMPLATES];

/** Seed-parity MVP reveal schedule (planner-only truth). */
const MVP_REVEAL_TEMPLATES: Array<{
  title: string;
  truth: string;
  hint: string;
  planned: number | null;
  forbidden: number;
  risk: RevealRiskLevel;
}> = [
  {
    title: "Identitas dan hubungan Siska",
    truth:
      "Siska adalah mantan kekasih Arman yang masih memiliki ikatan rahasia dan kepentingan emosional; hubungan mereka disembunyikan dari Nadira sejak awal pernikahan.",
    hint: "Pembaca hanya melihat nama dan gelagat akrab — bukan kebenaran penuh.",
    planned: null,
    forbidden: 11,
    risk: REVEAL_RISK_LEVELS.high,
  },
  {
    title: "Masa lalu romantis Arman yang disembunyikan",
    truth:
      "Arman pernah memiliki hubungan serius dengan Siska yang berakhir tidak bersih; dokumen dan foto di laci adalah sisa jejak yang ia sembunyikan.",
    hint: "Foto lama dan tanggal yang tidak cocok — breadcrumb aman di Bab 6.",
    planned: 6,
    forbidden: 11,
    risk: REVEAL_RISK_LEVELS.high,
  },
  {
    title: "Pengkhianatan penuh belum terbuka di 10 bab awal",
    truth:
      "Konfrontasi penuh dan pengakuan pengkhianatan ditunda hingga setelah Bab 10; arc awal hanya menahan ketegangan dan breadcrumb.",
    hint: "Rahasia ditahan — identitas Siska dan pengkhianatan penuh belum terbuka.",
    planned: null,
    forbidden: 11,
    risk: REVEAL_RISK_LEVELS.medium,
  },
];

/** Extended pool — slice via `plannedRevealCount` (max 4) in future tasks; not default. */
const EXTENDED_REVEAL_TEMPLATES: typeof MVP_REVEAL_TEMPLATES = [
  { title: "Notifikasi Siska di ponsel Arman", truth: "Arman masih berkomunikasi rutin dengan Siska; notifikasi yang dimatikan adalah pesan janji pertemuan.", hint: "Nama Siska sekilas di layar.", planned: 1, forbidden: 3, risk: REVEAL_RISK_LEVELS.medium },
  { title: "Pesan \"Sampai jumpa besok\"", truth: "Pesan itu adalah konfirmasi pertemuan rahasia Arman-Siska keesokan harinya.", hint: "Satu kalimat sempat terbaca.", planned: 2, forbidden: 7, risk: REVEAL_RISK_LEVELS.medium },
  { title: "Nama kecil yang bukan Sayang", truth: "Siska memanggil Arman dengan nama panggilan masa pacaran yang tidak pernah Nadira dengar.", hint: "Senyum terlalu akrab di acara keluarga.", planned: 3, forbidden: 7, risk: REVEAL_RISK_LEVELS.medium },
  { title: "Ketidakberanian Arman membela istri", truth: "Arman sengaja diam di depan keluarga agar konflik dengan ibunya tidak memperburuk posisi bisnis/keluarga.", hint: "Arman diam saat Bu Siti menyinggung.", planned: 4, forbidden: 8, risk: REVEAL_RISK_LEVELS.low },
  { title: "Strategi observasi Nadira", truth: "Nadira mulai dokumentasi sistematis perilaku Arman dan interaksi keluarga sebagai persiapan bukti.", hint: "Buku catatan penuh di Bab 5.", planned: 5, forbidden: 9, risk: REVEAL_RISK_LEVELS.low },
  { title: "Foto dan struk di laci", truth: "Bukti fisik menunjukkan Arman berbohong soal perjalanan bisnis dan masa lalu dengan Siska.", hint: "Tanggal tidak cocok dengan cerita.", planned: 6, forbidden: 11, risk: REVEAL_RISK_LEVELS.high },
  { title: "Kunjungan Siska tanpa undangan", truth: "Siska datang karena Arman menunda memberi tahu Nadira — Siska kehilangan kesabaran.", hint: "Tamu tak diundang di Bab 7.", planned: 7, forbidden: 11, risk: REVEAL_RISK_LEVELS.high },
  { title: "Janji bicara besok", truth: "Arman menunda konfrontasi untuk membersihkan jejak komunikasi dengan Siska terlebih dahulu.", hint: "Besok kita bicara.", planned: 8, forbidden: 10, risk: REVEAL_RISK_LEVELS.medium },
  { title: "Saran teman soal dokumen", truth: "Dokumen pernikahan dan aset rumah tangga menyimpan ketidaksesuaian yang bisa jadi bukti hukum.", hint: "Cek dokumen sebelum konfrontasi.", planned: 9, forbidden: 11, risk: REVEAL_RISK_LEVELS.medium },
  { title: "Struk restoran bukan kantor", truth: "Arman bertemu Siska di restoran yang sama malam rapat palsu — bukti ketidakjujuran langsung.", hint: "Struk jatuh dari jas.", planned: 10, forbidden: 11, risk: REVEAL_RISK_LEVELS.high },
  { title: "Rahasia keluarga Arman soal Siska", truth: "Sebagian keluarga Arman mengetahui keberadaan Siska dan memilih diam demi reputasi.", hint: "Reaksi hening saat Siska datang.", planned: null, forbidden: 12, risk: REVEAL_RISK_LEVELS.high },
  { title: "Motif Bu Siti meremehkan Nadira", truth: "Bu Siti menganggap Nadira tidak cukup berstatus untuk menantu keluarga Arman.", hint: "Sindiran berulang sejak awal.", planned: null, forbidden: 11, risk: REVEAL_RISK_LEVELS.low },
  { title: "Siska tahu Nadira belum diberi tahu", truth: "Siska sengaja datang agar kebenaran terpaksa terbuka — Arman terlalu lama menunda.", hint: "Aku kira kamu sudah bilang ke istri.", planned: 7, forbidden: 11, risk: REVEAL_RISK_LEVELS.high },
  { title: "Mini victory Nadira Bab 5", truth: "Nadira pertama kali menolut strategi diam sebagai kelemahan — ini titik balik agency.", hint: "Buku catatan penuh.", planned: 5, forbidden: 6, risk: REVEAL_RISK_LEVELS.low },
  { title: "Mini victory bukti Bab 6", truth: "Bukti kecil memberi Nadira legitimasi emosional — ia tidak lagi merasa berimajinasi.", hint: "Foto dan struk.", planned: 6, forbidden: 7, risk: REVEAL_RISK_LEVELS.low },
  { title: "Mini victory langkah Bab 9", truth: "Nadira menghubungi jaringan luar keluarga — pertama kali ia bertindak tanpa izin Arman.", hint: "Teman lama dan dokumen.", planned: 9, forbidden: 10, risk: REVEAL_RISK_LEVELS.low },
  { title: "Cliffhanger Bab 10 menuju Bab 11", truth: "Konfrontasi penuh di ruang tamu akan membuka rantai pengkhianatan yang ditahan 10 bab.", hint: "Struk restoran dan daftar pertanyaan.", planned: 10, forbidden: 11, risk: REVEAL_RISK_LEVELS.medium },
  { title: "Rahasia proposal AI terkait Siska", truth: "Proposal rahasia di queue belum dipromosikan ke facts — outline hanya menjadwalkan reveal, tidak menulis canon.", hint: "Jadwal rahasia di foundation.", planned: null, forbidden: 11, risk: REVEAL_RISK_LEVELS.high },
  { title: "POV Nadira sebagai pengamat", truth: "Seluruh arc 10 bab difilter melalui observasi Nadira — pembaca belum tahu versi Arman/Siska.", hint: "Agency melalui pengamatan.", planned: null, forbidden: 11, risk: REVEAL_RISK_LEVELS.low },
  { title: "Payoff open loop Siska Bab 7", truth: "Pertanyaan siapa Siska mendapat jawaban parsial saat ia hadir — bukan kebenaran penuh.", hint: "Nama diucapkan di rumah.", planned: 7, forbidden: 11, risk: REVEAL_RISK_LEVELS.medium },
  { title: "Arc revenge/satisfying belum puncak", truth: "Kemenangan besar Nadira ditunda setelah Bab 10; arc awal fokus pada bukti dan ketegangan.", hint: "3 mini victory dalam 10 bab.", planned: null, forbidden: 11, risk: REVEAL_RISK_LEVELS.low },
];

const REVEAL_TEMPLATE_POOL = [...MVP_REVEAL_TEMPLATES, ...EXTENDED_REVEAL_TEMPLATES];

function clampPlanningCount(
  value: number | undefined,
  defaultCount: number,
  maxCount: number,
): number {
  if (value === undefined) return defaultCount;
  if (!Number.isInteger(value) || value < 1) return defaultCount;
  return Math.min(value, maxCount);
}

function buildOpenLoopDrafts(
  templates: typeof MVP_OPEN_LOOP_TEMPLATES,
  maxChapter: number,
): OpenLoopDraft[] {
  return templates.map((item) => ({
    question: item.question,
    readerFacingHint: item.hint,
    openedChapterNumber: Math.min(item.opened, maxChapter),
    payoffChapterNumber:
      item.payoff !== null && item.payoff <= maxChapter ? item.payoff : null,
    status: item.status,
    importance: item.importance,
  }));
}

function buildPlannedRevealDrafts(
  templates: typeof MVP_REVEAL_TEMPLATES,
  snapshot: OutlineCanonSnapshot,
  maxChapter: number,
): PlannedRevealDraft[] {
  const secretFact = snapshot.facts.find((f) => f.category === "secret");

  return templates.map((item, index) => ({
    title: item.title,
    planningTruth: item.truth,
    readerFacingHint: item.hint,
    plannedChapterNumber:
      item.planned !== null && item.planned <= maxChapter ? item.planned : null,
    forbiddenBeforeChapter: item.forbidden,
    status: index === 2 ? PLANNED_REVEAL_STATUSES.armed : PLANNED_REVEAL_STATUSES.planned,
    riskLevel: item.risk,
    relatedFactId: index === 0 ? (secretFact?.id ?? null) : null,
    relatedProposalId: null,
  }));
}

function buildExtensionChapter(number: number, snapshot: OutlineCanonSnapshot): ChapterDraft {
  const protagonist = snapshot.characters.find((c) => c.role === "protagonist")?.name ?? "Protagonis";
  return {
    chapterNumber: number,
    title: `Bab ${number}: Eskalasi ${protagonist}`,
    summary: `Bab ${number} melanjutkan konflik rumah tangga dan rencana balas dendam ${protagonist} setelah cliffhanger Bab 10.`,
    purpose: `Naikkan taruhan dan jaga retention tanpa filler — setiap bab punya fungsi jelas menuju konfrontasi berikutnya.`,
    chapterFunction:
      number % 3 === 0 ? CHAPTER_FUNCTIONS.cliffhanger : CHAPTER_FUNCTIONS.escalation,
    emotionalDirection:
      number % 2 === 0 ? CHAPTER_EMOTIONS.tense : CHAPTER_EMOTIONS.hopeful,
    hook: `Setelah Bab ${number - 1}, ${protagonist} menghadapi konsekuensi baru yang tidak bisa diabaikan.`,
    endingHook: `Di penutup Bab ${number}, satu detail baru memaksa pembaca ingin lanjut — tanpa reveal penuh terlalu cepat.`,
    miniVictory: number % 4 === 0 ? `${protagonist} mendapat kemenangan kecil yang terukur.` : null,
    markers: [
      { type: RETENTION_MARKER_TYPES.hook, label: "Hook" },
      { type: RETENTION_MARKER_TYPES.open_loop, label: "Open Loop" },
      ...(number % 3 === 0
        ? [{ type: RETENTION_MARKER_TYPES.cliffhanger, label: "Cliffhanger" }]
        : []),
      ...(number % 4 === 0
        ? [{ type: RETENTION_MARKER_TYPES.mini_victory, label: "Kemenangan Kecil" }]
        : []),
    ],
  };
}

function buildChapters(targetCount: number, snapshot: OutlineCanonSnapshot): ChapterDraft[] {
  const chapters: ChapterDraft[] = [];
  for (let i = 1; i <= targetCount; i += 1) {
    if (i <= MOCK_CHAPTER_BASE.length) {
      chapters.push({ chapterNumber: i, ...MOCK_CHAPTER_BASE[i - 1] });
    } else {
      chapters.push(buildExtensionChapter(i, snapshot));
    }
  }
  return chapters;
}

function computeRetentionSummary(chapters: ChapterDraft[], loopCount: number): string {
  const hookCount = chapters.filter((ch) =>
    ch.markers.some((m) => m.type === RETENTION_MARKER_TYPES.hook),
  ).length;
  const miniVictoryCount = chapters.filter((ch) => ch.miniVictory).length;
  return `${hookCount} dari ${chapters.length} bab punya hook; ${miniVictoryCount} mini victory; ${loopCount} open loop dilacak; cliffhanger kuat di Bab ${chapters.length}.`;
}

function defaultArcSummary(snapshot: OutlineCanonSnapshot): string {
  const premise = snapshot.foundation.premise?.trim();
  const conflict = snapshot.foundation.main_conflict?.trim();
  const pitch = snapshot.concept.short_pitch?.trim();
  if (premise && conflict) {
    return `${premise} ${conflict}`.slice(0, 800);
  }
  if (pitch) return pitch.slice(0, 800);
  return "Sepuluh bab pertama mengantar protagonis dari posisi diremehkan menjadi pengamat yang mulai mengumpulkan bukti dan keberanian.";
}

function defaultSeasonLabel(targetCount: number): string {
  return targetCount === 10 ? "Bab 1–10: Awal Konflik" : `Bab 1–${targetCount}: Awal Konflik`;
}

export function generateOutlineDraft(
  snapshot: OutlineCanonSnapshot,
  options: {
    targetChapterCount: number;
    seasonLabel?: string;
    arcSummary?: string;
    /** Internal override — capped at MAX_OPEN_LOOP_COUNT (default 3). */
    openLoopCount?: number;
    /** Internal override — capped at MAX_PLANNED_REVEAL_COUNT (default 3). */
    plannedRevealCount?: number;
  },
): OutlineGenerationDraft {
  const chapters = buildChapters(options.targetChapterCount, snapshot);
  const maxChapter = options.targetChapterCount;

  const loopCount = clampPlanningCount(
    options.openLoopCount,
    DEFAULT_OPEN_LOOP_COUNT,
    MAX_OPEN_LOOP_COUNT,
  );
  const revealCount = clampPlanningCount(
    options.plannedRevealCount,
    DEFAULT_PLANNED_REVEAL_COUNT,
    MAX_PLANNED_REVEAL_COUNT,
  );

  const openLoops = buildOpenLoopDrafts(
    OPEN_LOOP_TEMPLATE_POOL.slice(0, loopCount),
    maxChapter,
  );
  const plannedReveals = buildPlannedRevealDrafts(
    REVEAL_TEMPLATE_POOL.slice(0, revealCount),
    snapshot,
    maxChapter,
  );

  const arcSummary = options.arcSummary?.trim() || defaultArcSummary(snapshot);
  const seasonLabel = options.seasonLabel?.trim() || defaultSeasonLabel(options.targetChapterCount);

  return {
    seasonLabel,
    arcSummary,
    retentionSummary: computeRetentionSummary(chapters, openLoops.length),
    planningNotes: `Generated by ${GENERATOR_MARKER} — planner-only, not prose. Source concept: ${snapshot.concept.title}.`,
    chapters,
    openLoops,
    plannedReveals,
  };
}

// --- Sprint 13.2: real AI outline generation ---

const OUTLINE_AI_CREDIT_COST = 3;
const CHAPTER_FUNCTION_SET = new Set<string>(Object.values(CHAPTER_FUNCTIONS));
const CHAPTER_EMOTION_SET = new Set<string>(Object.values(CHAPTER_EMOTIONS));
const FACT_IMPORTANCE_SET = new Set<string>(Object.values(FACT_IMPORTANCE));
const REVEAL_RISK_SET = new Set<string>(Object.values(REVEAL_RISK_LEVELS));

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null;
}

function stripOutlineFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  else if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  return t.trim();
}

/** Markers derived from chapter fields (keeps AI output small + enum-safe). */
function deriveMarkers(ch: {
  hook: string;
  endingHook: string;
  miniVictory: string | null;
  chapterFunction: ChapterFunction;
}): ChapterOutlineMarker[] {
  const markers: ChapterOutlineMarker[] = [];
  if (ch.hook) markers.push({ type: RETENTION_MARKER_TYPES.hook, label: "Hook" });
  if (ch.miniVictory) markers.push({ type: RETENTION_MARKER_TYPES.mini_victory, label: "Mini Victory" });
  if (ch.endingHook) markers.push({ type: RETENTION_MARKER_TYPES.cliffhanger, label: "Cliffhanger" });
  if (ch.chapterFunction === CHAPTER_FUNCTIONS.reveal)
    markers.push({ type: RETENTION_MARKER_TYPES.secret_hint, label: "Secret" });
  if (markers.length === 0) markers.push({ type: RETENTION_MARKER_TYPES.hook, label: "Hook" });
  return markers;
}

/** Maps AI JSON to OutlineGenerationDraft with strict enum validation. */
function buildOutlineDraftFromAi(
  parsed: Record<string, unknown>,
  snapshot: OutlineCanonSnapshot,
  targetCount: number,
): OutlineGenerationDraft {
  const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
  const chapters: ChapterDraft[] = [];
  for (let i = 0; i < Math.min(rawChapters.length, targetCount); i += 1) {
    const raw = rawChapters[i];
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const chapterFunction = (CHAPTER_FUNCTION_SET.has(str(c.chapterFunction))
      ? str(c.chapterFunction)
      : CHAPTER_FUNCTIONS.setup) as ChapterFunction;
    const emotionalDirection = (CHAPTER_EMOTION_SET.has(str(c.emotionalDirection))
      ? str(c.emotionalDirection)
      : CHAPTER_EMOTIONS.curious) as ChapterEmotion;
    const miniVictoryRaw = str(c.miniVictory);
    const miniVictory =
      miniVictoryRaw && miniVictoryRaw.toLowerCase() !== "null" ? miniVictoryRaw : null;
    const base = {
      title: str(c.title, `Bab ${i + 1}`).slice(0, 200),
      summary: str(c.summary).slice(0, 600),
      purpose: str(c.purpose).slice(0, 400),
      chapterFunction,
      emotionalDirection,
      hook: str(c.hook).slice(0, 400),
      endingHook: str(c.endingHook).slice(0, 400),
      miniVictory: miniVictory ? miniVictory.slice(0, 400) : null,
    };
    chapters.push({
      chapterNumber: i + 1,
      ...base,
      markers: deriveMarkers(base),
    });
  }

  // Fall back to deterministic chapters if AI returned too few (keeps a valid plan).
  if (chapters.length < Math.min(2, targetCount)) {
    return generateOutlineDraft(snapshot, { targetChapterCount: targetCount });
  }
  const maxChapter = chapters.length;

  const rawLoops = Array.isArray(parsed.openLoops) ? parsed.openLoops.slice(0, MAX_OPEN_LOOP_COUNT) : [];
  const openLoops: OpenLoopDraft[] = [];
  for (const raw of rawLoops) {
    if (!raw || typeof raw !== "object") continue;
    const l = raw as Record<string, unknown>;
    const question = str(l.question);
    if (!question) continue;
    const opened = Math.min(Math.max(num(l.openedChapterNumber) ?? 1, 1), maxChapter);
    const payoffRaw = num(l.payoffChapterNumber);
    const payoff = payoffRaw && payoffRaw > opened ? Math.min(payoffRaw, maxChapter) : null;
    openLoops.push({
      question: question.slice(0, 300),
      readerFacingHint: str(l.readerFacingHint).slice(0, 300),
      openedChapterNumber: opened,
      payoffChapterNumber: payoff,
      status: OPEN_LOOP_STATUSES.opened,
      importance: (FACT_IMPORTANCE_SET.has(str(l.importance))
        ? str(l.importance)
        : FACT_IMPORTANCE.major) as FactImportance,
    });
  }

  const rawReveals = Array.isArray(parsed.plannedReveals)
    ? parsed.plannedReveals.slice(0, MAX_PLANNED_REVEAL_COUNT)
    : [];
  const plannedReveals: PlannedRevealDraft[] = [];
  for (const raw of rawReveals) {
    if (!raw || typeof raw !== "object") continue;
    const rv = raw as Record<string, unknown>;
    const title = str(rv.title);
    // Requested as `hiddenTruth` in the prompt to avoid the forbidden `planningTruth`
    // token in provider prompt/output scans; stored internally as planningTruth.
    const planningTruth = str(rv.hiddenTruth);
    if (!title || !planningTruth) continue;
    const planned = num(rv.plannedChapterNumber);
    const plannedChapterNumber = planned ? Math.min(Math.max(planned, 1), maxChapter) : null;
    const forbidden = num(rv.forbiddenBeforeChapter);
    plannedReveals.push({
      title: title.slice(0, 200),
      // planner-only — stored in planned_reveals.planning_truth; never sent raw to writer.
      planningTruth: planningTruth.slice(0, 600),
      readerFacingHint: str(rv.readerFacingHint).slice(0, 300),
      plannedChapterNumber,
      forbiddenBeforeChapter: Math.min(
        Math.max(forbidden ?? plannedChapterNumber ?? maxChapter, 1),
        maxChapter,
      ),
      status: "planned",
      riskLevel: (REVEAL_RISK_SET.has(str(rv.riskLevel))
        ? str(rv.riskLevel)
        : REVEAL_RISK_LEVELS.medium) as RevealRiskLevel,
      relatedFactId: null,
      relatedProposalId: null,
    });
  }

  const seasonLabel = str(parsed.seasonLabel) || defaultSeasonLabel(maxChapter);
  const arcSummary = str(parsed.arcSummary) || defaultArcSummary(snapshot);

  return {
    seasonLabel,
    arcSummary,
    retentionSummary: computeRetentionSummary(chapters, openLoops.length),
    planningNotes: `Generated by ${GENERATOR_MARKER_AI} — planner-only, not prose. Source concept: ${snapshot.concept.title}.`,
    chapters,
    openLoops,
    plannedReveals,
  };
}

const GENERATOR_MARKER_AI = "outline_ai_generator";

function buildOutlineSystemPrompt(targetCount: number): string {
  return (
    "Kamu adalah perancang outline serial fiksi mobile (KBM). Berdasarkan fondasi cerita terkunci, " +
    `rancang outline ${targetCount} bab sebagai SATU object JSON valid:\n` +
    "{\n" +
    '  "seasonLabel": "label musim singkat",\n' +
    '  "arcSummary": "1-2 kalimat arc keseluruhan",\n' +
    `  "chapters": [ exactly ${targetCount} item, urut bab 1..${targetCount}, masing-masing: ` +
    '{ "title": "judul bab", "summary": "1 kalimat", "purpose": "1 kalimat fungsi naratif", ' +
    '"chapterFunction": "setup|conflict|escalation|emotional_turn|mini_victory|reveal|cliffhanger|payoff|transition", ' +
    '"emotionalDirection": "hurt|tense|angry|hopeful|satisfying|curious|anxious|triumphant", ' +
    '"hook": "1 kalimat pembuka", "endingHook": "1 kalimat cliffhanger akhir bab", "miniVictory": "1 kalimat atau null" } ],\n' +
    '  "openLoops": [ { "question": "pertanyaan pembaca", "readerFacingHint": "petunjuk halus", "openedChapterNumber": 1, "payoffChapterNumber": 8, "importance": "minor|major|core" } ],\n' +
    '  "plannedReveals": [ { "title": "judul reveal", "hiddenTruth": "KEBENARAN PENUH untuk planner (TIDAK pernah ditampilkan ke pembaca/penulis)", "readerFacingHint": "petunjuk aman", "plannedChapterNumber": 7, "forbiddenBeforeChapter": 7, "riskLevel": "low|medium|high" } ]\n' +
    "}\n\n" +
    `Aturan: TEPAT ${targetCount} bab; ringkas (1 kalimat per field) agar JSON tidak terpotong; ` +
    "spesifik ke fondasi (bukan template, jangan pakai nama klise Nadira/Arman/Siska); " +
    "buat tiap bab punya hook & endingHook kuat; sisipkan mini victory berkala; " +
    "3-4 open loops dengan payoff terjadwal; 2-3 planned reveals dengan planningTruth penuh tapi readerFacingHint aman; " +
    "JANGAN kembalikan teks selain JSON valid."
  );
}

export async function generateOutlineDraftWithAi(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  snapshot: OutlineCanonSnapshot,
  options: { targetChapterCount: number; seasonLabel?: string; arcSummary?: string },
): Promise<OutlineGenerationDraft> {
  const f = snapshot.foundation;
  const charLines = snapshot.characters
    .slice(0, 12)
    .map((c) => `- ${c.name} (${c.role}): ${c.description}`)
    .join("\n");
  const factLines = snapshot.facts
    .slice(0, 20)
    .map((fact) => `- ${fact.text}`)
    .join("\n");
  const foundationText = [
    `Premis: ${f.premise}`,
    `Konflik utama: ${f.main_conflict}`,
    `Janji pembaca: ${f.reader_promise}`,
    `Genre: ${f.genre ?? ""}`,
    `Tone: ${f.tone ?? ""}`,
    `Target pembaca: ${f.target_reader ?? ""}`,
    `Konsep: ${snapshot.concept.title}`,
  ].join("\n");

  const promptMessages = [
    { role: "system" as const, content: buildOutlineSystemPrompt(options.targetChapterCount) },
    {
      role: "user" as const,
      content: `Fondasi terkunci:\n${foundationText}\n\nTokoh:\n${charLines || "(tidak ada)"}\n\nFakta canon:\n${factLines || "(tidak ada)"}`,
    },
  ];

  const promptHash = await computePromptHashFromMessages(promptMessages);
  const idempotencyKey = `outline-generation-${projectId}-${crypto.randomUUID()}`;
  const correlationId = generateCorrelationId();

  let attempt = await createGenerationAttempt(bindings, {
    projectId,
    userId: ownerId,
    generationType: GENERATION_TYPES.publish_copy,
    idempotencyKey,
    creditCost: OUTLINE_AI_CREDIT_COST,
    promptHash,
    correlationId,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    metadata: { actualGenerationType: "outline_generation", billingAlias: "publish_copy", task: "13.2" },
  });

  let debited = false;
  try {
    await debitCreditsForAttempt(bindings, {
      userId: ownerId,
      projectId,
      attemptId: attempt.id,
      amount: OUTLINE_AI_CREDIT_COST,
      reason: CREDIT_LEDGER_REASONS.generationDebit,
      generationType: GENERATION_TYPES.publish_copy,
      idempotencyKey,
      correlationId,
    });
    debited = true;
  } catch (err) {
    await markGenerationAttemptFailed(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      errorCode: err instanceof AppError ? err.code : "DEBIT_FAILED",
      errorMessage: err instanceof Error ? err.message : "Credit debit failed",
      correlationId,
    });
    throw err;
  }

  attempt = await markGenerationAttemptRunning(bindings, attempt.id);

  try {
    const routerResult = await generateWithModelRouter(bindings, {
      generationType: GENERATION_TYPES.publish_copy,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      promptHash,
      promptMessages,
      maxOutputTokensOverride: 4000,
      temperature: 0.4,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripOutlineFences(routerResult.text));
    } catch {
      throw new AppError("GENERATION_FAILED", "AI mengembalikan format outline yang tidak valid. Coba lagi.", 502);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("GENERATION_FAILED", "AI tidak mengembalikan outline yang valid. Coba lagi.", 502);
    }

    const draft = buildOutlineDraftFromAi(
      parsed as Record<string, unknown>,
      snapshot,
      options.targetChapterCount,
    );
    const finalDraft: OutlineGenerationDraft = {
      ...draft,
      seasonLabel: options.seasonLabel?.trim() || draft.seasonLabel,
      arcSummary: options.arcSummary?.trim() || draft.arcSummary,
    };

    await markGenerationAttemptSucceeded(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      provider: routerResult.provider,
      model: routerResult.model,
      inputTokens: routerResult.inputTokens,
      outputTokens: routerResult.outputTokens,
      outputEntityId: "00000000-0000-0000-0000-000000000000",
      outputEntityType: "outline_plan",
      correlationId,
    });

    return finalDraft;
  } catch (err) {
    if (debited) {
      try {
        await refundCreditsForAttempt(bindings, {
          userId: ownerId,
          projectId,
          attemptId: attempt.id,
          amount: OUTLINE_AI_CREDIT_COST,
          reason: CREDIT_LEDGER_REASONS.generationRefund,
          generationType: GENERATION_TYPES.publish_copy,
          idempotencyKey,
          correlationId,
        });
      } catch (refundErr) {
        console.error("credit refund failed:", refundErr);
      }
    }
    await markGenerationAttemptFailed(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      errorCode: err instanceof AppError ? err.code : "AI_FAILED",
      errorMessage: err instanceof Error ? err.message : "AI outline generation failed",
      correlationId,
    });
    throw err;
  }
}

export const OUTLINE_PLAN_STATUS_GENERATED = OUTLINE_PLAN_STATUSES.generated;
export const CHAPTER_STATUS_PLANNED = CHAPTER_OUTLINE_STATUSES.planned;