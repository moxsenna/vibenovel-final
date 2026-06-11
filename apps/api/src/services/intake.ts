import {
  DETECTED_SIGNAL_STATUSES,
  INTAKE_MESSAGE_ROLES,
  INTAKE_PHASES,
  INTAKE_SESSION_STATUSES,
  WORKFLOW_PHASES,
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type DetectedSignal,
  type DetectedSignalStatus,
  type DetectedSignalType,
  type IntakeMessage,
  type IntakePhase,
  type IntakeSession,
  type JsonObject,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  isAiGenerationEnabled,
  isAiProviderMock,
} from "../env.js";
import {
  mapDetectedSignalRow,
  mapIntakeMessageRow,
  mapIntakeSessionRow,
  type DetectedSignalRow,
  type IntakeMessageRow,
  type IntakeSessionRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import { generateWithModelRouter } from "./model-router.js";
import {
  debitCreditsForAttempt,
  refundCreditsForAttempt,
  CREDIT_LEDGER_REASONS,
} from "./credit-ledger.js";
import {
  createGenerationAttempt,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
  markGenerationAttemptFailed,
} from "./generation-attempt.js";
import { generateCorrelationId } from "./audit-snapshot.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";

const SESSION_SELECT =
  "id, project_id, status, phase, progress_percent, summary, metadata, created_at, updated_at";

const MESSAGE_SELECT =
  "id, project_id, session_id, role, content, metadata, created_at";

const SIGNAL_SELECT =
  "id, project_id, session_id, type, label, value, confidence, status, source_message_id, metadata, created_at, updated_at";

const PHASE_SET = new Set<string>(Object.values(INTAKE_PHASES));
const SIGNAL_STATUS_SET = new Set<string>(Object.values(DETECTED_SIGNAL_STATUSES));
const MESSAGE_ROLE_SET = new Set<string>(Object.values(INTAKE_MESSAGE_ROLES));

const CONTENT_MAX_LENGTH = 8000;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 200;
const RECENT_MESSAGE_LIMIT = 20;

const AGENT_STUB_DEFAULT =
  "Aku menangkap beberapa arah cerita. Kita akan kumpulkan tokoh, konflik, janji pembaca, dan rahasia yang perlu ditahan.";

const FORBIDDEN_BODY_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "sessionId",
  "session_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

interface ExtractedSignalDraft {
  type: DetectedSignalType;
  label: string;
  value: string;
  confidence: number;
}

function assertNoForbiddenKeys(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not allowed in request body`);
    }
  }
}

function assertMessageContent(content: unknown): string {
  if (typeof content !== "string") {
    throw AppError.badRequest("content must be a string");
  }
  const trimmed = content.trim();
  if (!trimmed) {
    throw AppError.badRequest("content is required");
  }
  if (trimmed.length > CONTENT_MAX_LENGTH) {
    throw AppError.badRequest(`content must be at most ${CONTENT_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function assertOptionalPhase(value: unknown): IntakePhase | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !PHASE_SET.has(value)) {
    throw AppError.badRequest("phase is invalid");
  }
  return value as IntakePhase;
}

function assertOptionalMetadata(value: unknown): JsonObject | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw AppError.badRequest("metadata must be an object");
  }
  return value as JsonObject;
}

function assertOptionalSignalStatus(value: unknown): DetectedSignalStatus | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !SIGNAL_STATUS_SET.has(value)) {
    throw AppError.badRequest("status is invalid");
  }
  return value as DetectedSignalStatus;
}

function parseLimit(value: string | undefined, defaultLimit: number): number {
  if (value === undefined || value === "") return defaultLimit;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw AppError.badRequest("limit must be a positive integer");
  }
  return Math.min(parsed, MAX_MESSAGE_LIMIT);
}

