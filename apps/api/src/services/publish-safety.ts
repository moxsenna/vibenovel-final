import { AppError } from "../errors.js";

const PUBLISH_LEAKAGE_MARKERS = [
  "planningtruth",
  "planning_truth",
  "full_prompt",
  "context_packet",
  "packet_json",
  "openrouter",
  "provider",
  "model",
  "token",
  "delta_json",
  "prose_text",
];

const PUBLISH_OUTPUT_FORBIDDEN_PATTERNS = [
  /planningtruth/i,
  /planning_truth/i,
  /packet_json/i,
  /packetjson/i,
  /context_packet/i,
  /full_prompt/i,
  /openrouter/i,
  /delta_json/i,
  /"prose_text"/i,
  /"proseText"/i,
];

const OVERCLAIM_PATTERNS = [/dijamin\s+viral/i, /pasti\s+trending/i, /dijamin\s+populer/i];

export function assertPublishTextSafe(text: string, fieldLabel = "field"): void {
  const lower = text.toLowerCase();
  for (const marker of PUBLISH_LEAKAGE_MARKERS) {
    if (lower.includes(marker)) {
      throw AppError.badRequest(
        `Publish ${fieldLabel} contains disallowed internal metadata markers`,
        { missing: ["unsafe_content"] },
      );
    }
  }
  for (const pattern of PUBLISH_OUTPUT_FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      throw AppError.badRequest(`Publish ${fieldLabel} failed safety check`, {
        missing: ["unsafe_content"],
      });
    }
  }
}

export function assertPublishFieldsSafe(fields: {
  displayTitle: string;
  teaser: string;
  shortSynopsis: string;
  caption: string;
  readerQuestion: string;
  nextChapterTeaser: string | null;
  mobilePreviewExcerpt: string;
  tags: string[];
}): void {
  assertPublishTextSafe(fields.displayTitle, "displayTitle");
  assertPublishTextSafe(fields.teaser, "teaser");
  assertPublishTextSafe(fields.shortSynopsis, "shortSynopsis");
  assertPublishTextSafe(fields.caption, "caption");
  assertPublishTextSafe(fields.readerQuestion, "readerQuestion");
  if (fields.nextChapterTeaser) {
    assertPublishTextSafe(fields.nextChapterTeaser, "nextChapterTeaser");
  }
  assertPublishTextSafe(fields.mobilePreviewExcerpt, "mobilePreviewExcerpt");
  for (const tag of fields.tags) {
    assertPublishTextSafe(tag, "tag");
  }
}

export function assertPublishResponseSafe(serializedJson: string): void {
  const forbidden = [
    "packetJson",
    "packet_json",
    '"planningTruth"',
    "planning_truth",
    "proseText",
    "prose_text",
    "full_prompt",
    "openrouter",
    "delta_json",
    "deltaJson",
    '"payload"',
  ];
  for (const key of forbidden) {
    if (serializedJson.includes(key)) {
      throw AppError.internal("Publish API response failed safety check");
    }
  }
}

export function detectOverclaimUnlock(text: string): boolean {
  return OVERCLAIM_PATTERNS.some((p) => p.test(text));
}

export function assertProseExcerptSafe(excerpt: string): void {
  assertPublishTextSafe(excerpt, "prose excerpt");
}