import type { AppBindings } from "../env.js";
import {
  GENERATION_TYPES,
  type GenerationType,
  type JsonObject,
  type WriterQualityMode,
} from "@vibenovel/shared";
import { AppError } from "../errors.js";
import type { ModelRouterGenerateResult, PromptMessage } from "./ai-generation-types.js";
import {
  assertAiOutputUsable,
  persistValidationReportBestEffort,
  validateAiOutput,
  type OutputValidationReport,
} from "./output-validator.js";
import { generateWithModelRouter } from "./model-router.js";
import { buildProseRepairInstruction } from "./safe-repair.js";

/** Max extra provider calls after the initial generation (repair passes). */
export const PROSE_SAFE_REPAIR_MAX_RETRIES = 2;

/** Stop repair loop when cumulative provider tokens exceed this multiple of the first call. */
export const PROSE_SAFE_REPAIR_TOKEN_BUDGET_MULTIPLIER = 3;

export type AiOutputSafeRepairGenerationType =
  | typeof GENERATION_TYPES.prose_beat
  | typeof GENERATION_TYPES.prose_rewrite
  | typeof GENERATION_TYPES.publish_copy;

export interface ProseOutputValidationContext {
  forbiddenConcepts: string[];
  mustInclude: string[];
  povForbiddenFactTexts?: string[];
  retentionHookKeywords?: string[];
  styleToneHint?: string | null;
}