function buildAgentStubReply(userContent: string): string {
  const lower = userContent.toLowerCase();
  if (/istri|suami|mertua|rumah tangga/.test(lower)) {
    return "Aku menangkap nuansa drama rumah tangga. Ceritakan sedikit tentang tokoh utama dan apa yang paling menyakitkan baginya — kita kumpulkan konflik, janji pembaca, dan rahasia yang perlu ditahan.";
  }
  if (/balas dendam|bangkit|revenge/.test(lower)) {
    return "Ada energi bangkit dan balas dendam emosional di sini. Aku catat arah itu. Mau tambahkan detail tentang rahasia atau target pembacamu?";
  }
  if (/rahasia|selingkuh|hamil|anak/.test(lower)) {
    return "Aku melihat ada potensi rahasia besar di cerita ini. Kita akan tahan detail itu untuk fondasi nanti — lanjutkan dengan konflik utama yang paling ingin kamu tonjolkan.";
  }
  return AGENT_STUB_DEFAULT;
}


async function setProjectWorkflowPhaseIfSafe(
  bindings: AppBindings,
  projectId: string,
  phase: "intake" | "concepts" | "foundation" | "foundation_locked",
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("projects")
    .select("workflow_phase")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) return;

  const current = data.workflow_phase as string | null;
  if (current === WORKFLOW_PHASES.foundation_locked) return;
  if (phase === WORKFLOW_PHASES.intake && current === WORKFLOW_PHASES.foundation) return;

  await admin.from("projects").update({ workflow_phase: phase }).eq("id", projectId);
}

async function fetchLatestSessionRow(
  bindings: AppBindings,
  projectId: string,
  preferActive = true,
): Promise<IntakeSessionRow | null> {
  const admin = createServiceRoleClient(bindings);

  if (preferActive) {
    const { data: active, error: activeError } = await admin
      .from("intake_sessions")
      .select(SESSION_SELECT)
      .eq("project_id", projectId)
      .eq("status", INTAKE_SESSION_STATUSES.active)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error("intake_sessions select active failed");
      throw AppError.internal("Failed to load intake session");
    }
    if (active) return active as IntakeSessionRow;
  }

  const { data, error } = await admin
    .from("intake_sessions")
    .select(SESSION_SELECT)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("intake_sessions select latest failed");
    throw AppError.internal("Failed to load intake session");
  }

  return (data as IntakeSessionRow | null) ?? null;
}

async function createSessionRow(
  bindings: AppBindings,
  projectId: string,
  input?: { phase?: IntakePhase; metadata?: JsonObject },
): Promise<IntakeSessionRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("intake_sessions")
    .insert({
      project_id: projectId,
      status: INTAKE_SESSION_STATUSES.active,
      phase: input?.phase ?? INTAKE_PHASES.idea_collection,
      progress_percent: 0,
      metadata: input?.metadata ?? {},
    })
    .select(SESSION_SELECT)
    .single();

  if (error || !data) {
    console.error("intake_sessions insert failed");
    throw AppError.internal("Failed to create intake session");
  }

  return data as IntakeSessionRow;
}

async function getOrCreateActiveSessionRow(
  bindings: AppBindings,
  projectId: string,
): Promise<IntakeSessionRow> {
  const existing = await fetchLatestSessionRow(bindings, projectId, true);
  if (existing) return existing;
  return createSessionRow(bindings, projectId);
}

async function listMessagesForSession(
  bindings: AppBindings,
  projectId: string,
  sessionId: string,
  limit: number,
): Promise<IntakeMessage[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("intake_messages")
    .select(MESSAGE_SELECT)
    .eq("project_id", projectId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("intake_messages select failed");
    throw AppError.internal("Failed to load intake messages");
  }

  return ((data ?? []) as IntakeMessageRow[]).map(mapIntakeMessageRow);
}

async function listSignalsForSession(
  bindings: AppBindings,
  projectId: string,
  sessionId: string,
  statusFilter?: DetectedSignalStatus,
): Promise<DetectedSignal[]> {
  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("detected_signals")
    .select(SIGNAL_SELECT)
    .eq("project_id", projectId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("detected_signals select failed");
    throw AppError.internal("Failed to load detected signals");
  }

  return ((data ?? []) as DetectedSignalRow[]).map(mapDetectedSignalRow);
}

export interface IntakeBundle {
  session: IntakeSession;
  messages: IntakeMessage[];
  signals: DetectedSignal[];
}

