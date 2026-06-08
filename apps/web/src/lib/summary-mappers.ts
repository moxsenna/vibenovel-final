import type { ChapterSummary as ApiChapterSummary, ChapterSummaryItem } from "@vibenovel/shared";
import { ROUTES } from "@/routes/paths";
import type { ChapterSummary as UiChapterSummary, SummaryListItem, StoryCheckNote } from "@/types";

const LEAK_PATTERNS = [
  /planningtruth/i,
  /planning_truth/i,
  /packet_json/i,
  /packetjson/i,
  /prose_text/i,
  /prosetext/i,
  /full_prompt/i,
  /openrouter/i,
];

function safeText(text: string): string {
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(text)) return "Konten tidak dapat ditampilkan.";
  }
  return text;
}

function itemsOfType(items: ChapterSummaryItem[], type: string): ChapterSummaryItem[] {
  return items.filter((item) => item.itemType === type);
}

function toListItem(item: ChapterSummaryItem): SummaryListItem {
  return {
    id: item.id,
    text: safeText(item.body || item.title),
    emphasis: item.title !== item.body ? safeText(item.title) : undefined,
  };
}

function mapStoryCheckNotes(items: ChapterSummaryItem[]): StoryCheckNote[] {
  const notes: StoryCheckNote[] = [];

  for (const item of itemsOfType(items, "continuity_note")) {
    notes.push({
      id: item.id,
      status: "ok",
      label: safeText(item.title),
      detail: safeText(item.body),
    });
  }

  for (const item of itemsOfType(items, "safety_flag")) {
    notes.push({
      id: item.id,
      status: "warning",
      label: safeText(item.title),
      detail: safeText(item.body),
    });
  }

  return notes;
}

function mapUiStatus(apiStatus: string): UiChapterSummary["status"] {
  if (apiStatus === "draft") return "draft";
  return "ready_for_review";
}

function statusLabelFor(apiStatus: string): string {
  if (apiStatus === "approved") return "Disetujui";
  if (apiStatus === "draft") return "Draft";
  return "Siap Ditinjau";
}

export function mapApiSummaryToUi(
  summary: ApiChapterSummary,
  items: ChapterSummaryItem[],
  routeProjectId: string,
): UiChapterSummary {
  const projectRouteId = routeProjectId || summary.projectId;
  const miniVictoryItems = itemsOfType(items, "mini_victory");
  const miniFromSummary = summary.miniVictory?.trim();

  return {
    projectId: projectRouteId,
    chapterNumber: summary.chapterNumber,
    chapterTitle: safeText(summary.title),
    status: mapUiStatus(summary.status),
    synopsis: safeText(summary.synopsis),
    newFacts: itemsOfType(items, "new_fact_candidate").map(toListItem),
    characterChanges: itemsOfType(items, "character_change").map((item) => ({
      id: item.id,
      characterName: safeText(item.title),
      initial: safeText(item.title).charAt(0).toUpperCase() || "?",
      change: safeText(item.body),
    })),
    relationChanges: itemsOfType(items, "relationship_change").map(toListItem),
    miniVictories: [
      ...(miniFromSummary
        ? [{ id: `${summary.id}-mv`, text: safeText(miniFromSummary) }]
        : []),
      ...miniVictoryItems.map(toListItem),
    ],
    heldSecrets: itemsOfType(items, "reveal_candidate").map(toListItem),
    openLoops: [
      ...itemsOfType(items, "open_loop_opened").map(toListItem),
      ...itemsOfType(items, "open_loop_paid_off").map(toListItem),
    ],
    storyCheckNotes: mapStoryCheckNotes(items),
    publishRoute: ROUTES.project.publish(projectRouteId),
    writeRoute: ROUTES.project.write(projectRouteId),
    pageCopy: {
      badgeLabel: summary.status === "approved" ? "Bab Disetujui" : "Bab Selesai",
      title: "Ringkasan Bab",
      subtitle:
        "Tinjau perkembangan cerita. Menyetujui ringkasan tidak otomatis memasukkan semua usulan ke canon.",
      statusDraft: "Draft",
      statusReady: statusLabelFor(summary.status),
      approveCta: "Setujui Ringkasan Bab",
      backToWriteCta: "Kembali ke Ruang Tulis",
    },
  };
}