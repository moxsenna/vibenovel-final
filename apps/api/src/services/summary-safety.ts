import { AppError } from "../errors.js";

const PROSE_LEAKAGE_MARKERS = [
  "planningtruth",
  "planning_truth",
  "full_prompt",
  "context_packet",
  "packet_json",
  "openrouter",
  "provider",
  "model",
  "token",
];

const SUMMARY_OUTPUT_FORBIDDEN_PATTERNS = [
  /planningtruth/i,
  /planning_truth/i,
  /packet_json/i,
  /packetjson/i,
  /context_packet/i,
  /full_prompt/i,
  /openrouter/i,
];

export function assertProseTextsSafeForSummary(proseTexts: string[]): void {
  for (const text of proseTexts) {
    const lower = text.toLowerCase();
    for (const marker of PROSE_LEAKAGE_MARKERS) {
      if (lower.includes(marker.toLowerCase())) {
        throw AppError.badRequest(
          "Prose contains disallowed internal metadata markers — cannot generate summary",
        );
      }
    }
    if (
      lower.includes('"currentchapter"') &&
      lower.includes('"revealgate"') &&
      lower.includes('"forbiddenreveals"')
    ) {
      throw AppError.badRequest("Prose appears to contain a context packet dump");
    }
  }
}

export function assertSummaryTextSafe(text: string): void {
  for (const pattern of SUMMARY_OUTPUT_FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      throw AppError.internal("Generated summary failed safety check");
    }
  }
}

export function assertSummaryResponseSafe(serializedJson: string): void {
  const forbidden = [
    "packetJson",
    "packet_json",
    '"planningTruth"',
    "planning_truth",
    "proseText",
    "prose_text",
    "full_prompt",
    "openrouter",
  ];
  for (const key of forbidden) {
    if (serializedJson.includes(key)) {
      throw AppError.internal("Summary API response failed safety check");
    }
  }
}