export async function getIntakeBundleForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<IntakeBundle> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const sessionRow = await getOrCreateActiveSessionRow(bindings, projectId);
  const [messages, signals] = await Promise.all([
    listMessagesForSession(bindings, projectId, sessionRow.id, RECENT_MESSAGE_LIMIT),
    listSignalsForSession(bindings, projectId, sessionRow.id),
  ]);

  return {
    session: mapIntakeSessionRow(sessionRow),
    messages,
    signals,
  };
}

export async function createOrResetIntakeForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<IntakeSession> {
  assertNoForbiddenKeys(body);
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const phase = assertOptionalPhase(body.phase);
  const metadata = assertOptionalMetadata(body.metadata);

  const admin = createServiceRoleClient(bindings);
  const existing = await fetchLatestSessionRow(bindings, projectId, true);

  let sessionRow: IntakeSessionRow;

  if (existing) {
    const mergedMetadata =
      metadata !== undefined
        ? { ...parseJsonObject(existing.metadata), ...metadata }
        : parseJsonObject(existing.metadata);

    const { data, error } = await admin
      .from("intake_sessions")
      .update({
        status: INTAKE_SESSION_STATUSES.active,
        phase: phase ?? INTAKE_PHASES.idea_collection,
        progress_percent: 0,
        summary: null,
        metadata: mergedMetadata,
      })
      .eq("id", existing.id)
      .eq("project_id", projectId)
      .select(SESSION_SELECT)
      .single();

    if (error || !data) {
      console.error("intake_sessions reset failed");
      throw AppError.internal("Failed to reset intake session");
    }
    sessionRow = data as IntakeSessionRow;
  } else {
    sessionRow = await createSessionRow(bindings, projectId, { phase, metadata });
  }

  await setProjectWorkflowPhaseIfSafe(bindings, projectId, WORKFLOW_PHASES.intake);
  return mapIntakeSessionRow(sessionRow);
}

function parseJsonObject(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

export async function listIntakeMessagesForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  limitParam?: string,
): Promise<{ sessionId: string; messages: IntakeMessage[] }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const sessionRow = await getOrCreateActiveSessionRow(bindings, projectId);
  const limit = parseLimit(limitParam, DEFAULT_MESSAGE_LIMIT);
  const messages = await listMessagesForSession(
    bindings,
    projectId,
    sessionRow.id,
    limit,
  );

  return { sessionId: sessionRow.id, messages };
}

export interface AppendMessageResult {
  userMessage: IntakeMessage;
  agentMessage: IntakeMessage;
  session: IntakeSession;
}

