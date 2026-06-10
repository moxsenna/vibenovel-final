import type { IntakeSession as ApiIntakeSession, StoryFoundation } from "@vibenovel/shared";
import {
  FOUNDATION_READINESS_LEVELS,
  FOUNDATION_STATUSES,
  INTAKE_PHASES,
  INTAKE_SESSION_STATUSES,
} from "@vibenovel/shared";
import type { ChapterDraft } from "@/types";
import { ROUTES } from "@/routes/paths";

export function createEmptyApiIntakeSession(projectId: string): ApiIntakeSession {
  const now = new Date().toISOString();
  return {
    id: "",
    projectId,
    status: INTAKE_SESSION_STATUSES.active,
    phase: INTAKE_PHASES.idea_collection,
    progressPercent: 0,
    summary: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Minimal write-room shell when real data is unavailable (not Sprint 1 demo). */
export function createEmptyApiFoundation(projectId: string): StoryFoundation {
  const now = new Date().toISOString();
  return {
    id: "",
    projectId,
    premise: "",
    mainConflict: "",
    readerPromise: "",
    tone: null,
    genre: null,
    targetReader: null,
    storySecretsPreview: null,
    styleTags: [],
    readinessPercent: 0,
    readinessStatus: FOUNDATION_READINESS_LEVELS.belum_siap,
    status: FOUNDATION_STATUSES.draft,
    isLocked: false,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyChapterDraft(projectId: string): ChapterDraft {
  return {
    projectId,
    chapterNumber: 0,
    chapterTitle: "",
    chapterStatus: "draft",
    wordCount: 0,
    lastSavedLabel: "Belum disimpan",
    summaryRoute: ROUTES.project.summary(projectId),
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
    beats: [],
    storyChecks: [],
  };
}