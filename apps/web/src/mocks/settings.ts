import type { UserSettings } from "@/types";

/** Sprint 1 dummy settings — replace with API in Sprint 2+ */
export const mockSettings: UserSettings = {
  displayName: "Penulis VibeNovel",
  email: "penulis@contoh.id",
  planLabel: "Free Plan",
  creditsRemaining: 1250,
  monthlyUsage: {
    used: 450,
    quota: 1000,
    percentUsed: 45,
    resetLabel: "Batas reset pada 1 Juli 2026",
    infoMessage: "Anda telah menggunakan 45% dari kuota pemakaian bulan ini.",
  },
  modelTiers: [
    {
      id: "hemat",
      label: "Hemat",
      description: "Lebih irit untuk draft cepat dan eksplorasi ide awal.",
      badgeLabel: "Cepat",
      badgeVariant: "neutral",
      isSelected: false,
    },
    {
      id: "seimbang",
      label: "Seimbang",
      description: "Kualitas default yang disarankan untuk bab biasa.",
      badgeLabel: "Rekomendasi",
      badgeVariant: "primary",
      isSelected: true,
    },
    {
      id: "terbaik",
      label: "Terbaik",
      description: "Untuk bab penting, rewrite, atau perbaikan yang lebih rumit.",
      badgeLabel: "Kualitas tinggi",
      badgeVariant: "success",
      isSelected: false,
    },
  ],
  writerPreferences: {
    defaultLanguage: "Indonesia",
    defaultOutputStyle: "Narasi hangat & emosional",
    defaultFormat: "Format HP/KBM",
  },
  pageCopy: {
    title: "Pengaturan Pemakaian",
    subtitle:
      "Kelola kredit, mode kualitas AI, dan preferensi penulis Anda. Pengaturan ini masih disimpan secara lokal di Sprint 1.",
    creditCardTitle: "Saldo Kredit",
    creditCardSubtitle: "Kredit tersedia untuk bantu tulis, perbaiki, dan validasi bab.",
    creditBalanceLabel: "kredit tersisa",
    usageSectionTitle: "Pemakaian Bulan Ini",
    usageUsedLabel: "Kredit digunakan",
    usageUpgradeCta: "Lihat Paket Kredit",
    qualityModeTitle: "Mode Kualitas AI",
    qualityModeSubtitle:
      "Pilih tingkat kualitas yang sesuai kebutuhan bab. Nama model teknis tidak ditampilkan di sini.",
    writerPreferencesTitle: "Preferensi Penulis",
    accountSectionTitle: "Informasi Akun",
    displayNameLabel: "Nama Tampilan",
    emailLabel: "Email",
    planLabel: "Paket",
    editProfileCta: "Edit Profil",
    sprintNoteTitle: "Catatan Sprint 1",
    sprintNoteBody:
      "Kredit, mode kualitas, dan preferensi di halaman ini masih dummy dan disimpan lokal di peramban. Belum ada pemotongan kredit nyata, billing, atau sinkronisasi akun.",
    cancelCta: "Batal",
    saveCta: "Simpan Perubahan",
  },
};