export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface LockedFact {
  id: string;
  label: string;
  value: string;
  isLocked: boolean;
}

export interface SecretScheduleItem {
  id: string;
  chapterLabel: string;
  description: string;
}

export interface FoundationReadiness {
  percent: number;
  title: string;
  statusLabel: string;
  hint: string;
  missingItems: string[];
}

export interface StoryFoundation {
  projectId: string;
  readiness: FoundationReadiness;
  premise: string;
  mainCharacters: Character[];
  supportingCharacters: Character[];
  lockedFacts: LockedFact[];
  mainConflict: string;
  readerPromiseItems: string[];
  storySecretsPreview: string;
  secretSchedule: SecretScheduleItem[];
  storyStyleTags: string[];
  outlineRoute: string;
  isLocked: boolean;
  pageCopy: {
    title: string;
    subtitle: string;
    warningTitle: string;
    warningBody: string;
    warningNote: string;
    lockCtaLabel: string;
  };
}