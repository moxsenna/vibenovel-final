import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import type { PublishPackageRow, ChapterSummaryRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import type { PromptMessage } from "./ai-generation-types.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";

export const PUBLISH_COPY_AI_FIELDS = {
  teaser: "teaser",
  caption: "caption",
  readerQuestion: "readerQuestion",
  shortSynopsis: "shortSynopsis",
  nextChapterTeaser: "nextChapterTeaser",
} as const;

export type PublishCopyAiField =
  (typeof PUBLISH_COPY_AI_FIELDS)[keyof typeof PUBLISH_COPY_AI_FIELDS];

const FIELD_SET = new Set<string>(Object.values(PUBLISH_COPY_AI_FIELDS));

export const PUBLISH_COPY_FIELD_LIMITS: Record<PublishCopyAiField, number> = {
  teaser: 280,
  shortSynopsis: 700,
  caption: 1500,
  readerQuestion: 180,
  nextChapterTeaser: 240,
};

const SYSTEM_PROMPT =
  "You are a mobile serial fiction marketing copy editor for Indonesian HP/KBM readers. " +
  "Improve only the requested publish copy fields. " +
  "Do not invent plot facts, spoilers beyond approved summary scope, or marketing guarantees. " +
  "Avoid overclaim phrases (dijamin viral, pasti viral, dijamin unlock, pasti banyak pembaca, auto rame, jaminan penghasilan). " +
  "Respond with a single JSON object only — no markdown fences, no commentary.";

const SUMMARY_SELECT =
  "id, synopsis, mini_victory, emotional_outcome, ending_hook, chapter_number, title";

export interface PublishCopyPromptContext {
  chapterNumber: number;
  chapterTitle: string;
  displayTitle: string;
  genre: string | null;
  synopsis: string;
  miniVictory: string | null;
  emotionalOutcome: string | null;
  endingHook: string | null;
  currentFields: Partial<Record<PublishCopyAiField, string | null>>;
}

export interface PublishCopyAiPromptResult {
  promptMessages: PromptMessage[];
  promptHash: string;
}

export function parsePublishCopyFields(value: unknown): PublishCopyAiField[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw AppError.badRequest("fields is required and must be a non-empty array");
  }
  if (value.length > 5) {
    throw AppError.badRequest("fields must contain at most 5 items");
  }

  const seen = new Set<string>();
  const parsed: PublishCopyAiField[] = [];

  for (const item of value) {
    if (typeof item !== "string" || !FIELD_SET.has(item)) {
      throw AppError.badRequest(
        "fields may only include teaser, caption, readerQuestion, shortSynopsis, nextChapterTeaser",
      );
    }
    if (seen.has(item)) {
      throw AppError.badRequest("fields must not contain duplicates");
    }
    seen.add(item);
    parsed.push(item as PublishCopyAiField);
  }

  return parsed;
}

async function fetchSummarySafeRow(
  bindings: AppBindings,
  projectId: string,
  chapterSummaryId: string,
): Promise<ChapterSummaryRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("chapter_summaries")
    .select(SUMMARY_SELECT)
    .eq("project_id", projectId)
    .eq("id", chapterSummaryId)
    .maybeSingle();

  if (error) {
    console.error("chapter_summaries select for publish copy prompt failed");
    throw AppError.internal("Failed to load chapter summary");
  }
  if (!data) {
    throw AppError.notFound("Chapter summary not found");
  }
  return data as ChapterSummaryRow;
}

export function buildPublishCopyPromptContext(
  packageRow: PublishPackageRow,
  summaryRow: ChapterSummaryRow,
  requestedFields: PublishCopyAiField[],
): PublishCopyPromptContext {
  const currentFields: Partial<Record<PublishCopyAiField, string | null>> = {};
  for (const field of requestedFields) {
    switch (field) {
      case PUBLISH_COPY_AI_FIELDS.teaser:
        currentFields.teaser = packageRow.teaser;
        break;
      case PUBLISH_COPY_AI_FIELDS.caption:
        currentFields.caption = packageRow.caption;
        break;
      case PUBLISH_COPY_AI_FIELDS.readerQuestion:
        currentFields.readerQuestion = packageRow.reader_question;
        break;
      case PUBLISH_COPY_AI_FIELDS.shortSynopsis:
        currentFields.shortSynopsis = packageRow.short_synopsis;
        break;
      case PUBLISH_COPY_AI_FIELDS.nextChapterTeaser:
        currentFields.nextChapterTeaser = packageRow.next_chapter_teaser;
        break;
      default:
        break;
    }
  }

  return {
    chapterNumber: packageRow.chapter_number,
    chapterTitle: packageRow.chapter_title,
    displayTitle: packageRow.display_title,
    genre: packageRow.genre,
    synopsis: summaryRow.synopsis ?? "",
    miniVictory: summaryRow.mini_victory,
    emotionalOutcome: summaryRow.emotional_outcome,
    endingHook: summaryRow.ending_hook,
    currentFields,
  };
}

function buildUserPrompt(
  context: PublishCopyPromptContext,
  requestedFields: PublishCopyAiField[],
  instruction?: string,
): string {
  const sections: string[] = [
    `Chapter ${context.chapterNumber}: ${context.chapterTitle}`,
    `Display title: ${context.displayTitle}`,
  ];

  if (context.genre?.trim()) {
    sections.push(`Genre: ${context.genre.trim()}`);
  }
  if (context.synopsis.trim()) {
    sections.push(`Approved synopsis (safe): ${context.synopsis.trim()}`);
  }
  if (context.miniVictory?.trim()) {
    sections.push(`Mini victory: ${context.miniVictory.trim()}`);
  }
  if (context.emotionalOutcome?.trim()) {
    sections.push(`Emotional outcome: ${context.emotionalOutcome.trim()}`);
  }
  if (context.endingHook?.trim()) {
    sections.push(`Ending hook: ${context.endingHook.trim()}`);
  }

  sections.push(`Requested fields: ${requestedFields.join(", ")}`);

  for (const field of requestedFields) {
    const current = context.currentFields[field];
    sections.push(`Current ${field}: ${current?.trim() || "(empty)"}`);
  }

  const jsonShape: Record<string, string> = {};
  for (const field of requestedFields) {
    jsonShape[field] = `improved ${field} text`;
  }
  sections.push(`Return JSON only with exactly these keys: ${JSON.stringify(jsonShape)}`);

  if (instruction?.trim()) {
    sections.push(`Writer instruction: ${instruction.trim()}`);
  }

  return sections.join("\n");
}

export async function buildPublishCopyAiPrompt(
  bindings: AppBindings,
  projectId: string,
  packageRow: PublishPackageRow,
  requestedFields: PublishCopyAiField[],
  instruction?: string,
): Promise<PublishCopyAiPromptResult> {
  const summaryRow = await fetchSummarySafeRow(
    bindings,
    projectId,
    packageRow.chapter_summary_id,
  );
  const context = buildPublishCopyPromptContext(packageRow, summaryRow, requestedFields);
  const userPrompt = buildUserPrompt(context, requestedFields, instruction);

  const promptMessages: PromptMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const promptHash = await computePromptHashFromMessages(promptMessages);

  return {
    promptMessages,
    promptHash,
  };
}