export async function appendUserMessageForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<AppendMessageResult> {
  assertNoForbiddenKeys(body);
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const content = assertMessageContent(body.content);

  if (body.role !== undefined && body.role !== null) {
    if (typeof body.role !== "string" || !MESSAGE_ROLE_SET.has(body.role)) {
      throw AppError.badRequest("role is invalid");
    }
    if (body.role !== INTAKE_MESSAGE_ROLES.user) {
      throw AppError.badRequest("Only user role is allowed for public message creation");
    }
  }

  const sessionRow = await getOrCreateActiveSessionRow(bindings, projectId);
  const admin = createServiceRoleClient(bindings);

  const { data: userRow, error: userError } = await admin
    .from("intake_messages")
    .insert({
      project_id: projectId,
      session_id: sessionRow.id,
      role: INTAKE_MESSAGE_ROLES.user,
      content,
      metadata: { source: "api" },
    })
    .select(MESSAGE_SELECT)
    .single();

  if (userError || !userRow) {
    console.error("intake_messages insert user failed");
    throw AppError.internal("Failed to save user message");
  }

  const userMsgRow = userRow as IntakeMessageRow;
  let agentContent = "";
  let agentRow: IntakeMessageRow | null = null;
  let attempt = null;
  let debited = false;
  const correlationId = generateCorrelationId();

  const useMock = isAiProviderMock(bindings);
  const aiEnabled = isAiGenerationEnabled(bindings);

  if (aiEnabled && !useMock) {
    const historyMessages = await listMessagesForSession(bindings, projectId, sessionRow.id, RECENT_MESSAGE_LIMIT);

    const systemPrompt =
      "Kamu adalah asisten intake cerita pintar yang ramah, hangat, membimbing, ringkas, dan tidak robotik. " +
      "Tugasmu adalah menganalisis ide cerita pengguna, memberikan tanggapan singkat yang mendukung, meringkas arah cerita yang terdeteksi secara alami, dan mengajukan SATU pertanyaan follow-up yang berguna untuk menggali detail cerita lebih lanjut (misalnya tentang tokoh, konflik, rahasia, janji pembaca, target pembaca, genre, atau nada emosional). " +
      "Jangan membuat fakta cerita yang berlebihan di luar apa yang diceritakan pengguna. Jangan membocorkan plot masa depan. Jawab dalam bahasa Indonesia yang ramah bagi penulis pemula.";

    const promptMessages = [
      { role: "system" as const, content: systemPrompt },
      ...historyMessages.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      { role: "user" as const, content },
    ];

    const promptHash = await computePromptHashFromMessages(promptMessages);
    const idempotencyKey = `intake-assistant-${projectId}-${crypto.randomUUID()}`;

    attempt = await createGenerationAttempt(bindings, {
      projectId,
      userId: ownerId,
      generationType: GENERATION_TYPES.publish_copy,
      idempotencyKey,
      creditCost: 1,
      promptHash,
      correlationId,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      metadata: {
        actualGenerationType: "intake_assistant",
        billingAlias: "publish_copy",
        task: "10.31a",
      },
    });

    try {
      await debitCreditsForAttempt(bindings, {
        userId: ownerId,
        projectId,
        attemptId: attempt.id,
        amount: 1,
        reason: CREDIT_LEDGER_REASONS.generationDebit,
        generationType: GENERATION_TYPES.publish_copy,
        idempotencyKey,
        correlationId,
      });
      debited = true;
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
        generationType: GENERATION_TYPES.publish_copy,
        qualityMode: WRITER_QUALITY_MODES.hemat,
        promptHash,
        promptMessages,
      });
      agentContent = routerResult.text;

      const { data: dbAgentRow, error: agentError } = await admin
        .from("intake_messages")
        .insert({
          project_id: projectId,
          session_id: sessionRow.id,
          role: INTAKE_MESSAGE_ROLES.agent,
          content: agentContent,
          metadata: {
            source: "openrouter",
            attemptId: attempt.id,
            model: routerResult.model,
            provider: routerResult.provider,
          },
        })
        .select(MESSAGE_SELECT)
        .single();

      if (agentError || !dbAgentRow) {
        console.error("intake_messages insert agent failed");
        throw AppError.internal("Failed to save agent reply");
      }

      agentRow = dbAgentRow as IntakeMessageRow;

      await markGenerationAttemptSucceeded(bindings, {
        attemptId: attempt.id,
        userId: ownerId,
        projectId,
        provider: routerResult.provider,
        model: routerResult.model,
        inputTokens: routerResult.inputTokens,
        outputTokens: routerResult.outputTokens,
        outputEntityId: agentRow.id,
        outputEntityType: "intake_message",
        correlationId,
      });
    } catch (err) {
      if (debited) {
        try {
          await refundCreditsForAttempt(bindings, {
            userId: ownerId,
            projectId,
            attemptId: attempt.id,
            amount: 1,
            reason: CREDIT_LEDGER_REASONS.generationRefund,
            generationType: GENERATION_TYPES.publish_copy,
            idempotencyKey,
            correlationId,
          });
        } catch (refundErr) {
          console.error("credit refund failed:", refundErr);
        }
      }

      await markGenerationAttemptFailed(bindings, {
        attemptId: attempt.id,
        userId: ownerId,
        projectId,
        errorCode: err instanceof AppError ? err.code : "AI_FAILED",
        errorMessage: err instanceof Error ? err.message : "AI generation failed",
        correlationId,
      });
      throw err;
    }
  } else {
    agentContent = buildAgentStubReply(content);
    const { data: dbAgentRow, error: agentError } = await admin
      .from("intake_messages")
      .insert({
        project_id: projectId,
        session_id: sessionRow.id,
        role: INTAKE_MESSAGE_ROLES.agent,
        content: agentContent,
        metadata: { source: "deterministic_stub" },
      })
      .select(MESSAGE_SELECT)
      .single();

    if (agentError || !dbAgentRow) {
      console.error("intake_messages insert agent failed");
      throw AppError.internal("Failed to save agent reply");
    }
    agentRow = dbAgentRow as IntakeMessageRow;
  }

  await extractSignalsAndProgressInternal(
    bindings,
    projectId,
    sessionRow.id,
    userMsgRow.id,
  );

  const { data: updatedSession, error: sessionError } = await admin
    .from("intake_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionRow.id)
    .eq("project_id", projectId)
    .single();

  if (sessionError || !updatedSession) {
    console.error("intake_sessions reload failed");
    throw AppError.internal("Failed to reload intake session");
  }

  await setProjectWorkflowPhaseIfSafe(bindings, projectId, WORKFLOW_PHASES.intake);

  return {
    userMessage: mapIntakeMessageRow(userMsgRow),
    agentMessage: mapIntakeMessageRow(agentRow),
    session: mapIntakeSessionRow(updatedSession as IntakeSessionRow),
  };
}

