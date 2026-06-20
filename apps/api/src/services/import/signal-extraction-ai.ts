import { GENERATION_TYPES, WRITER_QUALITY_MODES } from "@vibenovel/shared";
import type { AppBindings } from "../../env.js";
import { AppError } from "../../errors.js";
import type {
  AiProviderId,
  ModelRouterGenerateInput,
  ModelRouterGenerateResult,
  PromptMessage,
} from "../ai-generation-types.js";
import { generateWithModelRouter } from "../model-router.js";
import type { ProviderEventSequence } from "../generation-provider-event.js";
import { computePromptHashFromMessages } from "../prose-generation-prompt.js";
import type { DraftImportSignalDraft } from "../draft-import.js";

/** Router input minus the attempt-owned fields supplied by the parent. */
export type DraftImportSignalRouterInputBase = Omit<
  ModelRouterGenerateInput<DraftImportSignalDraft[]>,
  "generationAttemptId" | "providerEventSequence" | "validateOutput"
>;

const AI_SIGNAL_SCHEMA_VERSION = "draft_import_signal_ai_v1";
const PROMPT_DRAFT_MAX_CHARS = 90_000;
const FIELD_MAX_CHARS = 700;
const EVIDENCE_MAX_CHARS = 320;

const ALLOWED_SIGNAL_TYPES = new Set([
  "genre",
  "tone",
  "pov",
  "protagonist",
  "supporting_character",
  "setting",
  "core_conflict",
  "reader_promise",
  "target_reader",
  "relationship_dynamic",
  "secret_candidate",
  "continuity_warning",
  "theme",
  "style_preference",
]);

const SIGNAL_TYPE_ALIASES = new Map<string, string>([
  ["main_character", "protagonist"],
  ["main character", "protagonist"],
  ["tokoh_utama", "protagonist"],
  ["tokoh utama", "protagonist"],
  ["conflict", "core_conflict"],
  ["konflik", "core_conflict"],
  ["promise", "reader_promise"],
  ["janji_pembaca", "reader_promise"],
  ["reader promise", "reader_promise"],
  ["secret", "secret_candidate"],
  ["continuity", "continuity_warning"],
  ["continuity_note", "continuity_warning"],
  ["warning", "continuity_warning"],
]);

export type DraftImportSignalExtractionMode = "ai" | "deterministic_fallback";

export interface DraftImportAiProviderMetadata {
  provider: AiProviderId;
  model: string;
  promptHash: string;
}

export interface DraftImportSignalAiFirstInput {
  bindings: AppBindings;
  fallbackSignals: DraftImportSignalDraft[];
  generationAttemptId: string;
  providerEventSequence: ProviderEventSequence;
  routerInput: DraftImportSignalRouterInputBase;
  generate?: (
    input: ModelRouterGenerateInput<DraftImportSignalDraft[]>,
  ) => Promise<ModelRouterGenerateResult<DraftImportSignalDraft[]>>;
}

export interface DraftImportSignalAiFirstResult {
  signals: DraftImportSignalDraft[];
  extractionMode: DraftImportSignalExtractionMode;
  providerResult?: ModelRouterGenerateResult<DraftImportSignalDraft[]>;
}

interface ParsedAiSignal {
  type?: unknown;
  label?: unknown;
  value?: unknown;
  confidence?: unknown;
  evidence?: unknown;
}

function truncateField(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
}

function normalizeSignalType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliased = SIGNAL_TYPE_ALIASES.get(normalized) ?? SIGNAL_TYPE_ALIASES.get(value.trim().toLowerCase());
  const type = aliased ?? normalized;
  return ALLOWED_SIGNAL_TYPES.has(type) ? type : null;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.72;
  }
  if (value > 1) {
    return Math.max(0.05, Math.min(0.99, value / 100));
  }
  return Math.max(0.05, Math.min(0.99, value));
}

function stripJsonFences(text: string): string {
  let clean = text.trim();
  if (clean.startsWith("```json")) {
    clean = clean.slice(7);
  } else if (clean.startsWith("```")) {
    clean = clean.slice(3);
  }
  if (clean.endsWith("```")) {
    clean = clean.slice(0, -3);
  }
  return clean.trim();
}

function parseAiSignalList(raw: unknown): ParsedAiSignal[] {
  if (Array.isArray(raw)) {
    return raw as ParsedAiSignal[];
  }
  if (raw && typeof raw === "object") {
    const signals = (raw as { signals?: unknown }).signals;
    if (Array.isArray(signals)) {
      return signals as ParsedAiSignal[];
    }
  }
  return [];
}

