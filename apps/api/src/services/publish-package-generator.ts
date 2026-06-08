import {
  PUBLISH_CHECKLIST_ITEM_IDS,
  PUBLISH_PACKAGE_GENERATOR_VERSIONS,
  PUBLISH_PACKAGE_STATUSES,
  type PublishChecklistItem,
  type PublishPackageMetadata,
  type PublishPackageSnapshot,
  type PublishSafetyFlags,
} from "@vibenovel/shared";
import {
  assertPublishFieldsSafe,
  detectOverclaimUnlock,
} from "./publish-safety.js";

export const PUBLISH_GENERATOR_VERSION = PUBLISH_PACKAGE_GENERATOR_VERSIONS.v1_stub;

const SYNOPSIS_MAX = 500;
const TEASER_MAX = 300;
const CAPTION_MAX = 400;
const NEXT_TEASER_MAX = 200;
const EXCERPT_MAX = 280;
const TAGS_MAX = 8;

const CHECKLIST_LABELS: Record<string, string> = {
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_teaser]: "Teaser menggoda tanpa membuka rahasia besar",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_caption]: "Caption siap untuk sosial media",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_tags]: "Tag/genre sudah sesuai arah cerita",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_question]: "Pertanyaan pembaca sudah ada",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_preview]: "Preview terbaca nyaman di layar HP",
};

export interface GeneratedPublishPackageDraft {
  chapterTitle: string;
  displayTitle: string;
  teaser: string;
  shortSynopsis: string;
  caption: string;
  readerQuestion: string;
  nextChapterTeaser: string | null;
  tags: string[];
  genre: string | null;
  mobilePreviewExcerpt: string;
  checklist: PublishChecklistItem[];
  safetyFlags: PublishSafetyFlags;
  metadata: PublishPackageMetadata;
  status: typeof PUBLISH_PACKAGE_STATUSES.ready;
}

function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return match ? match[0].trim() : truncate(trimmed, 200);
}

function humanizeGenre(genre: string | null): string | null {
  if (!genre) return null;
  return genre.replace(/_/g, " ").trim();
}

function buildTags(snapshot: PublishPackageSnapshot): string[] {
  const tags = new Set<string>();
  const genreLabel = humanizeGenre(snapshot.genre);
  if (genreLabel) tags.add(genreLabel);

  for (const tag of snapshot.styleTags) {
    const t = tag.trim();
    if (t) tags.add(t);
  }

  const synopsisLower = snapshot.synopsis.toLowerCase();
  if (
    synopsisLower.includes("keluarga") ||
    synopsisLower.includes("rumah tangga") ||
    synopsisLower.includes("suami") ||
    synopsisLower.includes("istri")
  ) {
    tags.add("drama keluarga");
  }

  return [...tags].slice(0, TAGS_MAX);
}

function buildTeaser(snapshot: PublishPackageSnapshot): string {
  if (snapshot.endingHook?.trim()) {
    return truncate(snapshot.endingHook.trim(), TEASER_MAX);
  }
  if (snapshot.emotionalOutcome?.trim()) {
    return truncate(firstSentence(snapshot.emotionalOutcome), TEASER_MAX);
  }
  return truncate(firstSentence(snapshot.synopsis), TEASER_MAX);
}

function buildCaption(snapshot: PublishPackageSnapshot): string {
  const parts: string[] = [];
  if (snapshot.emotionalOutcome?.trim()) {
    parts.push(snapshot.emotionalOutcome.trim());
  }
  if (snapshot.miniVictory?.trim()) {
    parts.push(snapshot.miniVictory.trim());
  }
  if (parts.length > 0) {
    return truncate(parts.join(" "), CAPTION_MAX);
  }
  return truncate(
    `Di bab ini, cerita membawa pembaca merasakan momen penting tanpa membocorkan rahasia besar.`,
    CAPTION_MAX,
  );
}

function buildReaderQuestion(snapshot: PublishPackageSnapshot): string {
  if (snapshot.endingHook?.trim()) {
    const hook = firstSentence(snapshot.endingHook);
    if (hook.endsWith("?")) return truncate(hook, 200);
    return truncate(`Bagaimana menurutmu: ${hook.replace(/\.$/, "")}?`, 200);
  }
  return "Kalau jadi tokoh utama, kamu akan bertanya langsung atau menunggu bukti lebih dulu?";
}

function buildNextChapterTeaser(snapshot: PublishPackageSnapshot): string | null {
  const next = snapshot.nextChapterSlice;
  if (!next) {
    return "Bab berikutnya akan segera hadir.";
  }

  if (next.hook?.trim()) {
    return truncate(next.hook.trim(), NEXT_TEASER_MAX);
  }
  if (next.endingHook?.trim()) {
    return truncate(
      `Bab berikutnya, ${next.title}: ${firstSentence(next.endingHook)}`,
      NEXT_TEASER_MAX,
    );
  }
  return truncate(`Bab berikutnya membawa cerita ke ${next.title}.`, NEXT_TEASER_MAX);
}

