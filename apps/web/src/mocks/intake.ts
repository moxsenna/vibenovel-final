import type { IntakeSession } from "@/types";
import { DEMO_PROJECT_ID } from "./projects";
import { ROUTES } from "@/routes/paths";

/** Sprint 1 typed mock — replace with API in Sprint 3 */
export const mockIntakeSession: IntakeSession = {
  projectId: DEMO_PROJECT_ID,
  pageTitle: "Ceritakan Ide Ceritamu",
  introTitle: "Mari Bangun Ceritamu",
  introSubtitle:
    "Ceritakan sedikit saja dulu. Nanti VibeNovel bantu rapikan jadi fondasi cerita.",
  messages: [
    {
      id: "msg-001",
      role: "agent",
      content:
        "Halo! Aku siap mendampingi kamu merangkai rasa cerita. Untuk memulai, **ceritakan gambaran kasarmu** — tidak perlu sempurna.",
      timestamp: "2026-06-05T10:00:00+07:00",
    },
    {
      id: "msg-002",
      role: "user",
      content:
        "Aku mau tulis drama rumah tangga tentang istri yang diremehkan keluarga suami, lalu perlahan bangkit dan menemukan keberanian sendiri. Ceritanya emosional dan enak dibaca di HP.",
      timestamp: "2026-06-05T10:02:00+07:00",
    },
    {
      id: "msg-003",
      role: "agent",
      content:
        "Rasa ceritanya sudah terasa kuat — drama rumah tangga dengan perjalanan harga diri. Aku catat sebagai **Drama Rumah Tangga** dengan nuansa **Bangkit & Berani**.\n\nBisa ceritakan sedikit tentang **tokoh utama**? Siapa perempuan di pusat cerita ini, dan apa yang paling menyakitkan baginya?",
      timestamp: "2026-06-05T10:03:00+07:00",
    },
  ],
  progress: [
    {
      id: "prog-genre",
      label: "Genre",
      status: "done",
      detail: "Drama rumah tangga",
    },
    {
      id: "prog-char",
      label: "Tokoh utama",
      status: "active",
      detail: "Mulai terbentuk",
    },
    {
      id: "prog-conflict",
      label: "Konflik utama",
      status: "done",
      detail: "Istri diremehkan, berjuang bangkit",
    },
    {
      id: "prog-secret",
      label: "Rahasia cerita",
      status: "pending",
      detail: "Belum lengkap",
    },
    {
      id: "prog-audience",
      label: "Target pembaca",
      status: "pending",
      detail: "Belum lengkap",
    },
  ],
  progressPercent: 40,
  detectedSignals: [
    { id: "sig-1", label: "Drama Rumah Tangga", icon: "theater_comedy" },
    { id: "sig-2", label: "Bangkit & Berani", icon: "local_fire_department" },
    { id: "sig-3", label: "Serial HP", icon: "smartphone" },
    { id: "sig-4", label: "Menganalisis...", icon: "psychology_alt", pending: true },
  ],
  suggestedActions: [
    "Tambahkan rahasia cerita",
    "Buat lebih emosional",
    "Fokus ke pembaca HP",
  ],
  conceptsRoute: ROUTES.project.concepts(DEMO_PROJECT_ID),
  inputPlaceholder: "Ketik ide ceritamu di sini...",
  inputTip: "Sprint 1: balasan masih contoh dummy. Ketik apa saja untuk mencoba alur obrolan.",
  ctaLabel: "Buat 3 Konsep Cerita",
  ctaHint: "Bisa diklik setelah fondasi cukup — untuk demo Sprint 1 sudah aktif.",
};

/** Dummy agent reply after user sends — not real AI */
export const INTAKE_DUMMY_REPLY =
  "Terima kasih, aku catat dulu. Ceritakan lagi kalau ada detail tentang tokoh atau masalah utama yang ingin ditonjolkan.";