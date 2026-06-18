import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type AiProposalRiskLevel,
  type AiProposalType,
  type JsonObject,
} from "@vibenovel/shared";
import { isAiGenerationEnabled, isAiProviderMock, type AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import {
  mapAiProposalResponse,
  type AiProposalResponse,
  type AiProposalRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { generateCorrelationId } from "./audit-snapshot.js";
import { getCreditCostForGeneration } from "./ai-credit-policy.js";
import {
  CREDIT_LEDGER_REASONS,
  debitCreditsForAttempt,
  refundCreditsForAttempt,
} from "./credit-ledger.js";
import { getFoundationReadinessForOwner } from "./foundation-readiness.js";
import {
  createGenerationAttempt,
  markGenerationAttemptFailed,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
} from "./generation-attempt.js";
import { listIntakeMessagesForOwner } from "./intake.js";
import { generateWithModelRouter } from "./model-router.js";
import { assertPlanningOutputSpecificToProject } from "./planning-output-specificity.js";
import { getOwnedProjectRow } from "./project.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";

const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";

export const ASISTEN_NARRA_FOUNDATION_PATCH_GENERATOR =
  "asisten_narra_foundation_patch";

interface ProposalDraft {
  proposalType: AiProposalType;
  title: string;
  riskLevel: AiProposalRiskLevel;
  payload: JsonObject;
}

function stripJsonFences(text: string): string {
  let value = text.trim();
  if (value.startsWith("```json")) value = value.slice(7);
  else if (value.startsWith("```")) value = value.slice(3);
  if (value.endsWith("```")) value = value.slice(0, -3);
  return value.trim();
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function basePayload(input: {
  sessionId: string | null;
  readinessBefore: number;
}): JsonObject {
  return {
    generator: ASISTEN_NARRA_FOUNDATION_PATCH_GENERATOR,
    sessionId: input.sessionId,
    phase: "foundation_refinement",
    readinessBefore: input.readinessBefore,
    targetReadiness: 85,
  };
}

function buildDeterministicPatchDrafts(input: {
  sessionId: string | null;
  readinessBefore: number;
  missing: string[];
}): ProposalDraft[] {
  const base = basePayload(input);
  const missingText = input.missing.join(", ") || "motivasi, stakes, dan janji serial";

  return [
    {
      proposalType: AI_PROPOSAL_TYPES.foundation,
      title: "Usulan Narra: pertegas konflik dan janji pembaca",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...base,
        premise:
          "Tokoh utama dipaksa menghadapi kebohongan yang selama ini menjaga hidup tampak utuh, lalu memilih kebenaran yang menyakitkan agar tidak terus dikendalikan orang lain.",
        mainConflict:
          "Konflik utama bertumpu pada pilihan antara menjaga citra yang rapi atau membongkar kebohongan yang merusak kepercayaan.",
        readerPromise:
          "Pembaca mendapat drama emosional yang pelan, dekat, dan memuaskan saat satu demi satu kebohongan terungkap.",
        reason: `Narra mematangkan bagian: ${missingText}.`,
      },
    },
    {
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: "Usulan Narra: konsekuensi emosional tokoh utama",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
      payload: {
        ...base,
        content:
          "Tokoh utama paling takut orang terdekatnya ikut menanggung akibat dari kebohongan yang ia biarkan terlalu lama.",
        category: "motive",
        importance: "major",
        reason: "Menambah stakes emosional tanpa menulis rahasia high-risk.",
      },
    },
    {
      proposalType: AI_PROPOSAL_TYPES.style,
      title: "Usulan Narra: gaya serial HP",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...base,
        tone: "Emosional, realistis, tegang pelan",
        styleTags: ["Drama karakter", "Bab pendek", "Tegangan pelan", "Dialog natural"],
        outputStyle: "warm_emotional",
        reason: "Membuat arah generasi lebih spesifik untuk pembaca serial mobile.",
      },
    },
  ];
}

function buildDraftsFromAiJson(input: {
  parsed: Record<string, unknown>;
  sessionId: string | null;
  readinessBefore: number;
}): ProposalDraft[] {
  const parsed = input.parsed;
  const base = basePayload(input);
  const foundation =
    parsed.foundation && typeof parsed.foundation === "object" && !Array.isArray(parsed.foundation)
      ? (parsed.foundation as Record<string, unknown>)
      : parsed;
  const character =
    parsed.character && typeof parsed.character === "object" && !Array.isArray(parsed.character)
      ? (parsed.character as Record<string, unknown>)
      : {};
  const safeFacts = Array.isArray(parsed.facts) ? parsed.facts.slice(0, 4) : [];
  const drafts: ProposalDraft[] = [];

  const foundationPayload: JsonObject = {
    ...base,
    premise: stringValue(foundation.premise),
    mainConflict: stringValue(foundation.mainConflict),
    readerPromise: stringValue(foundation.readerPromise),
    genre: stringValue(foundation.genre),
    tone: stringValue(foundation.tone),
    targetReader: stringValue(foundation.targetReader, "hp_serial"),
    styleTags: stringArray(foundation.styleTags).slice(0, 6),
    reason: stringValue(parsed.reason, "Diturunkan dari obrolan Asisten Narra."),
  };

  if (
    foundationPayload.premise ||
    foundationPayload.mainConflict ||
    foundationPayload.readerPromise ||
    foundationPayload.genre ||
    foundationPayload.tone
  ) {
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.foundation,
      title: stringValue(parsed.title, "Usulan Narra: matangkan fondasi"),
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: foundationPayload,
    });
  }

  const characterName = stringValue(character.name);
  if (characterName) {
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.character,
      title: `Usulan Narra: ${characterName}`,
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...base,
        name: characterName,
        role: stringValue(character.role, "protagonist"),
        description: stringValue(character.description),
        motivation: stringValue(character.motivation),
      },
    });
  }

  for (const raw of safeFacts) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const fact = raw as Record<string, unknown>;
    const content = stringValue(fact.content);
    if (!content) continue;
    const category = stringValue(fact.category, "motive");
    if (category === "secret") continue;
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: `Usulan Narra: ${content.slice(0, 60)}`,
      riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
      payload: {
        ...base,
        content: content.slice(0, 300),
        category,
        importance: stringValue(fact.importance, "major"),
        reason: stringValue(fact.reason, "Mematangkan fondasi dari jawaban penulis."),
      },
    });
  }

  const styleTags = stringArray(foundation.styleTags);
  if (styleTags.length > 0 || stringValue(foundation.tone)) {
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.style,
      title: "Usulan Narra: gaya cerita",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...base,
        tone: stringValue(foundation.tone),
        styleTags: styleTags.slice(0, 6),
        outputStyle: "warm_emotional",
        reason: "Memperjelas gaya dan format serial.",
      },
    });
  }

  return drafts;
}

