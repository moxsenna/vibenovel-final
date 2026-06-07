export type ChapterBadgeType =
  | "reveal"
  | "mini_victory"
  | "conflict"
  | "emotion"
  | "cliffhanger";

export interface ChapterBadge {
  type: ChapterBadgeType;
  label: string;
}

export interface OutlineChapter {
  id: string;
  number: number;
  title: string;
  /** Ringkasan singkat bab */
  summary: string;
  /** Fungsi bab dalam arc */
  goal: string;
  /** Arah emosi yang dituju */
  emotionalGoal: string;
  endingHook: string;
  badges: ChapterBadge[];
}

export type OutlineRetentionTone = "primary" | "accent" | "success" | "warning";

export interface OutlineRetentionHint {
  id: string;
  label: string;
  description: string;
  icon: string;
  tone: OutlineRetentionTone;
}

export interface OutlineProgress {
  readyCount: number;
  totalCount: number;
  statusLabel: string;
  statusDescription: string;
}

export interface StoryOutline {
  projectId: string;
  seasonLabel: string;
  arcSummary: string;
  description: string;
  progress: OutlineProgress;
  chapters: OutlineChapter[];
  writeRoute: string;
  retentionHints: OutlineRetentionHint[];
  pageCopy: {
    planBadge: string;
    startWritingCta: string;
    loadMoreCta: string;
    loadMoreHint: string;
    reviewNote: string;
    retentionTitle: string;
    retentionSubtitle: string;
  };
}