/** Plain-language hints for dashboard workflow labels (doc 113 C2). */
export const WORKFLOW_STATUS_TOOLTIPS: Record<string, string> = {
  "Asisten Narra berjalan":
    "Anda sedang mengobrol dengan Asisten Narra untuk mengumpulkan arah cerita.",
  "Pilih konsep": "Pilih salah satu arah cerita sebelum membangun fondasi.",
  "Fondasi belum dikunci":
    "Fondasi cerita (karakter, fakta, aturan) belum dikunci — selesaikan dan kunci sebelum outline.",
  "Outline belum dibuat": "Buat rencana bab (outline) setelah fondasi dikunci.",
  "Outline belum dikunci": "Sesuaikan outline lalu kunci sebelum menulis bab.",
  "Siap menulis": "Outline sudah dikunci — Anda bisa masuk Ruang Tulis.",
  "Fondasi dikunci": "Fondasi sudah dikunci; lanjut ke outline atau tulis sesuai tahap proyek.",
  "Menunggu langkah berikutnya": "Selesaikan langkah workflow saat ini untuk membuka tahap berikutnya.",
};

export function workflowStatusTooltip(label: string): string | undefined {
  if (WORKFLOW_STATUS_TOOLTIPS[label]) return WORKFLOW_STATUS_TOOLTIPS[label];
  if (label.startsWith("Bab ")) {
    return "Progres menulis bab — klik kartu untuk melanjutkan di Ruang Tulis.";
  }
  return undefined;
}