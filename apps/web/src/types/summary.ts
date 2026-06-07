export type SummaryStatus = "draft" | "ready_for_review";

export type SummaryCheckStatus = "ok" | "warning";

export interface SummaryListItem {
  id: string;
  text: string;
  emphasis?: string;
}

export interface CharacterChange {
  id: string;
  characterName: string;
  initial: string;
  change: string;
}

export interface StoryCheckNote {
  id: string;
  status: SummaryCheckStatus;
  label: string;
  detail?: string;
}

export interface ChapterSummary {
  projectId: string;
  chapterNumber: number;
  chapterTitle: string;
  status: SummaryStatus;
  synopsis: string;
  newFacts: SummaryListItem[];
  characterChanges: CharacterChange[];
  relationChanges: SummaryListItem[];
  miniVictories: SummaryListItem[];
  heldSecrets: SummaryListItem[];
  openLoops: SummaryListItem[];
  storyCheckNotes: StoryCheckNote[];
  publishRoute: string;
  writeRoute: string;
  pageCopy: {
    badgeLabel: string;
    title: string;
    subtitle: string;
    statusDraft: string;
    statusReady: string;
    approveCta: string;
    backToWriteCta: string;
  };
}