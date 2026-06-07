export type ProjectStatus = "draft" | "in_progress" | "published";

export interface Project {
  id: string;
  title: string;
  genre: string;
  status: ProjectStatus;
  lastEditedAt: string;
  chapterCount: number;
  currentChapter: number;
  progressPercent: number;
}