export async function listDetectedSignalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  statusParam?: string,
): Promise<{ sessionId: string | null; signals: DetectedSignal[] }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const sessionRow = await fetchLatestSessionRow(bindings, projectId, true);

  if (!sessionRow) {
    return { sessionId: null, signals: [] };
  }

  const statusFilter = statusParam ? assertOptionalSignalStatus(statusParam) : undefined;
  const signals = await listSignalsForSession(
    bindings,
    projectId,
    sessionRow.id,
    statusFilter,
  );

  return { sessionId: sessionRow.id, signals };
}

function extractSignalsFromText(text: string): ExtractedSignalDraft[] {
  const lower = text.toLowerCase();
  const drafts: ExtractedSignalDraft[] = [];

  // Genre & Trope
  if (/istri|suami|mertua|rumah tangga|keluarga|nikah|selingkuh|menantu/.test(lower)) {
    drafts.push({
      type: "genre",
      label: "Drama Rumah Tangga",
      value: "drama rumah tangga",
      confidence: 0.9,
    });
  } else if (/akademi|sekolah|sihir|magis|fantasy|fantasi|kekuatan|murid|siswa/.test(lower)) {
    drafts.push({
      type: "genre",
      label: "Fantasy Academy",
      value: "fantasy academy",
      confidence: 0.9,
    });
  }

  // Protagonist
  if (/istri|menantu/.test(lower)) {
    drafts.push({
      type: "protagonist",
      label: "Protagonis: Istri",
      value: "istri yang diremehkan",
      confidence: 0.85,
    });
  } else if (/murid|siswa|anak sekolah|miskin/.test(lower)) {
    drafts.push({
      type: "protagonist",
      label: "Protagonis: Murid Miskin",
      value: "murid miskin dengan kekuatan tersembunyi",
      confidence: 0.85,
    });
  }

  // Core Conflict
  if (/remeh|hina|ejek|bully|rundung|tindas/.test(lower)) {
    drafts.push({
      type: "core_conflict",
      label: "Konflik: Perundungan",
      value: "diremehkan dan ditindas karena status",
      confidence: 0.8,
    });
  } else if (/selingkuh|khianat|madu|mertua/.test(lower)) {
    drafts.push({
      type: "core_conflict",
      label: "Konflik: Pengkhianatan Keluarga",
      value: "pengkhianatan oleh suami atau keluarga terdekat",
      confidence: 0.8,
    });
  }

  // Tone
  if (/balas dendam|bangkit|revenge|lawan|balas/.test(lower)) {
    drafts.push({
      type: "tone",
      label: "Nada: Kebangkitan & Pembalasan",
      value: "balas dendam emosional / kebangkitan",
      confidence: 0.85,
    });
  } else if (/sedih|tangis|luka|kecewa|sakit|menderita/.test(lower)) {
    drafts.push({
      type: "tone",
      label: "Nada: Melankolis Emosional",
      value: "sedih dan emosional mendalam",
      confidence: 0.8,
    });
  } else if (/sihir|ajaib|misteri/.test(lower)) {
    drafts.push({
      type: "tone",
      label: "Nada: Penuh Keajaiban",
      value: "penuh petualangan dan magis",
      confidence: 0.8,
    });
  }

  // Secret Candidate
  if (/rahasia|sembunyi|ternyata|tersembunyi|kekuatan/.test(lower)) {
    drafts.push({
      type: "secret_candidate",
      label: "Rahasia: Kekuatan Tersembunyi",
      value: "memiliki kekuatan tersembunyi atau identitas asli",
      confidence: 0.85,
    });
  } else if (/hamil|anak|kandung/.test(lower)) {
    drafts.push({
      type: "secret_candidate",
      label: "Rahasia: Kehamilan",
      value: "kehamilan yang dirahasiakan",
      confidence: 0.85,
    });
  }

  // Reader Promise
  if (/balas dendam|revenge|sukses|menang|tunjukkan|kaya/.test(lower)) {
    drafts.push({
      type: "reader_promise",
      label: "Janji: Kepuasan Revenge",
      value: "balas dendam elegan dan kebangkitan sukses",
      confidence: 0.8,
    });
  } else if (/sihir|tanding|kuat|hebat/.test(lower)) {
    drafts.push({
      type: "reader_promise",
      label: "Janji: Dominasi Sihir",
      value: "perjalanan naik tingkat dan pengakuan kekuatan",
      confidence: 0.8,
    });
  }

  // Target Reader / Format
  if (/kbm|hp|pembaca wanita|serial|online/.test(lower)) {
    drafts.push({
      type: "target_reader",
      label: "Format: KBM / HP",
      value: "hp_serial",
      confidence: 0.8,
    });
  }

  return drafts;
}

