import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_TYPES,
  CHAPTER_SUMMARY_ITEM_SEVERITIES,
  CHAPTER_SUMMARY_ITEM_TYPES,
  CHAPTER_SUMMARY_STATUSES,
  FACT_IMPORTANCE,
  GENERATION_TYPES,
  WRITER_QUALITY_MODES,
  type AiProposalRiskLevel,
  type SummarySafetyFlags,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
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
  markGenerationAttemptFailed,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
} from "./generation-attempt.js";
import { generateWithModelRouter } from "./model-router.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";
import type { ProposalDraft } from "./chapter-delta-extractor.js";
import {
  parseAndValidateChapterSummaryAiOutput,
  type AiChapterSummaryOutput,
} from "./chapter-summary-schema.js";
import {
  SUMMARY_AI_GENERATOR_VERSION,
  type GeneratedChapterSummaryDraft,
  type GeneratedSummaryItemDraft,
} from "./chapter-summary-generator.js";
import { assertProseTextsSafeForSummary } from "./summary-safety.js";
import type { SummaryGenerationSnapshot } from "./summary-snapshot.js";

const PROSE_EXCERPT_MAX_CHARS = 12_000;
const NEW_FACT_PROPOSAL_CONFIDENCE_MIN = 0.7;
const MAX_INLINE_FACT_PROPOSALS = 8;

