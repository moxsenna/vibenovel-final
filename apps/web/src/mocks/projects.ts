import type { Project } from "@/types";

/** Sprint 1 typed mock — replace with API in Sprint 2 */
export const DEMO_PROJECT_ID = "demo-project-001";

export const mockProjects: Project[] = [
  {
    id: DEMO_PROJECT_ID,
    title: "Istri yang Mereka Buang",
    genre: "Drama Misteri",
    status: "in_progress",
    lastEditedAt: "2026-06-05T14:30:00+07:00",
    chapterCount: 10,
    currentChapter: 1,
    progressPercent: 30,
  },
  {
    id: "demo-project-002",
    title: "Senja di Kaca Retak",
    genre: "Romansa Drama",
    status: "draft",
    lastEditedAt: "2026-06-01T09:15:00+07:00",
    chapterCount: 10,
    currentChapter: 1,
    progressPercent: 10,
  },
];

export const mockActiveProject = mockProjects[0];