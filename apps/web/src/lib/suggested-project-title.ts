import type { ProjectEntryPath } from "@vibenovel/shared";
import { PROJECT_ENTRY_PATHS } from "@vibenovel/shared";

const ENTRY_TITLE_PREFIX: Partial<Record<ProjectEntryPath, string>> = {
  [PROJECT_ENTRY_PATHS.no_idea]: "Cerita baru",
  [PROJECT_ENTRY_PATHS.rough_idea]: "Draf ide",
  [PROJECT_ENTRY_PATHS.has_draft]: "Lanjutan draf",
  [PROJECT_ENTRY_PATHS.has_outline]: "Outline baru",
  [PROJECT_ENTRY_PATHS.repair_only]: "Perbaikan cerita",
};

/** Distinct default titles per entry path (doc 113 B1). */
export function suggestedProjectTitle(
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

export function isGenericProjectTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return (
    t === "cerita baru" ||
    t.startsWith("cerita baru ") ||
    t === "draf ide" ||
    t.startsWith("draf ide ") ||
    t === "lanjutan draf" ||
    t.startsWith("lanjutan draf ") ||
    t === "outline baru" ||
    t.startsWith("outline baru ") ||
    t === "perbaikan cerita" ||
    t.startsWith("perbaikan cerita ") ||
    t === "proyek" ||
    /^proyek \d+$/.test(t)
  );
}