function truncateProse(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function buildSummarySystemPrompt(): string {
  return [
    "You are a continuity editor for Indonesian long fiction.",
    "Return ONLY valid JSON matching this schema (no markdown fences):",
    "{",
    '  "synopsis": string (max 800 chars),',
    '  "miniVictory": string|null,',
    '  "emotionalOutcome": string|null,',
    '  "endingHook": string|null,',
    '  "newFacts": [{ "content", "category", "importance": "minor"|"major"|"core", "confidence": 0-1 }],',
    '  "characterStateChanges": [{ "characterName", "change", "evidence" }],',
    '  "relationshipChanges": [{ "characterAName", "characterBName", "change" }],',
    '  "openLoopUpdates": [{ "question", "status": "opened"|"developed"|"payoff_candidate"|"closed", "note" }],',
    '  "revealProgress": [{ "title", "status": "hinted"|"armed"|"revealed"|"not_touched", "safeNote" }],',
    '  "continuityWarnings": [{ "severity": "info"|"warning"|"critical", "title", "body" }]',
    "}",
    "Base summary ONLY on the provided chapter prose and outline hints.",
    "Do NOT invent hidden planning data, future spoilers beyond the prose, or internal system markers.",
    "newFacts are proposals — not canon. Use safe reader-facing language in revealProgress.safeNote.",
  ].join("\n");
}

function buildSummaryUserPrompt(snapshot: SummaryGenerationSnapshot): string {
  const proseBlocks = snapshot.beatProse
    .map((bp) => {
      const prose = bp.currentProse?.prose_text?.trim() ?? "";
      if (!prose) return null;
      return `### Beat ${bp.beat.beatNumber}: ${bp.beat.title}\n${truncateProse(prose, 2500)}`;
    })
    .filter((b): b is string => Boolean(b));

  const ch = snapshot.chapterOutline;
  const outlineBits = [
    `Bab ${ch.chapterNumber}: ${ch.title}`,
    ch.summary ? `Ringkasan rencana: ${ch.summary}` : "",
    ch.purpose ? `Tujuan: ${ch.purpose}` : "",
    ch.hook ? `Hook: ${ch.hook}` : "",
    ch.endingHook ? `Ending hook rencana: ${ch.endingHook}` : "",
    ch.miniVictory ? `Mini victory rencana: ${ch.miniVictory}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let proseSection = proseBlocks.join("\n\n");
  if (proseSection.length > PROSE_EXCERPT_MAX_CHARS) {
    proseSection = truncateProse(proseSection, PROSE_EXCERPT_MAX_CHARS);
  }

  return [
    "Konteks bab aman untuk peringkasan:",
    outlineBits,
    "",
    "Naskah bab saat ini:",
    proseSection || "(tidak ada naskah)",
  ].join("\n");
}

function inferFactRisk(importance: string): AiProposalRiskLevel {
  if (importance === FACT_IMPORTANCE.core) return AI_PROPOSAL_RISK_LEVELS.high;
  if (importance === FACT_IMPORTANCE.major) return AI_PROPOSAL_RISK_LEVELS.medium;
  return AI_PROPOSAL_RISK_LEVELS.low;
}

function buildFactProposalDrafts(
  snapshot: SummaryGenerationSnapshot,
  facts: AiChapterSummaryOutput["newFacts"],
): ProposalDraft[] {
  const drafts: ProposalDraft[] = [];
  for (const fact of facts) {
    if (fact.confidence < NEW_FACT_PROPOSAL_CONFIDENCE_MIN) continue;
    if (drafts.length >= MAX_INLINE_FACT_PROPOSALS) break;
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: fact.content.slice(0, 120),
      riskLevel: inferFactRisk(fact.importance),
      payload: {
        chapterOutlineId: snapshot.chapterOutline.id,
        chapterNumber: snapshot.chapterOutline.chapterNumber,
        factText: fact.content,
        category: fact.category,
        importance: fact.importance,
        confidence: fact.confidence,
        generator: SUMMARY_AI_GENERATOR_VERSION,
      },
      sourceItemType: CHAPTER_SUMMARY_ITEM_TYPES.new_fact_candidate,
      sourceItemId: `ai-new-fact-${drafts.length}`,
    });
  }
  return drafts;
}

function mapAiOutputToItems(ai: AiChapterSummaryOutput): GeneratedSummaryItemDraft[] {
  const items: GeneratedSummaryItemDraft[] = [];
  let order = 0;

  items.push({
    itemType: CHAPTER_SUMMARY_ITEM_TYPES.synopsis,
    severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
    title: "Intisari Bab",
    body: ai.synopsis,
    sortOrder: order++,
  });

  if (ai.miniVictory) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.mini_victory,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: "Mini Victory",
      body: ai.miniVictory,
      sortOrder: order++,
    });
  }

  if (ai.emotionalOutcome) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.emotional_outcome,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: "Hasil Emosional",
      body: ai.emotionalOutcome,
      sortOrder: order++,
    });
  }

  if (ai.endingHook) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.ending_hook,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: "Hook Penutup",
      body: ai.endingHook,
      sortOrder: order++,
    });
  }

  for (const change of ai.characterStateChanges) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.character_change,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.warning,
      title: change.characterName,
      body: `${change.change}

Bukti: ${change.evidence}`,
      sortOrder: order++,
    });
  }

  for (const rel of ai.relationshipChanges) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.relationship_change,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: `${rel.characterAName} / ${rel.characterBName}`,
      body: rel.change,
      sortOrder: order++,
    });
  }

  for (const loop of ai.openLoopUpdates) {
    const loopType =
      loop.status === "closed"
        ? CHAPTER_SUMMARY_ITEM_TYPES.open_loop_paid_off
        : CHAPTER_SUMMARY_ITEM_TYPES.open_loop_opened;
    items.push({
      itemType: loopType,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: loop.question,
      body: `[${loop.status}] ${loop.note}`,
      sortOrder: order++,
    });
  }

  for (const rev of ai.revealProgress) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.reveal_candidate,
      severity: CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: rev.title,
      body: `[${rev.status}] ${rev.safeNote}`,
      sortOrder: order++,
    });
  }

  for (const fact of ai.newFacts) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.new_fact_candidate,
      severity:
        fact.confidence >= NEW_FACT_PROPOSAL_CONFIDENCE_MIN
          ? CHAPTER_SUMMARY_ITEM_SEVERITIES.warning
          : CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
      title: fact.content.slice(0, 120),
      body: fact.content,
      sortOrder: order++,
      metadata: {
        category: fact.category,
        importance: fact.importance,
        confidence: fact.confidence,
        proposalEligible: fact.confidence >= NEW_FACT_PROPOSAL_CONFIDENCE_MIN,
      },
    });
  }

  for (const warn of ai.continuityWarnings) {
    items.push({
      itemType: CHAPTER_SUMMARY_ITEM_TYPES.continuity_note,
      severity: warn.severity,
      title: warn.title,
      body: warn.body,
      sortOrder: order++,
    });
  }

  return items;
}

function buildDraftFromAi(
  snapshot: SummaryGenerationSnapshot,
  ai: AiChapterSummaryOutput,
): GeneratedChapterSummaryDraft {
  const proseTexts = snapshot.beatProse
    .map((bp) => bp.currentProse?.prose_text ?? "")
    .filter((t) => t.trim().length > 0);
  assertProseTextsSafeForSummary(proseTexts);

  const currentProseVersionIds = snapshot.beatProse
    .map((bp) => bp.currentProse?.id)
    .filter((id): id is string => Boolean(id));

  const wordCount = snapshot.beatProse.reduce(
    (sum, bp) => sum + (bp.currentProse?.word_count ?? 0),
    0,
  );

  const safetyFlags: SummarySafetyFlags = {
    stubGenerator: false,
    uncertainExtraction: ai.newFacts.some((f) => f.confidence < NEW_FACT_PROPOSAL_CONFIDENCE_MIN),
  };

  return {
    synopsis: ai.synopsis,
    miniVictory: ai.miniVictory,
    emotionalOutcome: ai.emotionalOutcome,
    endingHook: ai.endingHook,
    wordCount,
    currentProseVersionIds,
    safetyFlags,
    status: CHAPTER_SUMMARY_STATUSES.generated,
    items: mapAiOutputToItems(ai),
    metadata: {
      generatorVersion: SUMMARY_AI_GENERATOR_VERSION,
      beatCount: snapshot.beatProse.length,
      proseBeatCount: snapshot.beatProse.filter((bp) => bp.currentProse).length,
      newFactCount: ai.newFacts.length,
    },
  };
}

export interface GenerateChapterSummaryAiResult {
  draft: GeneratedChapterSummaryDraft;
  factProposalDrafts: ProposalDraft[];
  generationAttemptId: string;
}

export async function generateChapterSummaryWithAi(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  snapshot: SummaryGenerationSnapshot,
  writingSessionId: string,
): Promise<GenerateChapterSummaryAiResult> {
  const generationType = GENERATION_TYPES.chapter_summary_generation;
  const qualityMode = WRITER_QUALITY_MODES.hemat;
  const creditCost = getCreditCostForGeneration({ generationType, qualityMode });

  await assertAiGenerationAllowedForOwner(bindings, {
    userId: ownerId,
    projectId,
    generationType,
    requestedCreditCost: creditCost,
  });

  const promptMessages = [
    { role: "system" as const, content: buildSummarySystemPrompt() },
    { role: "user" as const, content: buildSummaryUserPrompt(snapshot) },
  ];

  const promptHash = await computePromptHashFromMessages(promptMessages);
  const idempotencyKey = `chapter-summary-generation-${projectId}-${crypto.randomUUID()}`;
  const correlationId = generateCorrelationId();

  let attempt = await createGenerationAttempt(bindings, {
    projectId,
    userId: ownerId,
    chapterOutlineId: snapshot.chapterOutline.id,
    writingSessionId,
    generationType,
    idempotencyKey,
    creditCost,
    promptHash,
    correlationId,
    qualityMode,
    metadata: { task: "12.3" },
  });

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
      generationType,
      qualityMode,
      promptHash,
      promptMessages,
      temperature: 0.35,
    });

    const ai = parseAndValidateChapterSummaryAiOutput(routerResult.text);
    const draft = buildDraftFromAi(snapshot, ai);
    const factProposalDrafts = buildFactProposalDrafts(snapshot, ai.newFacts);

    await markGenerationAttemptSucceeded(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      provider: routerResult.provider,
      model: routerResult.model,
      inputTokens: routerResult.inputTokens,
      outputTokens: routerResult.outputTokens,
      outputEntityId: snapshot.chapterOutline.id,
      outputEntityType: "chapter_summary",
      correlationId,
    });

    return {
      draft,
      factProposalDrafts,
      generationAttemptId: attempt.id,
    };
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
      errorMessage:
        err instanceof AppError
          ? err.message
          : "AI chapter summary generation failed",
      correlationId,
    });
    if (err instanceof AppError) throw err;
    throw AppError.serviceUnavailable("AI generation failed. Please try again.");
  }
}

export const SUMMARY_AI_PROPOSAL_SOURCE = AI_PROPOSAL_SOURCES.summary_stub;