export function parseDraftImportSignalExtractionOutput(
  rawText: string,
  metadata: DraftImportAiProviderMetadata,
): DraftImportSignalDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch {
    return [];
  }

  const drafts: DraftImportSignalDraft[] = [];
  const seen = new Set<string>();

  for (const item of parseAiSignalList(parsed)) {
    const type = normalizeSignalType(item.type);
    const label = typeof item.label === "string" ? truncateField(item.label, FIELD_MAX_CHARS) : "";
    const value = typeof item.value === "string" ? truncateField(item.value, FIELD_MAX_CHARS) : "";
    if (!type || !label || !value) {
      continue;
    }

    const key = `${type}:${value.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const evidence =
      typeof item.evidence === "string"
        ? truncateField(item.evidence, EVIDENCE_MAX_CHARS)
        : undefined;

    drafts.push({
      type,
      label,
      value,
      confidence: normalizeConfidence(item.confidence),
      metadata: {
        source: "imported_draft",
        extractor: "ai_draft_import",
        extractionMode: "ai",
        schemaVersion: AI_SIGNAL_SCHEMA_VERSION,
        provider: metadata.provider,
        model: metadata.model,
        promptHash: metadata.promptHash,
        ...(evidence ? { evidence } : {}),
      },
    });
  }

  return drafts;
}

function contentForPrompt(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= PROMPT_DRAFT_MAX_CHARS) {
    return trimmed;
  }

  const head = trimmed.slice(0, 70_000).trimEnd();
  const tail = trimmed.slice(-20_000).trimStart();
  return `${head}\n\n[...draft dipotong untuk batas token...]\n\n${tail}`;
}

function buildSignalExtractionPrompt(content: string): PromptMessage[] {
  const systemPrompt =
    "Kamu adalah analis continuity dan market signal untuk naskah serial Indonesia. " +
    "Tugasmu membaca draft import dan mengeluarkan sinyal cerita yang akurat, bukan menebak dari template. " +
    "Jika draft hanya berisi isi bab tanpa metadata judul/genre/premis, infer dari bukti adegan. " +
    "Jangan membawa nama, genre, konflik, atau relasi dari cerita lain. " +
    "Output wajib valid JSON saja dengan object berisi key signals. " +
    "Setiap signal: type, label, value, confidence, evidence. " +
    "type hanya boleh salah satu dari: genre, tone, pov, protagonist, supporting_character, setting, core_conflict, reader_promise, target_reader, relationship_dynamic, secret_candidate, continuity_warning, theme, style_preference. " +
    "confidence angka 0 sampai 1. evidence berupa kutipan/parafrase pendek dari draft. " +
    "Kembalikan 5 sampai 10 signal paling penting.";

  const userPrompt =
    "Analisis draft import berikut. Fokus pada genre aktual, tokoh utama, konflik pusat, janji pembaca, rahasia/continuity, dan setting. " +
    "Jika ada bab pembuka, tokoh yang menjadi lensa awal biasanya kandidat protagonis, kecuali bukti lain lebih kuat.\n\n" +
    "DRAFT:\n" +
    contentForPrompt(content);

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

export async function buildDraftImportSignalExtractionRouterInput(
  content: string,
): Promise<DraftImportSignalRouterInputBase> {
  const promptMessages = buildSignalExtractionPrompt(content);
  const promptHash = await computePromptHashFromMessages(promptMessages);
  return {
    generationType: GENERATION_TYPES.draft_import_signal_extraction,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    promptHash,
    promptMessages,
    maxOutputTokensOverride: 1800,
    temperature: 0.1,
    metadata: {
      task: "draft_import_signal_extraction",
      schemaVersion: AI_SIGNAL_SCHEMA_VERSION,
    },
  };
}

export async function extractDraftImportSignalsAiFirst(
  input: DraftImportSignalAiFirstInput,
): Promise<DraftImportSignalAiFirstResult> {
  try {
    const fullInput: ModelRouterGenerateInput<DraftImportSignalDraft[]> = {
      ...input.routerInput,
      generationAttemptId: input.generationAttemptId,
      providerEventSequence: input.providerEventSequence,
      validateOutput: (text) => {
        const signals = parseDraftImportSignalExtractionOutput(text, {
          provider: "openrouter",
          model: "pending",
          promptHash: input.routerInput.promptHash,
        });
        if (signals.length === 0) {
          throw new AppError(
            "GENERATION_FAILED",
            "Draft import signal extraction returned no valid signals",
            502,
          );
        }
        return signals;
      },
    };
    const providerResult = input.generate
      ? await input.generate(fullInput)
      : await generateWithModelRouter(input.bindings, fullInput);

    // Rebuild signal metadata from the final provider/model, never "pending".
    const aiSignals = parseDraftImportSignalExtractionOutput(providerResult.text, {
      provider: providerResult.provider,
      model: providerResult.model,
      promptHash: providerResult.promptHash,
    });

    if (aiSignals.length > 0) {
      return {
        signals: aiSignals,
        extractionMode: "ai",
        providerResult,
      };
    }
  } catch (err) {
    console.warn(
      "draft import AI signal extraction fell back",
      err instanceof Error ? err.message : "unknown error",
    );
  }

  return {
    signals: input.fallbackSignals,
    extractionMode: "deterministic_fallback",
  };
}