export interface ValidatedAiProviderOutput {
  text: string;
  providerResult: ModelRouterGenerateResult;
  validationReport: OutputValidationReport;
  repairAttempts: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export function isBlockedValidationReport(report: OutputValidationReport): boolean {
  return report.checks.some((check) => !check.passed && check.severity === "blocked");
}

export function estimateProviderTokenFootprint(result: ModelRouterGenerateResult): number {
  const input = result.inputTokens ?? 0;
  const output = result.outputTokens ?? 0;
  if (input + output > 0) return input + output;
  return Math.max(1, Math.ceil(result.text.length / 4));
}

function appendRepairUserMessage(
  baseMessages: PromptMessage[],
  repairInstruction: string,
  failedOutput: string,
): PromptMessage[] {
  const excerpt =
    failedOutput.length > 2_400 ? `${failedOutput.slice(0, 2_400)}…` : failedOutput;
  const repairUserContent =
    `${repairInstruction}\n\n` +
    "Perbaiki teks berikut tanpa menambah fakta besar baru:\n\n" +
    excerpt;
  return [...baseMessages, { role: "user", content: repairUserContent }];
}

export interface GenerateValidatedAiOutputWithSafeRepairInput {
  bindings: AppBindings;
  generationType: AiOutputSafeRepairGenerationType;
  qualityMode: WriterQualityMode;
  promptHash: string;
  promptMessages: PromptMessage[];
  validationContext: ProseOutputValidationContext;
  metadata?: JsonObject;
  temperature?: number;
  /** Text passed to `validateAiOutput` (e.g. parsed publish fields). Defaults to provider text. */
  validationTextFromProvider?: (providerText: string) => string;
  /** Excerpt shown to the model on repair retries. Defaults to provider text. */
  repairExcerptFromProvider?: (providerText: string) => string;
  persistContext?: {
    projectId: string;
    userId: string;
    generationAttemptId: string;
  };
}

function resolveValidationText(
  providerText: string,
  input: GenerateValidatedAiOutputWithSafeRepairInput,
): string {
  if (input.validationTextFromProvider) {
    return input.validationTextFromProvider(providerText);
  }
  return providerText;
}

function resolveRepairExcerpt(
  providerText: string,
  input: GenerateValidatedAiOutputWithSafeRepairInput,
): string {
  if (input.repairExcerptFromProvider) {
    return input.repairExcerptFromProvider(providerText);
  }
  return providerText;
}

/**
 * Generate AI output, validate, and on blocked failures run bounded safe-repair retries.
 * User credit is debited once by the caller; this accumulates provider token usage across retries.
 */
export async function generateValidatedAiOutputWithSafeRepair(
  input: GenerateValidatedAiOutputWithSafeRepairInput,
): Promise<ValidatedAiProviderOutput> {
  const { bindings, validationContext, persistContext, generationType } = input;
  const forbiddenConcepts = validationContext.forbiddenConcepts;
  const mustInclude = validationContext.mustInclude;
  const povForbiddenFactTexts = validationContext.povForbiddenFactTexts ?? [];
  const retentionHookKeywords = validationContext.retentionHookKeywords ?? [];
  const styleToneHint = validationContext.styleToneHint ?? null;

  let promptMessages = input.promptMessages;
  let promptHash = input.promptHash;
  let repairAttempts = 0;
  let lastReport: OutputValidationReport | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let tokenBudgetBaseline: number | null = null;
  let lastProviderText = "";

  for (let pass = 0; pass <= PROSE_SAFE_REPAIR_MAX_RETRIES; pass++) {
    const providerResult = await generateWithModelRouter(bindings, {
      generationType: generationType as GenerationType,
      qualityMode: input.qualityMode,
      promptHash,
      promptMessages,
      metadata: input.metadata,
      temperature: input.temperature,
    });

    lastProviderText = providerResult.text;

    if (tokenBudgetBaseline === null) {
      tokenBudgetBaseline = estimateProviderTokenFootprint(providerResult);
    }
    totalInputTokens += providerResult.inputTokens ?? 0;
    totalOutputTokens += providerResult.outputTokens ?? 0;

    const validationReport = validateAiOutput({
      outputText: resolveValidationText(providerResult.text, input),
      forbiddenConcepts,
      mustInclude,
      povForbiddenFactTexts,
      retentionHookKeywords,
      styleToneHint,
    });

    if (persistContext) {
      await persistValidationReportBestEffort(bindings, {
        projectId: persistContext.projectId,
        userId: persistContext.userId,
        generationAttemptId: persistContext.generationAttemptId,
        report: validationReport,
        repairStatus:
          pass === 0
            ? "not_requested"
            : validationReport.allowed
              ? "completed"
              : "requested",
      });
    }

    lastReport = validationReport;

    if (validationReport.allowed) {
      return {
        text: providerResult.text,
        providerResult: {
          ...providerResult,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
        validationReport,
        repairAttempts,
        totalInputTokens,
        totalOutputTokens,
      };
    }

    if (!isBlockedValidationReport(validationReport)) {
      assertAiOutputUsable(validationReport);
    }

    if (pass >= PROSE_SAFE_REPAIR_MAX_RETRIES) {
      break;
    }

    const footprint = totalInputTokens + totalOutputTokens;
    if (
      tokenBudgetBaseline > 0 &&
      footprint > tokenBudgetBaseline * PROSE_SAFE_REPAIR_TOKEN_BUDGET_MULTIPLIER
    ) {
      break;
    }

    const repairInstruction = buildProseRepairInstruction(forbiddenConcepts, mustInclude);
    promptMessages = appendRepairUserMessage(
      input.promptMessages,
      repairInstruction,
      resolveRepairExcerpt(providerResult.text, input),
    );
    promptHash = `${input.promptHash}:repair:${pass + 1}`;
    repairAttempts += 1;
  }

  if (persistContext && lastReport) {
    await persistValidationReportBestEffort(bindings, {
      projectId: persistContext.projectId,
      userId: persistContext.userId,
      generationAttemptId: persistContext.generationAttemptId,
      report: lastReport,
      repairStatus: "failed",
    });
  }

  if (lastReport) {
    assertAiOutputUsable(lastReport);
  }

  throw new AppError(
    "AI_OUTPUT_UNSAFE",
    "AI output failed safety validation after repair attempts",
    422,
    { lastProviderTextLength: lastProviderText.length },
  );
}