import type { WriterContextPacket } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { assertWriterPacketSafe } from "./context-packet-safety.js";
import { parsePacketJson } from "./context-packet-builder.js";
import type { PromptMessage } from "./ai-generation-types.js";
import type { ChapterBeatRow } from "../lib/mappers.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";

export const PROSE_REWRITE_MODES = {
  improve_emotion: "improve_emotion",
  tighten_pacing: "tighten_pacing",
  natural_dialogue: "natural_dialogue",
  shorter: "shorter",
  longer: "longer",
  custom: "custom",
} as const;

export type ProseRewriteMode =
  (typeof PROSE_REWRITE_MODES)[keyof typeof PROSE_REWRITE_MODES];

const REWRITE_MODE_SET = new Set<string>(Object.values(PROSE_REWRITE_MODES));

const SYSTEM_PROMPT =
  "You are a mobile serial fiction editor for Indonesian HP/KBM readers. " +
  "Rewrite the provided beat prose according to the requested mode. " +
  "Preserve established facts, character intent, and story boundaries. " +
  "Do not add new plot facts or reveal future spoilers. " +
  "Output revised prose only — no headings, no JSON, no meta commentary.";

const MODE_INSTRUCTIONS: Record<ProseRewriteMode, string> = {
  improve_emotion:
    "Deepen emotional resonance and interiority while keeping the same story beats and facts.",
  tighten_pacing:
    "Reduce drag and sharpen scene movement; cut filler without removing key story beats.",
  natural_dialogue:
    "Improve dialogue naturalness and rhythm; preserve each speaker's intent and subtext.",
  shorter:
    "Compress the prose without removing key story beats or emotional turning points.",
  longer:
    "Expand sensory and emotional detail without adding new facts or future spoilers.",
  custom:
    "Follow the writer's bounded instruction while enforcing canon and context constraints.",
};

export interface ProseRewritePromptResult {
  promptMessages: PromptMessage[];
  promptHash: string;
}

export function parseProseRewriteMode(value: unknown): ProseRewriteMode {
  if (typeof value !== "string" || !REWRITE_MODE_SET.has(value)) {
    throw AppError.badRequest(
      "rewriteMode must be improve_emotion, tighten_pacing, natural_dialogue, shorter, longer, or custom",
    );
  }
  return value as ProseRewriteMode;
}

function buildRewriteUserSections(
  packet: WriterContextPacket,
  beat: ChapterBeatRow,
  sourceProseText: string,
  rewriteMode: ProseRewriteMode,
  instruction?: string,
): string {
  const sections: string[] = [
    `Rewrite mode: ${rewriteMode}`,
    `Mode goal: ${MODE_INSTRUCTIONS[rewriteMode]}`,
    `Chapter ${packet.meta.chapterNumber}: ${packet.currentChapter.title}`,
    `Beat ${beat.beat_number}: ${beat.title}`,
    `Beat goal: ${beat.summary}`,
  ];

  if (beat.direction?.trim()) {
    sections.push(`Direction: ${beat.direction.trim()}`);
  }
  if (packet.constraints.mustInclude.length > 0) {
    sections.push(`Must preserve: ${packet.constraints.mustInclude.join("; ")}`);
  }
  if (packet.constraints.mustNotInclude.length > 0) {
    sections.push(`Must avoid: ${packet.constraints.mustNotInclude.join("; ")}`);
  }
  if (packet.revealGate.forbiddenConcepts.length > 0) {
    sections.push(
      `Forbidden concepts: ${packet.revealGate.forbiddenConcepts.slice(0, 12).join(", ")}`,
    );
  }
  if (rewriteMode === PROSE_REWRITE_MODES.custom && instruction?.trim()) {
    sections.push(`Writer instruction: ${instruction.trim()}`);
  }
  sections.push("--- Current prose (rewrite this) ---");
  sections.push(sourceProseText.trim());

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
    console.error("context_packet_logs select for rewrite prompt failed");
    throw AppError.internal("Failed to load context for rewrite");
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

/** Build provider-safe rewrite prompt — never logs raw prompt. */
export async function buildProseRewritePrompt(
  bindings: AppBindings,
  projectId: string,
  packetLogId: string,
  beat: ChapterBeatRow,
  sourceProseText: string,
  rewriteMode: ProseRewriteMode,
  instruction?: string,
): Promise<ProseRewritePromptResult> {
  const packet = await loadSafePacketFromLog(bindings, projectId, packetLogId);
  const userContent = buildRewriteUserSections(
    packet,
    beat,
    sourceProseText,
    rewriteMode,
    instruction,
  );

  const promptMessages: PromptMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  const promptHash = await computePromptHashFromMessages(promptMessages);
  return { promptMessages, promptHash };
}