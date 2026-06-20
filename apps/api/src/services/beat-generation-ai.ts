import {
  CHAPTER_BEAT_STATUSES,
  GENERATION_STATUSES,
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type ChapterBeat,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { mapChapterBeatRow, type ChapterBeatRow, type WritingSessionRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { getCreditCostForGeneration } from "./ai-credit-policy.js";
import { assertAiGenerationAllowedForOwner } from "./ai-rate-limit.js";
import { generateCorrelationId } from "./audit-snapshot.js";
import {
  CREDIT_LEDGER_REASONS,
  debitCreditsForAttempt,
  refundCreditsForAttempt,
} from "./credit-ledger.js";
import {
  createGenerationAttempt,
  getGenerationAttemptByIdempotencyKey,
  markGenerationAttemptFailed,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
  toGenerationAttemptSafeSummary,
} from "./generation-attempt.js";
import {
  assertGenerationRouteCallable,
  generateWithModelRouter,
} from "./model-router.js";
import { createProviderEventSequence } from "./generation-provider-event.js";
import { loadBeatGenerationSnapshot } from "./beat-generation-snapshot.js";
import {
  buildBeatGenerationPromptMessages,
  stripBeatJsonFences,
  type BeatAiDraft,
} from "./beat-generation-prompt.js";

export const BEAT_AI_GENERATOR_MARKER = "beat_ai_generator";

const BEAT_SELECT =
  "id, project_id, chapter_outline_id, writing_session_id, beat_number, title, summary, direction, status, emotional_shift, must_include, must_not_include, word_target, stop_condition, sort_order, metadata, created_at, updated_at";

const TITLE_MAX = 200;
const SUMMARY_MAX = 2000;
const DIRECTION_MAX = 2000;
const TEXT_FIELD_MAX = 500;
const ARRAY_MAX = 20;
const MIN_BEATS = 5;
const MAX_BEATS = 8;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null;
}

function stringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      continue;
    }
    out.push(item.trim().slice(0, TEXT_FIELD_MAX));
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export function parseAndValidateBeatAiOutput(text: string): BeatAiDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBeatJsonFences(text));
  } catch {
    throw new AppError(
      "GENERATION_FAILED",
      "AI mengembalikan format beat yang tidak valid. Coba lagi.",
      502,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("GENERATION_FAILED", "AI tidak mengembalikan beat yang valid. Coba lagi.", 502);
  }

  const beatsRaw = (parsed as Record<string, unknown>).beats;
  if (!Array.isArray(beatsRaw)) {
    throw new AppError("GENERATION_FAILED", "AI tidak mengembalikan daftar beat. Coba lagi.", 502);
  }

  if (beatsRaw.length < MIN_BEATS || beatsRaw.length > MAX_BEATS) {
    throw new AppError(
      "GENERATION_FAILED",
      `AI harus mengembalikan ${MIN_BEATS}–${MAX_BEATS} beat. Coba lagi.`,
      502,
    );
  }

  const drafts: BeatAiDraft[] = [];
  for (let i = 0; i < beatsRaw.length; i++) {
    const raw = beatsRaw[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new AppError("GENERATION_FAILED", `Beat ${i + 1} tidak valid. Coba lagi.`, 502);
    }
    const row = raw as Record<string, unknown>;
    const beatNumber = num(row.beatNumber) ?? i + 1;
    const title = str(row.title).slice(0, TITLE_MAX);
    const summary = str(row.summary).slice(0, SUMMARY_MAX);
    const direction = str(row.direction).slice(0, DIRECTION_MAX);
    const emotionalShift = str(row.emotionalShift).slice(0, TEXT_FIELD_MAX);
    const stopCondition = str(row.stopCondition).slice(0, TEXT_FIELD_MAX);
    const wordTargetRaw = num(row.wordTarget);
    const wordTarget =
      wordTargetRaw !== null && wordTargetRaw >= 100 && wordTargetRaw <= 800
        ? wordTargetRaw
        : 350;

    if (!title || !summary || !direction) {
      throw new AppError(
        "GENERATION_FAILED",
        `Beat ${i + 1} kurang title/summary/direction. Coba lagi.`,
        502,
      );
    }

    drafts.push({
      beatNumber,
      title,
      summary,
      direction,
      emotionalShift: emotionalShift || "netral",
      mustInclude: stringArray(row.mustInclude, ARRAY_MAX),
      mustNotInclude: stringArray(row.mustNotInclude, ARRAY_MAX),
      wordTarget,
      stopCondition: stopCondition || "Adegan beat selesai.",
    });
  }

  drafts.sort((a, b) => a.beatNumber - b.beatNumber);
  return drafts;
}

