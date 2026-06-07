import {
  MOBILE_FORMAT_PREFERENCES,
  PLANNED_REVEAL_STATUSES,
  type CharacterSafeSummary,
  type ForbiddenRevealEntry,
  type JsonObject,
  type OpenLoopSafeSummary,
  type RevealSafeSummary,
  type SpeechRuleSummary,
  type WriterContextPacket,
  type WriterContextPacketPreview,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import {
  assertWriterPacketSafe,
  computePacketHash,
  extractForbiddenConcepts,
} from "./context-packet-safety.js";
import {
  filterActiveOpenLoops,
  loadWriteContextSnapshot,
  type WriteSnapshotInput,
} from "./write-snapshot.js";

const PREVIOUS_SUMMARY_MAX = 500;
const MAX_PREVIOUS_SUMMARIES = 20;
const MAX_FACTS = 50;
const MAX_CHARACTERS = 20;

const ACTIVE_REVEAL_STATUSES = new Set<string>([
  PLANNED_REVEAL_STATUSES.planned,
  PLANNED_REVEAL_STATUSES.armed,
  PLANNED_REVEAL_STATUSES.revealed,
  PLANNED_REVEAL_STATUSES.delayed,
]);

export interface BuildContextPacketInput {
  chapterOutlineId: string;
  beatId?: string;
}

export interface ContextPacketSafetyMeta {
  planningTruthPresent: false;
  futureChapterSummaryPresent: false;
  packetHash: string;
  builderVersion: string;
}

export interface BuildContextPacketResult {
  packetLogId: string;
  preview: WriterContextPacketPreview;
  safety: ContextPacketSafetyMeta;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function buildMobileFormatRules(format: string): string[] {
  if (format === MOBILE_FORMAT_PREFERENCES.desktop) {
    return ["Paragraf pendek untuk keterbacaan layar."];
  }
  return [
    "Format HP/KBM: paragraf 1–3 kalimat.",
    "Dialog dan narasi seimbang untuk scroll mobile.",
    "Hindari blok teks panjang.",
  ];
}

function buildCharacterSummaries(
  characters: Awaited<ReturnType<typeof loadWriteContextSnapshot>>["characters"],
): CharacterSafeSummary[] {
  return characters.slice(0, MAX_CHARACTERS).map((ch) => ({
    id: ch.id,
    name: ch.name,
    roleLabel: ch.roleLabel,
    descriptionSummary: truncateText(ch.description, 300),
  }));
}

function buildSpeechRuleSummaries(
  rules: Awaited<ReturnType<typeof loadWriteContextSnapshot>>["speechRules"],
): SpeechRuleSummary[] {
  return rules.map((rule) => ({
    id: rule.id,
    relationshipLabel: rule.relationshipLabel,
    ruleText: rule.ruleText,
    examples: rule.examples,
  }));
}

function buildRevealGate(
  reveals: Awaited<ReturnType<typeof loadWriteContextSnapshot>>["plannedReveals"],
  currentChapterNumber: number,
): WriterContextPacket["revealGate"] {
  const allowedBreadcrumbs: string[] = [];
  const allowedReveals: RevealSafeSummary[] = [];
  const forbiddenReveals: ForbiddenRevealEntry[] = [];
  const forbiddenConcepts = new Set<string>();

  for (const reveal of reveals) {
    if (!ACTIVE_REVEAL_STATUSES.has(reveal.status)) {
      continue;
    }

    const forbiddenBefore = reveal.forbidden_before_chapter ?? Number.MAX_SAFE_INTEGER;
    if (forbiddenBefore > currentChapterNumber) {
      const concepts = extractForbiddenConcepts(reveal.title, reveal.reader_facing_hint);
      forbiddenReveals.push({
        id: reveal.id,
        label: reveal.title,
        forbiddenConcepts: concepts,
      });
      for (const c of concepts) {
        forbiddenConcepts.add(c);
      }
      continue;
    }

    allowedReveals.push({
      id: reveal.id,
      title: reveal.title,
      readerFacingHint: reveal.reader_facing_hint,
    });

    const hint = reveal.reader_facing_hint?.trim();
    if (hint) {
      allowedBreadcrumbs.push(hint);
    }
  }

  return {
    allowedBreadcrumbs,
    allowedReveals,
    forbiddenReveals,
    forbiddenConcepts: [...forbiddenConcepts],
  };
}

function buildOpenLoopSummaries(
  loops: ReturnType<typeof filterActiveOpenLoops>,
  chapterNumberByOutlineId: Map<string, number>,
  currentChapterNumber: number,
): OpenLoopSafeSummary[] {
  return loops.map((loop) => {
    const payoffId = loop.payoffChapterOutlineId;
    let hint = loop.readerFacingHint;
    if (payoffId) {
      const payoffChapter = chapterNumberByOutlineId.get(payoffId);
      if (payoffChapter !== undefined && payoffChapter > currentChapterNumber) {
        hint = null;
      }
    }
    return {
      id: loop.id,
      question: loop.question,
      readerFacingHint: hint,
      status: loop.status,
    };
  });
}

function buildWriterPacketFromSnapshot(
  snapshot: Awaited<ReturnType<typeof loadWriteContextSnapshot>>,
  generatedAt: string,
  packetHashPlaceholder: string,
): WriterContextPacket {
  const current = snapshot.currentChapter;
  const currentNumber = current.chapterNumber;

  const activeLoops = filterActiveOpenLoops(
    snapshot.openLoops,
    snapshot.chapterNumberByOutlineId,
    currentNumber,
  );

  let previousSummaries = snapshot.previousChapters.map((ch) =>
    truncateText(ch.summary, PREVIOUS_SUMMARY_MAX),
  );
  let truncated = false;
  if (previousSummaries.length > MAX_PREVIOUS_SUMMARIES) {
    previousSummaries = previousSummaries.slice(-MAX_PREVIOUS_SUMMARIES);
    truncated = true;
  }

  const revealGate = buildRevealGate(snapshot.plannedReveals, currentNumber);
  const openLoopsActive = buildOpenLoopSummaries(
    activeLoops,
    snapshot.chapterNumberByOutlineId,
    currentNumber,
  );

  const mustInclude = snapshot.beat?.mustInclude ?? [];
  const mustNotInclude = [
    ...(snapshot.beat?.mustNotInclude ?? []),
    ...revealGate.forbiddenConcepts,
  ];

  return {
    meta: {
      projectId: snapshot.project.id,
      chapterOutlineId: current.id,
      chapterNumber: currentNumber,
      ...(snapshot.beat
        ? { beatId: snapshot.beat.id, beatNumber: snapshot.beat.beatNumber }
        : {}),
      builderVersion: snapshot.builderVersion,
      packetHash: packetHashPlaceholder,
      generatedAt,
      ...(truncated ? { truncated: true } : {}),
    },
    foundation: {
      premiseSummary: truncateText(snapshot.foundation.premise, 1000),
      mainConflictSummary: truncateText(snapshot.foundation.main_conflict, 1000),
      readerPromise: truncateText(snapshot.foundation.reader_promise, 1000),
      tone: snapshot.foundation.tone,
      storySecretsPreview: snapshot.foundation.story_secrets_preview,
    },
    concept: {
      title: snapshot.concept.title,
      shortPitch: snapshot.concept.short_pitch,
      readerPromise: snapshot.concept.reader_promise,
    },
    canon: {
      characters: buildCharacterSummaries(snapshot.characters),
      facts: snapshot.facts.slice(0, MAX_FACTS).map((f) => f.text),
      speechRules: buildSpeechRuleSummaries(snapshot.speechRules),
    },
    currentChapter: {
      title: current.title,
      summary: current.summary,
      purpose: current.purpose,
      chapterFunction: current.chapterFunction,
      emotionalDirection: current.emotionalDirection,
      endingHook: current.endingHook,
      miniVictory: current.miniVictory,
      hook: current.hook,
      markers: current.markers,
    },
    continuity: {
      previousChapterSummaries: previousSummaries,
      openLoopsActive,
      unresolvedThreadLabels: activeLoops.map((loop) => loop.question),
    },
    revealGate,
    emotionalTarget: {
      chapterEmotion: current.emotionalDirection,
      beatEmotionalShift: snapshot.beat?.emotionalShift ?? null,
    },
    hookTarget: {
      chapterEndingHook: current.endingHook ?? current.hook,
      beatStopCondition: snapshot.beat?.stopCondition ?? null,
    },
    constraints: {
      mustInclude,
      mustNotInclude: [...new Set(mustNotInclude)],
      wordTarget: snapshot.beat?.wordTarget ?? null,
      mobileFormatRules: buildMobileFormatRules(snapshot.mobileFormat),
    },
  };
}

export function buildPreviewFromPacket(
  packet: WriterContextPacket,
  packetLogId: string,
  options?: { beatTitle?: string | null; beatDirection?: string | null },
): WriterContextPacketPreview {
  const emotionalTarget =
    packet.emotionalTarget.beatEmotionalShift ??
    packet.emotionalTarget.chapterEmotion ??
    null;

  const hookTarget =
    packet.hookTarget.beatStopCondition ?? packet.hookTarget.chapterEndingHook ?? null;

  const storyCheckLabels = [
    "Cerita nyambung",
    "Rahasia belum bocor",
    "Format enak dibaca di HP",
  ];
  if (packet.revealGate.forbiddenReveals.length > 0) {
    storyCheckLabels.push("Rahasia masa depan ditahan");
  }

  const hasBeat = packet.meta.beatNumber !== undefined;

  return {
    chapterNumber: packet.meta.chapterNumber,
    chapterTitle: packet.currentChapter.title,
    ...(hasBeat ? { beatNumber: packet.meta.beatNumber } : {}),
    ...(options?.beatTitle ? { beatTitle: options.beatTitle } : {}),
    direction:
      options?.beatDirection ??
      (hasBeat ? null : packet.currentChapter.purpose),
    emotionalTarget,
    hookTarget,
    mustInclude: packet.constraints.mustInclude,
    mustNotInclude: packet.constraints.mustNotInclude,
    storyCheckLabels,
    packetLogId,
  };
}

function parsePacketJson(value: unknown): WriterContextPacket {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw AppError.internal("Stored context packet is invalid");
  }
  return value as WriterContextPacket;
}

export async function buildContextPacketForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<BuildContextPacketResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const chapterOutlineId = body.chapterOutlineId;
  if (typeof chapterOutlineId !== "string" || !chapterOutlineId.trim()) {
    throw AppError.badRequest("chapterOutlineId is required");
  }

  let beatId: string | undefined;
  if (body.beatId !== undefined && body.beatId !== null) {
    if (typeof body.beatId !== "string" || !body.beatId.trim()) {
      throw AppError.badRequest("beatId must be a non-empty string when provided");
    }
    beatId = body.beatId.trim();
  }

  const input: WriteSnapshotInput = {
    chapterOutlineId: chapterOutlineId.trim(),
    beatId,
  };

  const snapshot = await loadWriteContextSnapshot(bindings, ownerId, projectId, input);
  const generatedAt = new Date().toISOString();

  let packet = buildWriterPacketFromSnapshot(snapshot, generatedAt, "pending");
  const packetHash = await computePacketHash(packet);
  packet = {
    ...packet,
    meta: { ...packet.meta, packetHash },
  };

  assertWriterPacketSafe(packet, {
    currentChapterNumber: snapshot.currentChapter.chapterNumber,
    futureChapterSummaries: snapshot.futureChapterSummaries,
    futureChapterTitles: snapshot.futureChapterTitles,
  });

  const admin = createServiceRoleClient(bindings);
  const { data: inserted, error: insertError } = await admin
    .from("context_packet_logs")
    .insert({
      project_id: projectId,
      writing_session_id: null,
      chapter_outline_id: snapshot.currentChapter.id,
      chapter_beat_id: snapshot.beat?.id ?? null,
      chapter_number: snapshot.currentChapter.chapterNumber,
      packet_hash: packetHash,
      packet_json: packet as unknown as JsonObject,
      builder_version: snapshot.builderVersion,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("context_packet_logs insert failed");
    throw AppError.internal("Failed to persist context packet");
  }

  const packetLogId = (inserted as { id: string }).id;
  const preview = buildPreviewFromPacket(packet, packetLogId, {
    beatTitle: snapshot.beat?.title ?? null,
    beatDirection: snapshot.beat?.direction ?? null,
  });

  return {
    packetLogId,
    preview,
    safety: {
      planningTruthPresent: false,
      futureChapterSummaryPresent: false,
      packetHash,
      builderVersion: snapshot.builderVersion,
    },
  };
}

export async function getContextPacketPreviewForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  logId: string,
): Promise<WriterContextPacketPreview> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("context_packet_logs")
    .select("id, project_id, packet_json, chapter_beat_id")
    .eq("id", logId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("context_packet_logs select failed");
    throw AppError.internal("Failed to load context packet log");
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

  let beatTitle: string | null = null;
  let beatDirection: string | null = null;
  const beatId = (data as { chapter_beat_id: string | null }).chapter_beat_id;
  if (beatId) {
    const { data: beatRow } = await admin
      .from("chapter_beats")
      .select("title, direction")
      .eq("id", beatId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (beatRow) {
      beatTitle = (beatRow as { title: string }).title;
      beatDirection = (beatRow as { direction: string | null }).direction;
    }
  }

  return buildPreviewFromPacket(packet, logId, {
    beatTitle,
    beatDirection,
  });
}