async function generateAiPatchDrafts(input: {
  bindings: AppBindings;
  ownerId: string;
  projectId: string;
  sessionId: string | null;
  readinessBefore: number;
  missing: string[];
  chatText: string;
}): Promise<ProposalDraft[]> {
  const promptMessages = [
    {
      role: "system" as const,
      content:
        "Kamu adalah Asisten Narra. Buat JSON valid untuk mematangkan fondasi cerita. " +
        "Jangan menulis canon langsung. Output harus object dengan keys: foundation, character, facts, reason. " +
        "foundation berisi premise, mainConflict, readerPromise, genre, tone, targetReader, styleTags. " +
        "facts hanya fakta aman, bukan rahasia high-risk. Jangan kembalikan teks selain JSON.",
    },
    {
      role: "user" as const,
      content:
        `Kesiapan: ${input.readinessBefore}. Missing: ${input.missing.join(", ") || "tidak ada"}.\n` +
        `Riwayat chat Asisten Narra:\n${input.chatText || "(belum ada jawaban)"}`,
    },
  ];

  const generationType = GENERATION_TYPES.foundation_proposal;
  const qualityMode = WRITER_QUALITY_MODES.hemat;
  const creditCost = getCreditCostForGeneration({ generationType, qualityMode });
  const promptHash = await computePromptHashFromMessages(promptMessages);
  const idempotencyKey = `asisten-narra-foundation-${input.projectId}-${crypto.randomUUID()}`;
  const correlationId = generateCorrelationId();

  let attempt = await createGenerationAttempt(input.bindings, {
    projectId: input.projectId,
    userId: input.ownerId,
    generationType,
    idempotencyKey,
    creditCost,
    promptHash,
    correlationId,
    qualityMode,
    metadata: {
      task: "sprint19_asisten_narra_foundation_patch",
      generator: ASISTEN_NARRA_FOUNDATION_PATCH_GENERATOR,
    },
  });

  try {
    await debitCreditsForAttempt(input.bindings, {
      userId: input.ownerId,
      projectId: input.projectId,
      attemptId: attempt.id,
      amount: creditCost,
      reason: CREDIT_LEDGER_REASONS.generationDebit,
      generationType,
      qualityMode,
      idempotencyKey,
      correlationId,
    });
  } catch (err) {
    await markGenerationAttemptFailed(input.bindings, {
      attemptId: attempt.id,
      userId: input.ownerId,
      projectId: input.projectId,
      errorCode: err instanceof AppError ? err.code : "DEBIT_FAILED",
      errorMessage: err instanceof Error ? err.message : "Credit debit failed",
      correlationId,
    });
    throw err;
  }

  attempt = await markGenerationAttemptRunning(input.bindings, attempt.id);

  try {
    const routerResult = await generateWithModelRouter(input.bindings, {
      generationType,
      qualityMode,
      promptHash,
      promptMessages,
      temperature: 0.4,
    });

    const parsed = JSON.parse(stripJsonFences(routerResult.text));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("GENERATION_FAILED", "Narra returned invalid foundation patch JSON", 502);
    }
    assertPlanningOutputSpecificToProject(parsed, "Usulan Narra");

    const drafts = buildDraftsFromAiJson({
      parsed: parsed as Record<string, unknown>,
      sessionId: input.sessionId,
      readinessBefore: input.readinessBefore,
    });

    await markGenerationAttemptSucceeded(input.bindings, {
      attemptId: attempt.id,
      userId: input.ownerId,
      projectId: input.projectId,
      provider: routerResult.provider,
      model: routerResult.model,
      inputTokens: routerResult.inputTokens,
      outputTokens: routerResult.outputTokens,
      outputEntityId: "00000000-0000-0000-0000-000000000000",
      outputEntityType: "ai_proposal",
      correlationId,
    });

    return drafts.length > 0
      ? drafts
      : buildDeterministicPatchDrafts({
          sessionId: input.sessionId,
          readinessBefore: input.readinessBefore,
          missing: input.missing,
        });
  } catch (err) {
    try {
      await refundCreditsForAttempt(input.bindings, {
        userId: input.ownerId,
        projectId: input.projectId,
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

    await markGenerationAttemptFailed(input.bindings, {
      attemptId: attempt.id,
      userId: input.ownerId,
      projectId: input.projectId,
      errorCode: err instanceof AppError ? err.code : "AI_FAILED",
      errorMessage: err instanceof Error ? err.message : "AI Narra patch failed",
      correlationId,
    });
    throw err;
  }
}

async function insertDrafts(
  bindings: AppBindings,
  projectId: string,
  drafts: ProposalDraft[],
): Promise<AiProposalResponse[]> {
  const admin = createServiceRoleClient(bindings);
  const rows = drafts.map((draft) => ({
    project_id: projectId,
    proposal_type: draft.proposalType,
    status: AI_PROPOSAL_STATUSES.proposed,
    risk_level: draft.riskLevel,
    source: AI_PROPOSAL_SOURCES.ai_foundation,
    title: draft.title,
    payload: draft.payload,
  }));

  const { data, error } = await admin.from("ai_proposals").insert(rows).select(PROPOSAL_SELECT);
  if (error || !data) {
    console.error("ai_proposals insert Narra patch failed");
    throw AppError.internal("Failed to create Narra proposals");
  }
  return (data as AiProposalRow[]).map(mapAiProposalResponse);
}

export async function generateFoundationProposalsFromNarraForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<{ proposals: AiProposalResponse[]; created: true; generator: string }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const readiness = await getFoundationReadinessForOwner(bindings, ownerId, projectId);
  const intake = await listIntakeMessagesForOwner(bindings, ownerId, projectId);
  const chatText = intake.messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const drafts =
    isAiGenerationEnabled(bindings) && !isAiProviderMock(bindings)
      ? await generateAiPatchDrafts({
          bindings,
          ownerId,
          projectId,
          sessionId: intake.sessionId,
          readinessBefore: readiness.readinessScore,
          missing: readiness.missing,
          chatText,
        })
      : buildDeterministicPatchDrafts({
          sessionId: intake.sessionId,
          readinessBefore: readiness.readinessScore,
          missing: readiness.missing,
        });

  const proposals = await insertDrafts(bindings, projectId, drafts);
  return { proposals, created: true, generator: ASISTEN_NARRA_FOUNDATION_PATCH_GENERATOR };
}
