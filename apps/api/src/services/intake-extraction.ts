import type { DetectedSignalType } from "@vibenovel/shared";

export const REQUIRED_SIGNAL_TYPES = [
  "genre",
  "protagonist",
  "core_conflict",
  "reader_promise",
  "target_reader",
  "secret_candidate",
  "tone",
] as const satisfies readonly DetectedSignalType[];

const REQUIRED_SIGNAL_TYPE_SET = new Set<string>(REQUIRED_SIGNAL_TYPES);

export interface ExtractedSignalDraft {
  type: DetectedSignalType;
  label: string;
  value: string;
  confidence: number;
}

export interface IntakeFilledSignalSummary {
  type: string;
  label: string;
  value: string;
}

export interface IntakeAiEnvelope {
  reply: string;
  signals: ExtractedSignalDraft[];
  readyForConcept: boolean;
}

export function normalizeExtractedSignalDraft(
  raw: ExtractedSignalDraft,
): ExtractedSignalDraft | null {
  if (!REQUIRED_SIGNAL_TYPE_SET.has(raw.type)) return null;
  const value = typeof raw.value === "string" ? raw.value.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!value || !label) return null;
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.75;
  return { type: raw.type, label, value, confidence };
}

export function parseIntakeAiEnvelope(text: string): IntakeAiEnvelope | null {
  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7);
  else if (cleanText.startsWith("```")) cleanText = cleanText.substring(3);
  if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3);
  cleanText = cleanText.trim();

  const tryParse = (json: string): IntakeAiEnvelope | null => {
    try {
      const parsed = JSON.parse(json) as Partial<IntakeAiEnvelope>;
      if (typeof parsed.reply !== "string") return null;
      if (!Array.isArray(parsed.signals)) return null;
      const signals = parsed.signals
        .map((item) => normalizeExtractedSignalDraft(item as ExtractedSignalDraft))
        .filter((item): item is ExtractedSignalDraft => item !== null);
      return {
        reply: parsed.reply.trim(),
        signals,
        readyForConcept: Boolean(parsed.readyForConcept),
      };
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleanText);
  if (direct) return direct;
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return tryParse(match[0]);
  return null;
}

export function buildIntakeExtractionInstructions(
  missingTypes: string[],
  filledSignals: IntakeFilledSignalSummary[] = [],
): string {
  const filledLine =
    filledSignals.length > 0
      ? `Sinyal terkumpul (jangan tanya ulang):\n${filledSignals.map((s) => `- ${s.type}: ${s.value}`).join("\n")}`
      : "Belum ada sinyal inti.";
  const missingLine =
    missingTypes.length > 0
      ? `Prioritaskan slot kosong: ${missingTypes.join(", ")}.`
      : "Slot inti lengkap; rangkum singkat dan tawarkan Lanjut ke Konsep.";

  return `\n\nBalasan WAJIB JSON:
{"reply":"maks ~4 kalimat, satu pertanyaan","signals":[{"type":"genre","label":"...","value":"...","confidence":0.9}],"readyForConcept":false}
Type valid: ${REQUIRED_SIGNAL_TYPES.join(", ")}.
${filledLine}
${missingLine}`;
}