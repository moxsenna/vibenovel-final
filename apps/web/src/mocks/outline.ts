import type { StoryOutline } from "@/types";
import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

const writeRoute = ROUTES.project.write(DEMO_PROJECT_ID);

/** Istri yang Mereka Buang — Sprint 1 typed mock. TODO: Sprint 4 outline generation */
export const mockOutline: StoryOutline = {
  projectId: DEMO_PROJECT_ID,
  seasonLabel: "Bab 1–10: Awal Konflik",
  arcSummary:
    "Sepuluh bab pertama mengantar Nadira dari istri yang diam dan diremehkan menjadi perempuan yang mulai mengumpulkan bukti dan keberanian. Rahasia Siska belum terbuka sepenuhnya — tapi ketegangan keluarga sudah tidak bisa ditahan.",
  description:
    "Arah 10 bab awal untuk membangun konflik, menahan rahasia, dan memberi ruang bagi Nadira mulai bangkit. Kamu bisa meninjau sebelum mulai menulis.",
  progress: {
    readyCount: 10,
    totalCount: 10,
    statusLabel: "10 bab siap ditinjau",
    statusDescription: "Outline ini masih bisa kamu sesuaikan sebelum mulai menulis Bab 1.",
  },
  writeRoute,
  retentionHints: [
    {
      id: "ret-open-loop",
      label: "Open Loop",
      description: "7 dari 10 bab punya hook penutup yang menggoda lanjut baca.",
      icon: "all_inclusive",
      tone: "primary",
    },
    {
      id: "ret-mini-win",
      label: "Kemenangan Kecil",
      description: "Nadira dapat 3 momen bangkit kecil sebelum konfrontasi besar.",
      icon: "emoji_events",
      tone: "success",
    },
    {
      id: "ret-secret",
      label: "Rahasia Ditahan",
      description: "Identitas Siska dan pengkhianatan penuh belum terbuka di 10 bab ini.",
      icon: "lock",
      tone: "accent",
    },
    {
      id: "ret-unlock",
      label: "Potensi Unlock",
      description: "Bab 10 diakhiri dengan ketegangan yang cocok untuk bab berikutnya.",
      icon: "key",
      tone: "warning",
    },
  ],
  pageCopy: {
    planBadge: "Rencana 10 Bab Awal",
    startWritingCta: "Mulai Tulis Bab 1",
    loadMoreCta: "Muat Bab Selanjutnya",
    loadMoreHint: "Bab 11 ke atas akan tersedia setelah kamu menulis lebih lanjut.",
    reviewNote: "Tinjau hook dan arah emosi tiap bab — kamu bebas mengubah detail saat menulis.",
    retentionTitle: "Petunjuk Daya Tarik Serial",
    retentionSubtitle:
      "Ringkasan ringan untuk membantu bab awal tetap enak dibaca beruntun — bukan skor otomatis.",
  },
  chapters: [
    {
      id: "ch-001",
      number: 1,
      title: "Makan Malam yang Dingin",
      summary:
        "Nadira duduk di meja makan malam keluarga yang terasa dingin; sindiran halus dari ibu mertua membuatnya semakin kecil di kursinya.",
      goal: "Perkenalkan dinamika keluarga dan posisi Nadira yang diremehkan tanpa langsung membuatnya korban total.",
      emotionalGoal: "Pembaca merasa ikut dengan Nadira dan mulai curiga ada sesuatu yang disembunyikan.",
      endingHook:
        "Arman mematikan ponselnya saat notifikasi berbunyi — Nadira melihat nama \"Siska\" sekilas sebelum layar gelap.",
      badges: [
        { type: "emotion", label: "Emosi" },
        { type: "conflict", label: "Konflik" },
      ],
    },
    {
      id: "ch-002",
      number: 2,
      title: "Pesan di Ponsel Arman",
      summary:
        "Nadira tidak sengaja melihat pesan yang terhapus cepat, tapi cukup untuk membuat hatinya tidak tenang sepanjang malam.",
      goal: "Tanam petunjuk pertama tanpa konfrontasi langsung — rahasia masih ditahan.",
      emotionalGoal: "Rasa penasaran mulai menggantikan rasa takut; pembaca ingin tahu isi pesan itu.",
      endingHook: "Pesan yang sempat terbaca berakhir dengan kalimat: \"Sampai jumpa besok.\"",
      badges: [{ type: "reveal", label: "Rahasia" }],
    },
    {
      id: "ch-003",
      number: 3,
      title: "Senyum yang Terlalu Akrab",
      summary:
        "Di acara keluarga, Nadira memperhatikan bagaimana Arman dan seorang wanita saling bertukar senyum yang terasa terlalu akrab.",
      goal: "Naikkan ketegangan sosial tanpa membuka identitas wanita itu terlalu cepat.",
      emotionalGoal: "Pembaca merasakan gelagat Nadira yang mulai waspada, bukan sekadar sedih.",
      endingHook:
        "Wanita itu memanggil Arman dengan nama kecil yang bukan \"Sayang\" — dan Nadira mendengarnya.",
      badges: [
        { type: "conflict", label: "Konflik" },
        { type: "reveal", label: "Rahasia" },
      ],
    },
    {
      id: "ch-004",
      number: 4,
      title: "Sindiran yang Tak Dibela",
      summary:
        "Bu Siti menyinggung Nadira di depan tamu; Arman diam. Nadira tersenyum tipis — pertama kali ia tidak langsung menunduk.",
      goal: "Tunjukkan Nadira sendirian di medan pertempuran rumah tangga, sekaligus isyarat agency kecil.",
      emotionalGoal: "Amarah tertahan dan malu bercampur; pembaca ingin Nadira dibela atau membela diri.",
      endingHook:
        "Setelah tamu pulang, Nadira berkata pelan: \"Kamu tidak perlu membelaku. Tapi jangan pura-pura tidak melihat.\"",
      badges: [
        { type: "emotion", label: "Emosi" },
        { type: "conflict", label: "Konflik" },
      ],
    },
    {
      id: "ch-005",
      number: 5,
      title: "Nadira Mulai Diam",
      summary:
        "Nadira berhenti membela diri dengan argumen panjang dan memilih mengamati — diam bukan berarti menyerah.",
      goal: "Tandai perubahan strategi Nadira: dari reaktif menjadi pengamat yang sadar.",
      emotionalGoal: "Pembaca merasakan kemenangan kecil — Nadira mulai mengambil kendali atas dirinya.",
      endingHook:
        "Di buku catatannya, Nadira menulis daftar hal kecil yang selama ini diabaikan — halaman pertama penuh.",
      badges: [{ type: "mini_victory", label: "Kemenangan Kecil" }],
    },
    {
      id: "ch-006",
      number: 6,
      title: "Bukti Kecil di Laci",
      summary:
        "Nadira menemukan struk dan foto lama di laci Arman — belum cukup untuk konfrontasi, tapi cukup untuk keyakinan.",
      goal: "Beri Nadira bukti tanpa membuka rahasia besar Siska terlalu dini.",
      emotionalGoal: "Kepastian dan ketegangan bercampur; pembaca merasa Nadira tidak lagi \"berimajinasi\".",
      endingHook:
        "Di balik foto, ada tanggal yang tidak cocok dengan cerita Arman soal masa lalunya.",
      badges: [
        { type: "reveal", label: "Rahasia" },
        { type: "mini_victory", label: "Kemenangan Kecil" },
      ],
    },
    {
      id: "ch-007",
      number: 7,
      title: "Siska Datang ke Rumah",
      summary:
        "Tamu tak diundang muncul di pintu — Nadira akhirnya mendengar nama itu diucapkan langsung di rumahnya sendiri.",
      goal: "Eskalasi konflik; Siska masuk sebagai tokoh aktif tanpa reveal hubungan penuh.",
      emotionalGoal: "Kejut, malu, dan amarah; pembaca ingin tahu apa yang Arman akan katakan.",
      endingHook:
        "Siska berkata santai: \"Aku kira kamu sudah bilang ke istri kamu.\" Ruang tamu mendadak hening.",
      badges: [
        { type: "conflict", label: "Konflik" },
        { type: "cliffhanger", label: "Cliffhanger" },
      ],
    },
    {
      id: "ch-008",
      number: 8,
      title: "Nadira Menahan Air Mata",
      summary:
        "Konfrontasi hampir pecah di depan keluarga; Nadira menahan air mata dan memilih pergi ke kamar.",
      goal: "Puncak emosional awal tanpa reveal pengkhianatan penuh — rahasia masih ditahan.",
      emotionalGoal: "Empati mendalam; pembaca merasakan beban Nadira yang terus menumpuk.",
      endingHook:
        "Arman menarik Nadira ke kamar dan berkata: \"Besok kita bicara.\" Nadira mengangguk, tapi matanya sudah berbeda.",
      badges: [{ type: "emotion", label: "Emosi" }],
    },
    {
      id: "ch-009",
      number: 9,
      title: "Keputusan Pertama Nadira",
      summary:
        "Nadira membuat langkah pertama: menghubungi teman lama untuk minta saran soal dokumen rumah tangga.",
      goal: "Tunjukkan Nadira mulai bertindak, bukan hanya menderita — agency yang konkret.",
      emotionalGoal: "Harapan kecil muncul; pembaca merasa Nadira punya rencana, bukan sekadar korban.",
      endingHook:
        "Teman lamanya bilang: \"Ada satu hal yang perlu kamu cek dulu sebelum konfrontasi.\"",
      badges: [
        { type: "mini_victory", label: "Kemenangan Kecil" },
        { type: "cliffhanger", label: "Cliffhanger" },
      ],
    },
    {
      id: "ch-010",
      number: 10,
      title: "Malam Ketika Arman Pulang Terlambat",
      summary:
        "Arman pulang larut malam dengan alasan rapat; Nadira sudah menunggu di ruang tamu dengan daftar pertanyaan.",
      goal: "Tutup arc 10 bab dengan open loop kuat menuju bab berikutnya.",
      emotionalGoal: "Ketegangan memuncak; pembaca ingin unlock bab 11 untuk melihat konfrontasi penuh.",
      endingHook:
        "Arman membuka jas dan struk restoran jatuh — bukan dari kantor, tapi dari tempat yang Nadira kenal.",
      badges: [
        { type: "cliffhanger", label: "Cliffhanger" },
        { type: "reveal", label: "Rahasia" },
      ],
    },
  ],
};