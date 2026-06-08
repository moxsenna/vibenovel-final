import type { PublishPackage as ApiPublishPackage } from "@vibenovel/shared";
import { ROUTES } from "@/routes/paths";
import type { PublishPackage as UiPublishPackage } from "@/types";

const LEAK_PATTERNS = [
  /planningtruth/i,
  /planning_truth/i,
  /packet_json/i,
  /packetjson/i,
  /prose_text/i,
  /prosetext/i,
  /delta_json/i,
  /deltajson/i,
  /full_prompt/i,
  /openrouter/i,
  /context_packet/i,
  /"payload"/i,
];

function safeText(text: string): string {
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(text)) return "Konten tidak dapat ditampilkan.";
  }
  return text;
}

function safeTags(tags: string[]): string[] {
  return tags.map(safeText).filter((tag) => tag.length > 0);
}

export function mapApiPublishPackageToUi(
  apiPkg: ApiPublishPackage,
  routeProjectId: string,
): UiPublishPackage {
  const projectRouteId = routeProjectId || apiPkg.projectId;
  const teaser = safeText(apiPkg.teaser);
  const excerpt = safeText(apiPkg.mobilePreviewExcerpt);
  const chapterLabel = `Bab ${apiPkg.chapterNumber} · ${safeText(apiPkg.chapterTitle)}`;

  return {
    projectId: projectRouteId,
    chapterNumber: apiPkg.chapterNumber,
    chapterTitle: safeText(apiPkg.chapterTitle),
    title: safeText(apiPkg.displayTitle),
    blurb: safeText(apiPkg.shortSynopsis),
    teaser,
    caption: safeText(apiPkg.caption),
    commentBait: safeText(apiPkg.readerQuestion),
    nextChapterTeaser: apiPkg.nextChapterTeaser ? safeText(apiPkg.nextChapterTeaser) : "",
    tags: safeTags(apiPkg.tags),
    checklist: apiPkg.checklist.map((item) => ({
      id: item.id,
      label: safeText(item.label),
      checked: item.checked,
    })),
    mobilePreview: {
      appName: "Preview KBM",
      chapterLabel,
      excerpt,
      readMoreLabel: "Lanjut baca →",
    },
    dashboardRoute: ROUTES.dashboard,
    summaryRoute: ROUTES.project.summary(projectRouteId),
    outlineRoute: ROUTES.project.outline(projectRouteId),
    pageCopy: {
      badgeLabel:
        apiPkg.status === "exported" ? "Paket Sudah Ditandai" : "Paket Publish",
      title: `Aset Publikasi: Bab ${apiPkg.chapterNumber}`,
      subtitle:
        "Materi siap salin untuk platform serial. Salin manual ke KBM — tidak ada posting otomatis.",
      blurbLabel: "Sinopsis Pendek",
      titleLabel: "Judul Bab",
      teaserLabel: "Teaser Bab",
      captionLabel: "Caption Promosi",
      commentBaitLabel: "Pertanyaan untuk Pembaca",
      nextChapterLabel: "Teaser Bab Berikutnya",
      tagsLabel: apiPkg.genre ? `Tag / Genre (${safeText(apiPkg.genre)})` : "Tag / Genre",
      checklistTitle: "Checklist Sebelum Publish",
      mobilePreviewTitle: "Preview Mobile",
      dashboardCta: "Kembali ke Dashboard",
      summaryCta: "Kembali ke Ringkasan",
      nextChapterCta: "Lihat Outline Bab Berikutnya",
      nextChapterHint:
        "Paket ini hanya membantu copy-paste ke KBM. Canon cerita tidak berubah otomatis.",
    },
  };
}

export type PublishEditableFieldKey =
  | "displayTitle"
  | "teaser"
  | "shortSynopsis"
  | "caption"
  | "readerQuestion"
  | "nextChapterTeaser"
  | "tags"
  | "genre"
  | "mobilePreviewExcerpt";

export function uiFieldToApiPatch(
  field: PublishEditableFieldKey,
  value: string,
): Record<string, unknown> {
  if (field === "tags") {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    return { tags };
  }
  if (field === "genre") {
    return { genre: value.trim() || null };
  }
  if (field === "nextChapterTeaser") {
    return { nextChapterTeaser: value.trim() || null };
  }
  return { [field]: value.trim() };
}

export function uiValueForField(
  pkg: UiPublishPackage,
  field: PublishEditableFieldKey,
  genre?: string | null,
): string {
  switch (field) {
    case "displayTitle":
      return pkg.title;
    case "teaser":
      return pkg.teaser;
    case "shortSynopsis":
      return pkg.blurb;
    case "caption":
      return pkg.caption;
    case "readerQuestion":
      return pkg.commentBait;
    case "nextChapterTeaser":
      return pkg.nextChapterTeaser;
    case "tags":
      return pkg.tags.join(", ");
    case "genre":
      return genre ?? "";
    case "mobilePreviewExcerpt":
      return pkg.mobilePreview.excerpt;
    default:
      return "";
  }
}