async function loadBeatsByIds(
  bindings: AppBindings,
  projectId: string,
  beatIds: string[],
): Promise<ChapterBeat[]> {
  if (beatIds.length === 0) {
    return [];
  }
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_beats")
    .select(BEAT_SELECT)
    .eq("project_id", projectId)
    .in("id", beatIds);

  if (error || !data) {
    console.error("chapter_beats select after AI insert failed");
    throw AppError.internal("Failed to load generated beats");
  }

  return (data as ChapterBeatRow[])
    .sort((a, b) => a.sort_order - b.sort_order || a.beat_number - b.beat_number)
    .map(mapChapterBeatRow);
}

export async function generateBeatsWithAiForSession(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  sessionRow: WritingSessionRow,
  regenerate: boolean,
): Promise<{ beats: ChapterBeat[]; created: boolean }> {
  const idempotencyKey = `beat:${sessionRow.id}:${regenerate ? "1" : "0"}`;
  const generationType = GENERATION_TYPES.beat_generation;
  const qualityMode = WRITER_QUALITY_MODES.hemat;
  const creditCost = getCreditCostForGeneration({ generationType, qualityMode });

  const existingAttempt = await getGenerationAttemptByIdempotencyKey(
    bindings,
    ownerId,
    idempotencyKey,
  );

  if (existingAttempt) {
    const beatIds = Array.isArray(existingAttempt.metadata?.beatIds)
      ? (existingAttempt.metadata!.beatIds as string[])
      : null;

    if (
      existingAttempt.status === GENERATION_STATUSES.succeeded &&
      beatIds &&
      beatIds.length > 0
    ) {
      const beats = await loadBeatsByIds(bindings, projectId, beatIds);
      if (beats.length > 0) {
        return { beats, created: false };
      }
    }
    if (
      existingAttempt.status === GENERATION_STATUSES.pending ||
      existingAttempt.status === GENERATION_STATUSES.running
    ) {
      throw new AppError(
        "GENERATION_IN_PROGRESS",
        "Beat generation is already in progress for this session",
        409,
      );
    }
    if (existingAttempt.status === GENERATION_STATUSES.failed) {
      throw new AppError(
        "GENERATION_FAILED",
        "Previous beat generation failed for this session",
        422,
        { generationAttempt: toGenerationAttemptSafeSummary(existingAttempt) },
      );
    }
  }

  const snapshot = await loadBeatGenerationSnapshot(bindings, ownerId, projectId, sessionRow);
  const { promptMessages, promptHash } = await buildBeatGenerationPromptMessages(snapshot);

  await assertAiGenerationAllowedForOwner(bindings, {
    userId: ownerId,
    projectId,
    generationType,
    requestedCreditCost: creditCost,
  });

  const correlationId = generateCorrelationId();

  assertGenerationRouteCallable(bindings, { generationType, qualityMode });

  let attempt = await createGenerationAttempt(bindings, {
    projectId,
    userId: ownerId,
    chapterOutlineId: sessionRow.chapter_outline_id,
    writingSessionId: sessionRow.id,
    generationType,
    idempotencyKey,
    creditCost,
    promptHash,
    correlationId,
    qualityMode,
    metadata: { regenerate, task: "12.2" },
  });
  const providerEventSequence = createProviderEventSequence();

  try {
    await debitCreditsForAttempt(bindings, {
      userId: ownerId,
      projectId,
      attemptId: attempt.id,
      amount: creditCost,
      reason: CREDIT_LEDGER_REASONS.generationDebit,
      generationType,
      qualityMode,
      idempotencyKey,
      correlationId,
    });
  } catch (err) {
    await markGenerationAttemptFailed(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      errorCode: err instanceof AppError ? err.code : "DEBIT_FAILED",
      errorMessage: err instanceof Error ? err.message : "Credit debit failed",
      correlationId,
    });
    throw err;
  }

  attempt = await markGenerationAttemptRunning(bindings, attempt.id);

  try {
    const routerResult = await generateWithModelRouter(bindings, {
      generationAttemptId: attempt.id,
      providerEventSequence,
      generationType,
      qualityMode,
      promptHash,
      promptMessages,
      temperature: 0.35,
      validateOutput: parseAndValidateBeatAiOutput,
    });

    const drafts = routerResult.output;

    const admin = createServiceRoleClient(bindings);
    const inserts = drafts.map((draft, index) => ({
      project_id: projectId,
      chapter_outline_id: sessionRow.chapter_outline_id,
      writing_session_id: sessionRow.id,
      beat_number: draft.beatNumber,
      title: draft.title,
      summary: draft.summary,
      direction: draft.direction,
      status: CHAPTER_BEAT_STATUSES.empty,
      emotional_shift: draft.emotionalShift,
      must_include: draft.mustInclude,
      must_not_include: draft.mustNotInclude,
      word_target: draft.wordTarget,
      stop_condition: draft.stopCondition,
      sort_order: index + 1,
      metadata: { generator: BEAT_AI_GENERATOR_MARKER },
    }));

    const { data, error } = await admin.from("chapter_beats").insert(inserts).select(BEAT_SELECT);

    if (error || !data) {
      console.error("chapter_beats insert AI failed");
      throw new AppError("GENERATION_FAILED", "Gagal menyimpan beat. Coba lagi.", 502);
    }

    const rows = data as ChapterBeatRow[];
    const beatIds = rows.map((row) => row.id);

    await markGenerationAttemptSucceeded(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      provider: routerResult.provider,
      model: routerResult.model,
      logicalModel: routerResult.logicalModel,
      routingPolicyVersion: routerResult.routingPolicyVersion,
      fallbackUsed: routerResult.fallbackUsed,
      retryCount: routerResult.retryCount,
      providerLatencyMs: routerResult.latencyMs,
      estimatedCostUsd: routerResult.estimatedCostUsd,
      inputTokens: routerResult.inputTokens,
      outputTokens: routerResult.outputTokens,
      outputEntityId: beatIds[0] ?? "00000000-0000-0000-0000-000000000000",
      outputEntityType: "chapter_beat",
      correlationId,
      additionalMetadata: { beatIds },
    });

    const beats = rows
      .sort((a, b) => a.sort_order - b.sort_order || a.beat_number - b.beat_number)
      .map(mapChapterBeatRow);

    return { beats, created: true };
  } catch (err) {
    try {
      await refundCreditsForAttempt(bindings, {
        userId: ownerId,
        projectId,
        attemptId: attempt.id,
        amount: creditCost,
        reason: CREDIT_LEDGER_REASONS.generationRefund,
        generationType,
        qualityMode,
        idempotencyKey,
        correlationId,
      });
    } catch (refundErr) {
      console.error("credit refund failed:", refundErr);
    }
    await markGenerationAttemptFailed(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      errorCode: err instanceof AppError ? err.code : "AI_FAILED",
      errorMessage: err instanceof Error ? err.message : "AI beat generation failed",
      correlationId,
    });
    throw err;
  }
}
