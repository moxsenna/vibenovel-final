export type BeatStatus = "done" | "draft" | "empty";

export interface Beat {
  id: string;
  number: number;
  title: string;
  summary: string;
  status: BeatStatus;
  /** Arahan adegan untuk panel asisten */
  direction: string;
  prose: string;
}

export type StoryCheckStatus = "ok" | "warning";

export interface StoryCheckItem {
  id: string;
  label: string;
  status: StoryCheckStatus;
  statusLabel: string;
  detail?: string;
}

export interface ChapterDraft {
  projectId: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterStatus: "draft" | "published";
  wordCount: number;
  lastSavedLabel: string;
  beats: Beat[];
  storyChecks: StoryCheckItem[];
  summaryRoute: string;
  pageCopy: {
    sceneListTitle: string;
    assistantTitle: string;
    directionTitle: string;
    storyCheckTitle: string;
    writeSceneAction: string;
    strengthenEmotionAction: string;
    addDialogAction: string;
    recheckLabel: string;
    finishCta: string;
    previewLabel: string;
    saveLabel: string;
    mobileWorkspaceLabel: string;
    mobileDirectionLabel: string;
    mobileWriteAction: string;
    mobileFixAction: string;
    mobileCheckAction: string;
    mobileSummaryCta: string;
    mobileCheckSheetTitle: string;
  };
}