function computeProgressFromSignals(signals: Array<{ type: string; status?: string }>): number {
  const activeSignals = signals.filter(s => s.status !== "dismissed");
  const requiredTypes = ["genre", "protagonist", "core_conflict", "reader_promise", "target_reader", "secret_candidate", "tone"];
  let count = 0;
  for (const type of requiredTypes) {
    if (activeSignals.some(s => s.type === type)) {
      count++;
    }
  }
  return Math.round((count / requiredTypes.length) * 100);
}

async function upsertDetectedSignal(
  bindings: AppBindings,
  projectId: string,
  sessionId: string,
  draft: ExtractedSignalDraft,
  sourceMessageId: string | null,
  existing: DetectedSignalRow[],
): Promise<DetectedSignalRow> {
  const admin = createServiceRoleClient(bindings);
  const normalizedValue = draft.value.trim().toLowerCase();

  const match = existing.find(
    (row) => row.type === draft.type && row.value.trim().toLowerCase() === normalizedValue,
  );

  if (match) {
    const { data, error } = await admin
      .from("detected_signals")
      .update({
        label: draft.label,
        confidence: draft.confidence,
        source_message_id: sourceMessageId ?? match.source_message_id,
        metadata: { ...parseJsonObject(match.metadata), extractor: "deterministic_stub" },
      })
      .eq("id", match.id)
      .eq("project_id", projectId)
      .select(SIGNAL_SELECT)
      .single();

    if (error || !data) {
      console.error("detected_signals upsert update failed");
      throw AppError.internal("Failed to update detected signal");
    }
    return data as DetectedSignalRow;
  }

  const { data, error } = await admin
    .from("detected_signals")
    .insert({
      project_id: projectId,
      session_id: sessionId,
      type: draft.type,
      label: draft.label,
      value: draft.value,
      confidence: draft.confidence,
      status: DETECTED_SIGNAL_STATUSES.detected,
      source_message_id: sourceMessageId,
      metadata: { extractor: "deterministic_stub" },
    })
    .select(SIGNAL_SELECT)
    .single();

  if (error || !data) {
    console.error("detected_signals insert failed");
    throw AppError.internal("Failed to create detected signal");
  }

  return data as DetectedSignalRow;
}

