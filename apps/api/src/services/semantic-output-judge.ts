import type { WriterContextPacket } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  getAiTimeoutMs,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  isAiProviderMock,
} from "../env.js";
import { AppError } from "../errors.js";
import type { PromptMessage } from "./ai-generation-types.js";
import { getAiModelDeployment } from "./ai-model-registry.js";
import {
  callOpenAiCompatibleChat,
  type OpenAiCompatibleChatResult,
} from "./openai-compatible-client.js";
import type { OutputValidationReport } from "./output-validator.js";
import { parseJudgeResponse } from "./semantic-output-judge-schema.js";
import { serializeContext } from "./writer-context-serializer.js";

export interface SemanticOutputJudgeResult {
  instructionCompliance: { score: number; missingRequirements: string[] };
  sceneBoundary: { passed: boolean; jumpedAhead: boolean; reason: string };
  continuity: { passed: boolean; contradictions: string[] };
  knowledge: {
    passed: boolean;
    violations: Array<{ characterRef: string; factRef: string; reason: string }>;
  };
  style: { score: number; driftReasons: string[] };
}

export type SemanticJudgeMode = "off" | "shadow" | "enforce";

export interface SemanticJudgeExecution {
  mode: SemanticJudgeMode;
  called: boolean;
  result: SemanticOutputJudgeResult;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  warning: string | null;
}

export interface RunSemanticOutputJudgeInput {
  bindings: AppBindings;
  prose: string;
  writerPacket: WriterContextPacket;
  deterministicReport: OutputValidationReport;
}

export interface SemanticJudgeDependencies {
  call?: (messages: PromptMessage[]) => Promise<OpenAiCompatibleChatResult>;
}

const JUDGE_MODEL = "deepseek_flash" as const;
const JUDGE_PROVIDER = "openrouter" as const;

export function resolveSemanticJudgeMode(raw: string | undefined): SemanticJudgeMode {
  if (raw?.trim().toLowerCase() === "off") return "off";
  if (raw?.trim().toLowerCase() === "enforce") return "enforce";
  return "shadow";
}

