import type { WriterContextPacket } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { assertWriterPacketSafe } from "./context-packet-safety.js";
import { parsePacketJson } from "./context-packet-builder.js";
import type { PromptMessage } from "./ai-generation-types.js";
import type { ChapterBeatRow } from "../lib/mappers.js";
import { serializeContext } from "./writer-context-serializer.js";
import type { BudgetProfile } from "./writer-context-serializer.js";

export interface ProseBeatPromptResult {
  promptMessages: PromptMessage[];
  promptHash: string;
}

const SYSTEM_PROMPT =
  "You are a mobile serial fiction writer for Indonesian HP/KBM readers. " +
  "Write vivid, emotionally engaging prose for ONE beat only. " +
  "Stay in present story scope. Do not reveal future spoilers. " +
  "Output prose only — no headings, no JSON, no meta commentary.";

function canonicalizePromptMessages(messages: PromptMessage[]): string {
  return JSON.stringify(
    messages.map((m) => ({ role: m.role, content: m.content })),
  );
}

export async function computePromptHashFromMessages(
  messages: PromptMessage[],
): Promise<string> {
  const canonical = canonicalizePromptMessages(messages);
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadSafePacketFromLog(
  bindings: AppBindings,
  projectId: string,
  packetLogId: string,
): Promise<WriterContextPacket> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("context_packet_logs")
    .select("packet_json, chapter_number")
    .eq("id", packetLogId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("context_packet_logs select for prompt failed");
    throw AppError.internal("Failed to load context for generation");
  }
  if (!data) {
    throw AppError.notFound("Context packet log not found");
  }

  const packet = parsePacketJson((data as { packet_json: unknown }).packet_json);
  assertWriterPacketSafe(packet, {
    currentChapterNumber: packet.meta.chapterNumber,
    futureChapterSummaries: [],
    futureChapterTitles: [],
  });
  return packet;
}

/** Build provider-safe prompt from persisted context packet — never logs raw prompt. */
export async function buildProseBeatPrompt(
  bindings: AppBindings,
  projectId: string,
  packetLogId: string,
  beat: ChapterBeatRow,
  instruction?: string,
): Promise<ProseBeatPromptResult> {
  const packet = await loadSafePacketFromLog(bindings, projectId, packetLogId);
  return buildProseBeatPromptFromPacket(packet, beat, instruction);
}

/** Build provider-safe prompt directly from in-memory packet — no DB re-read. */
export async function buildProseBeatPromptFromPacket(
  packet: WriterContextPacket,
  beat: ChapterBeatRow,
  instruction?: string,
  profile: BudgetProfile = "conservative",
): Promise<ProseBeatPromptResult> {
  const serialized = serializeContext(packet, profile);

  const beatSection = [
    `Beat ${beat.beat_number}: ${beat.title}`,
    `Beat goal: ${beat.summary}`,
    beat.direction?.trim() ? `Direction: ${beat.direction.trim()}` : null,
    instruction?.trim() ? `Writer note (bounded): ${instruction.trim()}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join("\n");

  const userContent = `${serialized.text}\n\n[CURRENT BEAT]\n${beatSection}`;

  const promptMessages: PromptMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  const promptHash = await computePromptHashFromMessages(promptMessages);
  return { promptMessages, promptHash };
}
