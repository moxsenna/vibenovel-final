import type { Project } from "@vibenovel/shared";
import { isGenericProjectTitle } from "@/lib/suggested-project-title";

/** Secondary line on cards when title is still generic (doc 113 B1). */
export function formatProjectCardSecondaryLine(project: Project): string | null {
  if (!isGenericProjectTitle(project.title)) return null;
  const parts: string[] = [];
  if (project.genre) parts.push(String(project.genre));
  if (project.currentChapter > 0) parts.push(`Bab ${project.currentChapter}`);
  const date = new Date(project.createdAt);
  if (!Number.isNaN(date.getTime())) {
    parts.push(
      date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}