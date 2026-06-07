import type { WriterContextPacket } from "@vibenovel/shared";
import { AppError } from "../errors.js";

export const PACKET_MAX_BYTES = 64 * 1024;

const FORBIDDEN_KEY_PATTERNS = [
  /planningTruth/i,
  /planning_truth/i,
  /full_prompt/i,
  /chapter_text/i,
  /prose_text/i,
  /openrouter/i,
  /\bmodel\b/i,
  /\bprovider\b/i,
  /\btoken\b/i,
];

export interface PacketSafetyResult {
  planningTruthPresent: false;
  futureChapterSummaryPresent: false;
  packetBytes: number;
  truncated: boolean;
}

export interface AssertWriterPacketSafeOptions {
  currentChapterNumber: number;
  futureChapterSummaries: string[];
  futureChapterTitles: string[];
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

export function canonicalPacketJson(packet: WriterContextPacket): string {
  return JSON.stringify(canonicalize(packet));
}

export async function computePacketHash(packet: WriterContextPacket): Promise<string> {
  const canonical = canonicalPacketJson(packet);
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function extractForbiddenConcepts(title: string, hint: string | null): string[] {
  const raw = `${title} ${hint ?? ""}`.toLowerCase();
  const tokens = raw
    .split(/[\s,;:.!?()[\]{}'"–—-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  return [...new Set(tokens)].slice(0, 12);
}

function containsForbiddenKey(json: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(json));
}

function containsFutureContent(
  json: string,
  futureSummaries: string[],
  futureTitles: string[],
): boolean {
  const lower = json.toLowerCase();
  for (const title of futureTitles) {
    const t = title.trim().toLowerCase();
    if (t.length >= 8 && lower.includes(t)) {
      return true;
    }
  }
  for (const summary of futureSummaries) {
    const snippet = summary.trim().slice(0, 80).toLowerCase();
    if (snippet.length >= 20 && lower.includes(snippet)) {
      return true;
    }
  }
  return false;
}

export function assertWriterPacketSafe(
  packet: WriterContextPacket,
  options: AssertWriterPacketSafeOptions,
): PacketSafetyResult {
  const json = canonicalPacketJson(packet);
  const packetBytes = new TextEncoder().encode(json).length;

  if (containsForbiddenKey(json)) {
    console.error("context packet safety: forbidden key pattern detected");
    throw AppError.internal("Context packet failed safety checks");
  }

  if (containsFutureContent(json, options.futureChapterSummaries, options.futureChapterTitles)) {
    console.error("context packet safety: future chapter content detected");
    throw AppError.internal("Context packet failed safety checks");
  }

  if (packet.meta.chapterNumber !== options.currentChapterNumber) {
    console.error("context packet safety: chapter number mismatch");
    throw AppError.internal("Context packet failed safety checks");
  }

  if (packetBytes > PACKET_MAX_BYTES) {
    console.error("context packet safety: packet exceeds size limit");
    throw AppError.internal("Context packet failed safety checks");
  }

  return {
    planningTruthPresent: false,
    futureChapterSummaryPresent: false,
    packetBytes,
    truncated: packet.meta.truncated === true,
  };
}