import type { ProjectEntryPath } from "@vibenovel/shared";
import { PROJECT_ENTRY_PATHS } from "@vibenovel/shared";

const ENTRY_TITLE_PREFIX: Partial<Record<ProjectEntryPath, string>> = {
  [PROJECT_ENTRY_PATHS.no_idea]: "Cerita baru",
  [PROJECT_ENTRY_PATHS.rough_idea]: "Draf ide",
  [PROJECT_ENTRY_PATHS.has_draft]: "Lanjutan draf",
  [PROJECT_ENTRY_PATHS.has_outline]: "Outline baru",
  [PROJECT_ENTRY_PATHS.repair_only]: "Perbaikan cerita",
};

export function suggestedProjectTitleFromEntryPath(
  entryPath: ProjectEntryPath | undefined,
  existingTitles: string[],
): string {
  const prefix =
    (entryPath && ENTRY_TITLE_PREFIX[entryPath]) ?? "Proyek";
  const taken = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  let candidate = prefix;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${prefix} ${n}`;
    n += 1;
  }
  return candidate;
}