export function createEmptyJudgeResult(): SemanticOutputJudgeResult {
  return {
    instructionCompliance: { score: 1, missingRequirements: [] },
    sceneBoundary: { passed: true, jumpedAhead: false, reason: "no judge call" },
    continuity: { passed: true, contradictions: [] },
    knowledge: { passed: true, violations: [] },
    style: { score: 1, driftReasons: [] },
  };
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

function buildJudgeMessages(input: RunSemanticOutputJudgeInput): PromptMessage[] {
  const deterministicFindings = input.deterministicReport.checks
    .filter((check) => !check.passed)
    .map((check) => ({
      key: check.key,
      severity: check.severity,
      message: check.message,
    }));
  const context = serializeContext(input.writerPacket, "conservative").text;
  return [
    {
      role: "system",
      content:
        "You are a fiction compliance judge. Return strict JSON only. " +
        "Evaluate instruction compliance, scene boundary, continuity, character knowledge, and style. " +
        "Do not invent hidden truth and do not request secret data.",
    },
    {
      role: "user",
      content: JSON.stringify({
        schema: {
          instructionCompliance: { score: "0..1", missingRequirements: ["string"] },
          sceneBoundary: { passed: true, jumpedAhead: false, reason: "string" },
          continuity: { passed: true, contradictions: ["string"] },
          knowledge: {
            passed: true,
            violations: [{ characterRef: "string", factRef: "string", reason: "string" }],
          },
          style: { score: "0..1", driftReasons: ["string"] },
        },
        writerContext: context,
        deterministicFindings,
        generatedProse: input.prose,
      }),
    },
  ];
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  const pricing = getAiModelDeployment(JUDGE_MODEL, JUDGE_PROVIDER).pricing;
  return (
    (inputTokens / 1_000_000) * pricing.inputUsdPer1M +
    (outputTokens / 1_000_000) * pricing.outputUsdPer1M
  );
}

function unavailable(
  mode: SemanticJudgeMode,
  message: string,
): SemanticJudgeExecution {
  if (mode === "enforce") {
    throw new AppError("SEMANTIC_JUDGE_UNAVAILABLE", message, 502);
  }
  return {
    mode,
    called: false,
    result: createEmptyJudgeResult(),
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    latencyMs: 0,
    warning: message,
  };
}

export async function runSemanticOutputJudge(
  input: RunSemanticOutputJudgeInput,
  dependencies: SemanticJudgeDependencies = {},
): Promise<SemanticJudgeExecution> {
  const mode = resolveSemanticJudgeMode(input.bindings.SEMANTIC_JUDGE_MODE);
  if (mode === "off") {
    return {
      mode,
      called: false,
      result: createEmptyJudgeResult(),
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: 0,
      warning: null,
    };
  }

  if (isAiProviderMock(input.bindings) && !dependencies.call) {
    return {
      mode,
      called: true,
      result: createEmptyJudgeResult(),
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: 0,
      warning: "semantic judge used deterministic mock result",
    };
  }

  const apiKey = getOpenRouterApiKey(input.bindings);
  if (!apiKey && !dependencies.call) {
    return unavailable(mode, "Semantic judge provider is not configured");
  }

  const messages = buildJudgeMessages(input);
  try {
    const deployment = getAiModelDeployment(JUDGE_MODEL, JUDGE_PROVIDER);
    const response = dependencies.call
      ? await dependencies.call(messages)
      : await callOpenAiCompatibleChat({
          provider: JUDGE_PROVIDER,
          baseUrl: getOpenRouterBaseUrl(input.bindings),
          apiKey: apiKey!,
          modelId: deployment.modelId,
          messages,
          maxOutputTokens: 1_500,
          temperature: 0,
          timeoutMs: Math.min(getAiTimeoutMs(input.bindings), 30_000),
        });
    const result = parseJudgeResponse(extractJson(response.text));
    const inputTokens = response.inputTokens ?? 0;
    const outputTokens = response.outputTokens ?? 0;
    return {
      mode,
      called: true,
      result,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(inputTokens, outputTokens),
      latencyMs: response.latencyMs,
      warning: null,
    };
  } catch (error) {
    return unavailable(
      mode,
      error instanceof Error ? `Semantic judge failed: ${error.message}` : "Semantic judge failed",
    );
  }
}

export function mergeSemanticJudgeIntoValidationReport(
  report: OutputValidationReport,
  execution: SemanticJudgeExecution,
): OutputValidationReport {
  if (!execution.called || execution.mode !== "enforce") return report;
  const checks = [...report.checks];
  const result = execution.result;
  checks.push({
    key: "semantic_instruction_compliance",
    passed: result.instructionCompliance.score >= 0.8,
    severity: "blocked",
    message:
      result.instructionCompliance.missingRequirements.join("; ") ||
      "Semantic instruction compliance passed.",
  });
  checks.push({
    key: "semantic_scene_boundary",
    passed: result.sceneBoundary.passed && !result.sceneBoundary.jumpedAhead,
    severity: "blocked",
    message: result.sceneBoundary.reason || "Semantic scene boundary passed.",
  });
  checks.push({
    key: "semantic_continuity",
    passed: result.continuity.passed,
    severity: "blocked",
    message:
      result.continuity.contradictions.join("; ") || "Semantic continuity passed.",
  });
  checks.push({
    key: "semantic_knowledge",
    passed: result.knowledge.passed,
    severity: "blocked",
    message:
      result.knowledge.violations.map((violation) => violation.reason).join("; ") ||
      "Semantic knowledge check passed.",
  });
  checks.push({
    key: "semantic_style",
    passed: result.style.score >= 0.75,
    severity: "warning",
    message: result.style.driftReasons.join("; ") || "Semantic style check passed.",
  });

  const blocked = checks.some((check) => !check.passed && check.severity === "blocked");
  const warned = checks.some((check) => !check.passed && check.severity === "warning");
  return {
    ...report,
    checks,
    allowed: !blocked,
    severity: blocked ? "blocked" : warned ? "warning" : "info",
  };
}
