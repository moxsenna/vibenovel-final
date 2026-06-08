import type { WriterContextPacket } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { assertWriterPacketSafe } from "./context-packet-safety.js";
import { parsePacketJson } from "./context-packet-builder.js";
import type { PromptMessage } from "./ai-generation-types.js";
import type { ChapterBeatRow } from "../lib/mappers.js";

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

function buildUserPromptSections(
  packet: WriterContextPacket,
  beat: ChapterBeatRow,
  instruction?: string,
): string {
  const sections: string[] = [
    `Chapter ${packet.meta.chapterNumber}: ${packet.currentChapter.title}`,
    `Beat ${beat.beat_number}: ${beat.title}`,
    `Beat goal: ${beat.summary}`,
  ];

  if (beat.direction?.trim()) {
    sections.push(`Direction: ${beat.direction.trim()}`);
  }
  if (packet.emotionalTarget.beatEmotionalShift) {
    sections.push(`Emotional shift: ${packet.emotionalTarget.beatEmotionalShift}`);
  }
  if (packet.hookTarget.beatStopCondition) {
    sections.push(`Stop condition: ${packet.hookTarget.beatStopCondition}`);
  }

  sections.push(`Premise: ${packet.foundation.premiseSummary}`);
  sections.push(`Main conflict: ${packet.foundation.mainConflictSummary}`);
  sections.push(`Reader promise: ${packet.foundation.readerPromise}`);

  if (packet.constraints.mustInclude.length > 0) {
    sections.push(`Must include: ${packet.constraints.mustInclude.join("; ")}`);
  }
  if (packet.constraints.mustNotInclude.length > 0) {
    sections.push(`Must avoid: ${packet.constraints.mustNotInclude.join("; ")}`);
  }
  if (packet.revealGate.forbiddenConcepts.length > 0) {
    sections.push(
      `Forbidden concepts: ${packet.revealGate.forbiddenConcepts.slice(0, 12).join(", ")}`,
    );
  }
  if (packet.constraints.mobileFormatRules.length > 0) {
    sections.push(`Format: ${packet.constraints.mobileFormatRules.join(" ")}`);
  }
  if (packet.constraints.wordTarget) {
    sections.push(`Target length: ~${packet.constraints.wordTarget} words`);
  }
  if (instruction?.trim()) {
    sections.push(`Writer note (bounded): ${instruction.trim()}`);
  }

  return sections.join("\n");
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
  const userContent = buildUserPromptSections(packet, beat, instruction);

  const promptMessages: PromptMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  const promptHash = await computePromptHashFromMessages(promptMessages);
  return { promptMessages, promptHash };
}