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

const DELTA_FORBIDDEN_PATTERNS = [
  ...SUMMARY_OUTPUT_FORBIDDEN_PATTERNS,
  /prose_text/i,
  /proseText/i,
  /\bprovider\b/i,
  /\bmodel\b/i,
  /\btoken\b/i,
];

export function assertDeltaJsonSafe(deltaJson: unknown): void {
  const serialized = JSON.stringify(deltaJson);
  for (const pattern of DELTA_FORBIDDEN_PATTERNS) {
    if (pattern.test(serialized)) {
      throw AppError.internal("Generated delta failed safety check");
    }
  }
}

export function assertProposalPayloadSafe(payload: Record<string, unknown>): void {
  const serialized = JSON.stringify(payload);
  for (const pattern of DELTA_FORBIDDEN_PATTERNS) {
    if (pattern.test(serialized)) {
      throw AppError.internal("Proposal payload failed safety check");
    }
  }
  for (const key of ["prose_text", "proseText", "packet_json", "packetJson", "full_prompt"]) {
    if (key in payload) {
      throw AppError.internal("Proposal payload failed safety check");
    }
  }
}