async function extractSignalsAndProgressInternal(
  bindings: AppBindings,
  projectId: string,
  sessionId: string,
  latestUserMessageId: string | null = null,
): Promise<{ progressPercent: number; nextPhase: IntakePhase; signals: DetectedSignalRow[] }> {
  const admin = createServiceRoleClient(bindings);

  const { data: userMessages, error: messagesError } = await admin
    .from("intake_messages")
    .select(MESSAGE_SELECT)
    .eq("project_id", projectId)
    .eq("session_id", sessionId)
    .eq("role", INTAKE_MESSAGE_ROLES.user)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("intake_messages select for extract failed");
    throw AppError.internal("Failed to load messages for signal extraction");
  }

  const messages = (userMessages ?? []) as IntakeMessageRow[];
  const combinedText = messages.map((m) => m.content).join("\n");
  const drafts = extractSignalsFromText(combinedText);

  const { data: existingRows, error: existingError } = await admin
    .from("detected_signals")
    .select(SIGNAL_SELECT)
    .eq("project_id", projectId)
    .eq("session_id", sessionId);

  if (existingError) {
    console.error("detected_signals select existing failed");
    throw AppError.internal("Failed to load existing signals");
  }

  const existing = (existingRows ?? []) as DetectedSignalRow[];
  const sourceMessageId = latestUserMessageId || (messages.length > 0 ? messages[messages.length - 1].id : null);

  const upserted: DetectedSignalRow[] = [];
  for (const draft of drafts) {
    const row = await upsertDetectedSignal(
      bindings,
      projectId,
      sessionId,
      draft,
      sourceMessageId,
      [...existing, ...upserted],
    );
    upserted.push(row);
  }

  const allSignals = [...existing];
  for (const u of upserted) {
    const idx = allSignals.findIndex((s) => s.id === u.id);
    if (idx >= 0) {
      allSignals[idx] = u;
    } else {
      allSignals.push(u);
    }
  }

  const progressPercent = computeProgressFromSignals(allSignals);
  const nextPhase = progressPercent >= 80 ? INTAKE_PHASES.concept_generation : INTAKE_PHASES.signal_detection;

  await admin
    .from("intake_sessions")
    .update({
      progress_percent: progressPercent,
      phase: nextPhase,
    })
    .eq("id", sessionId)
    .eq("project_id", projectId);

  return { progressPercent, nextPhase, signals: allSignals };
}

export async function extractDetectedSignalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<{ sessionId: string; signals: DetectedSignal[] }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const sessionRow = await getOrCreateActiveSessionRow(bindings, projectId);
  await extractSignalsAndProgressInternal(bindings, projectId, sessionRow.id);
  const signals = await listSignalsForSession(bindings, projectId, sessionRow.id);
  return { sessionId: sessionRow.id, signals };
}

export async function updateDetectedSignalStatusForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  signalId: string,
  body: Record<string, unknown>,
): Promise<DetectedSignal> {
  assertNoForbiddenKeys(body);
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const status = assertOptionalSignalStatus(body.status);
  if (!status) {
    throw AppError.badRequest("status is required");
  }

  const admin = createServiceRoleClient(bindings);
  const { data: existing, error: existingError } = await admin
    .from("detected_signals")
    .select(SIGNAL_SELECT)
    .eq("id", signalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingError) {
    console.error("detected_signals select for patch failed");
    throw AppError.internal("Failed to load detected signal");
  }
  if (!existing) throw AppError.notFound("Detected signal not found");

  const { data, error } = await admin
    .from("detected_signals")
    .update({ status })
    .eq("id", signalId)
    .eq("project_id", projectId)
    .select(SIGNAL_SELECT)
    .single();

  if (error || !data) {
    console.error("detected_signals patch failed");
    throw AppError.internal("Failed to update detected signal");
  }

  return mapDetectedSignalRow(data as DetectedSignalRow);
}