function buildMobilePreviewExcerpt(snapshot: PublishPackageSnapshot, teaser: string): string {
  if (snapshot.proseExcerpts.length > 0) {
    return truncate(snapshot.proseExcerpts[0]!.firstSentence, EXCERPT_MAX);
  }
  return truncate(teaser, EXCERPT_MAX);
}

function buildChecklist(draft: {
  teaser: string;
  caption: string;
  tags: string[];
  readerQuestion: string;
  mobilePreviewExcerpt: string;
}): PublishChecklistItem[] {
  const teaserOk = draft.teaser.length >= 40 && draft.teaser.length <= 300;
  const captionOk = draft.caption.length >= 20;
  const tagsOk = draft.tags.length >= 3;
  const questionOk = draft.readerQuestion.trim().endsWith("?");
  const previewOk = draft.mobilePreviewExcerpt.length > 0 && draft.mobilePreviewExcerpt.length <= 280;

  const checks: Record<string, boolean> = {
    [PUBLISH_CHECKLIST_ITEM_IDS.chk_teaser]: teaserOk,
    [PUBLISH_CHECKLIST_ITEM_IDS.chk_caption]: captionOk,
    [PUBLISH_CHECKLIST_ITEM_IDS.chk_tags]: tagsOk,
    [PUBLISH_CHECKLIST_ITEM_IDS.chk_question]: questionOk,
    [PUBLISH_CHECKLIST_ITEM_IDS.chk_preview]: previewOk,
  };

  return Object.values(PUBLISH_CHECKLIST_ITEM_IDS).map((id) => ({
    id,
    label: CHECKLIST_LABELS[id] ?? id,
    checked: checks[id] ?? false,
  }));
}

export function generatePublishPackageStub(
  snapshot: PublishPackageSnapshot,
  proseVersionIdsUsed: string[],
): GeneratedPublishPackageDraft {
  const chapterTitle = snapshot.chapterTitle.trim() || `Bab ${snapshot.chapterNumber}`;
  const displayTitle = `Bab ${snapshot.chapterNumber}: ${chapterTitle}`;
  const teaser = buildTeaser(snapshot);
  const shortSynopsis = truncate(snapshot.synopsis, SYNOPSIS_MAX);
  const caption = buildCaption(snapshot);
  const readerQuestion = buildReaderQuestion(snapshot);
  const nextChapterTeaser = buildNextChapterTeaser(snapshot);
  const tags = buildTags(snapshot);
  const genre = humanizeGenre(snapshot.genre);
  const mobilePreviewExcerpt = buildMobilePreviewExcerpt(snapshot, teaser);

  const fields = {
    displayTitle,
    teaser,
    shortSynopsis,
    caption,
    readerQuestion,
    nextChapterTeaser,
    mobilePreviewExcerpt,
    tags,
  };

  assertPublishFieldsSafe(fields);

  const safetyFlags: PublishSafetyFlags = {
    stubGenerated: true,
    genericCaption: caption.includes("momen penting tanpa membocorkan"),
    possibleSpoilerInTeaser: teaser.length > 250,
    possibleFutureLeakInNextTeaser: Boolean(
      nextChapterTeaser && nextChapterTeaser.length > 150 && snapshot.nextChapterSlice?.hook,
    ),
    overclaimUnlock:
      detectOverclaimUnlock(teaser) ||
      detectOverclaimUnlock(caption) ||
      detectOverclaimUnlock(readerQuestion),
    summaryProseMismatch:
      snapshot.proseExcerpts.length > 0 &&
      !snapshot.proseExcerpts[0]!.firstSentence
        .toLowerCase()
        .split(" ")
        .slice(0, 3)
        .some((w) => shortSynopsis.toLowerCase().includes(w)),
  };

  const metadata: PublishPackageMetadata = {
    chapterSummaryId: snapshot.approvedSummaryId,
    proseVersionIds: proseVersionIdsUsed,
    generatedAt: new Date().toISOString(),
    stubMarker: true,
  };

  return {
    chapterTitle,
    displayTitle,
    teaser,
    shortSynopsis,
    caption,
    readerQuestion,
    nextChapterTeaser,
    tags,
    genre,
    mobilePreviewExcerpt,
    checklist: buildChecklist({ teaser, caption, tags, readerQuestion, mobilePreviewExcerpt }),
    safetyFlags,
    metadata,
    status: PUBLISH_PACKAGE_STATUSES.ready,
  };
}