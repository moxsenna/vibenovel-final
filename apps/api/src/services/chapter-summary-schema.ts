import {
  CHAPTER_SUMMARY_ITEM_SEVERITIES,
  FACT_IMPORTANCE,
  type ChapterSummaryItemSeverity,
  type FactImportance,
} from "@vibenovel/shared";
import { AppError } from "../errors.js";
import { assertSummaryTextSafe } from "./summary-safety.js";

const SYNOPSIS_MAX = 800;
const MINI_VICTORY_MAX = 300;
const EMOTIONAL_OUTCOME_MAX = 300;
const ENDING_HOOK_MAX = 300;
const SHORT_TEXT_MAX = 500;
const BODY_MAX = 2000;
const MAX_NEW_FACTS = 12;
const MAX_CHARACTER_STATE_CHANGES = 20;
const MAX_RELATIONSHIP_CHANGES = 12;
const MAX_OPEN_LOOP_UPDATES = 12;
const MAX_REVEAL_PROGRESS = 12;
const MAX_CONTINUITY_WARNINGS = 10;

const FACT_IMPORTANCE_SET = new Set<string>(Object.values(FACT_IMPORTANCE));
const OPEN_LOOP_STATUS_SET = new Set([
  "opened",
  "developed",
  "payoff_candidate",
  "closed",
]);
const REVEAL_PROGRESS_STATUS_SET = new Set([
  "hinted",
  "armed",
  "revealed",
  "not_touched",
]);
const WARNING_SEVERITY_SET = new Set([
  CHAPTER_SUMMARY_ITEM_SEVERITIES.info,
  CHAPTER_SUMMARY_ITEM_SEVERITIES.warning,
  CHAPTER_SUMMARY_ITEM_SEVERITIES.high_risk,
]);

const FORBIDDEN_OUTPUT_SUBSTRINGS = [
  "planning_truth",
  "planningtruth",
  "context_packet",
  "packet_json",
  "full_prompt",
  "openrouter",
] as const;

export interface AiChapterSummaryNewFact {
  content: string;
  category: string;
  importance: FactImportance;
  confidence: number;
}

export interface AiChapterSummaryCharacterStateChange {
  characterName: string;
  change: string;
  evidence: string;
}

export interface AiChapterSummaryRelationshipChange {
  characterAName: string;
  characterBName: string;
  change: string;
}

export interface AiChapterSummaryOpenLoopUpdate {
  question: string;
  status: "opened" | "developed" | "payoff_candidate" | "closed";
  note: string;
}

export interface AiChapterSummaryRevealProgress {
  title: string;
  status: "hinted" | "armed" | "revealed" | "not_touched";
  safeNote: string;
}

export interface AiChapterSummaryContinuityWarning {
  severity: ChapterSummaryItemSeverity;
  title: string;
  body: string;
}

export interface AiChapterSummaryOutput {
  synopsis: string;
  miniVictory: string | null;
  emotionalOutcome: string | null;
  endingHook: string | null;
  newFacts: AiChapterSummaryNewFact[];
  characterStateChanges: AiChapterSummaryCharacterStateChange[];
  relationshipChanges: AiChapterSummaryRelationshipChange[];
  openLoopUpdates: AiChapterSummaryOpenLoopUpdate[];
  revealProgress: AiChapterSummaryRevealProgress[];
  continuityWarnings: AiChapterSummaryContinuityWarning[];
}

function str(value: unknown, maxLen: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError("GENERATION_FAILED", "AI summary output is missing required text fields.", 502);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new AppError(
      "GENERATION_FAILED",
      `AI summary field exceeds maximum length (${maxLen}).`,
      502,
    );
  }
  return trimmed;
}

function optionalStr(value: unknown, maxLen: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new AppError("GENERATION_FAILED", "AI summary optional field must be a string or null.", 502);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) {
    throw new AppError(
      "GENERATION_FAILED",
      `AI summary field exceeds maximum length (${maxLen}).`,
      502,
    );
  }
  return trimmed;
}

function assertNoForbiddenMarkers(text: string): void {
  const lower = text.toLowerCase();
  for (const marker of FORBIDDEN_OUTPUT_SUBSTRINGS) {
    if (lower.includes(marker)) {
      throw new AppError(
        "AI_OUTPUT_UNSAFE",
        "AI summary output contained forbidden internal markers.",
        422,
      );
    }
  }
  assertSummaryTextSafe(text);
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return t;
}

function parseNewFacts(raw: unknown): AiChapterSummaryNewFact[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChapterSummaryNewFact[] = [];
  for (const entry of raw.slice(0, MAX_NEW_FACTS)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const importance = typeof row.importance === "string" ? row.importance : FACT_IMPORTANCE.minor;
    if (!FACT_IMPORTANCE_SET.has(importance)) continue;
    const confidence =
      typeof row.confidence === "number" && Number.isFinite(row.confidence)
        ? Math.min(1, Math.max(0, row.confidence))
        : 0;
    try {
      out.push({
        content: str(row.content, BODY_MAX),
        category: str(row.category, SHORT_TEXT_MAX),
        importance: importance as FactImportance,
        confidence,
      });
    } catch {
      continue;
    }
  }
  return out;
}

function parseCharacterStateChanges(raw: unknown): AiChapterSummaryCharacterStateChange[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChapterSummaryCharacterStateChange[] = [];
  for (const entry of raw.slice(0, MAX_CHARACTER_STATE_CHANGES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    try {
      out.push({
        characterName: str(row.characterName, SHORT_TEXT_MAX),
        change: str(row.change, BODY_MAX),
        evidence: str(row.evidence, BODY_MAX),
      });
    } catch {
      continue;
    }
  }
  return out;
}

function parseRelationshipChanges(raw: unknown): AiChapterSummaryRelationshipChange[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChapterSummaryRelationshipChange[] = [];
  for (const entry of raw.slice(0, MAX_RELATIONSHIP_CHANGES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    try {
      out.push({
        characterAName: str(row.characterAName, SHORT_TEXT_MAX),
        characterBName: str(row.characterBName, SHORT_TEXT_MAX),
        change: str(row.change, BODY_MAX),
      });
    } catch {
      continue;
    }
  }
  return out;
}

function parseOpenLoopUpdates(raw: unknown): AiChapterSummaryOpenLoopUpdate[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChapterSummaryOpenLoopUpdate[] = [];
  for (const entry of raw.slice(0, MAX_OPEN_LOOP_UPDATES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const status = typeof row.status === "string" ? row.status : "";
    if (!OPEN_LOOP_STATUS_SET.has(status)) continue;
    try {
      out.push({
        question: str(row.question, BODY_MAX),
        status: status as AiChapterSummaryOpenLoopUpdate["status"],
        note: str(row.note, BODY_MAX),
      });
    } catch {
      continue;
    }
  }
  return out;
}

function parseRevealProgress(raw: unknown): AiChapterSummaryRevealProgress[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChapterSummaryRevealProgress[] = [];
  for (const entry of raw.slice(0, MAX_REVEAL_PROGRESS)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const status = typeof row.status === "string" ? row.status : "";
    if (!REVEAL_PROGRESS_STATUS_SET.has(status)) continue;
    try {
      out.push({
        title: str(row.title, SHORT_TEXT_MAX),
        status: status as AiChapterSummaryRevealProgress["status"],
        safeNote: str(row.safeNote, BODY_MAX),
      });
    } catch {
      continue;
    }
  }
  return out;
}

function parseContinuityWarnings(raw: unknown): AiChapterSummaryContinuityWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChapterSummaryContinuityWarning[] = [];
  for (const entry of raw.slice(0, MAX_CONTINUITY_WARNINGS)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const severity = typeof row.severity === "string" ? row.severity : "";
    if (!WARNING_SEVERITY_SET.has(severity as ChapterSummaryItemSeverity)) continue;
    try {
      out.push({
        severity: severity as ChapterSummaryItemSeverity,
        title: str(row.title, SHORT_TEXT_MAX),
        body: str(row.body, BODY_MAX),
      });
    } catch {
      continue;
    }
  }
  return out;
}

export function parseAndValidateChapterSummaryAiOutput(text: string): AiChapterSummaryOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(text));
  } catch {
    throw new AppError("GENERATION_FAILED", "AI returned invalid summary JSON. Please try again.", 502);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("GENERATION_FAILED", "AI summary output must be a JSON object.", 502);
  }
  const row = parsed as Record<string, unknown>;

  const synopsis = str(row.synopsis, SYNOPSIS_MAX);
  const miniVictory = optionalStr(row.miniVictory, MINI_VICTORY_MAX);
  const emotionalOutcome = optionalStr(row.emotionalOutcome, EMOTIONAL_OUTCOME_MAX);
  const endingHook = optionalStr(row.endingHook, ENDING_HOOK_MAX);

  const output: AiChapterSummaryOutput = {
    synopsis,
    miniVictory,
    emotionalOutcome,
    endingHook,
    newFacts: parseNewFacts(row.newFacts),
    characterStateChanges: parseCharacterStateChanges(row.characterStateChanges),
    relationshipChanges: parseRelationshipChanges(row.relationshipChanges),
    openLoopUpdates: parseOpenLoopUpdates(row.openLoopUpdates),
    revealProgress: parseRevealProgress(row.revealProgress),
    continuityWarnings: parseContinuityWarnings(row.continuityWarnings),
  };

  const texts = [
    output.synopsis,
    output.miniVictory,
    output.emotionalOutcome,
    output.endingHook,
    ...output.newFacts.map((f) => f.content),
    ...output.characterStateChanges.flatMap((c) => [c.change, c.evidence, c.characterName]),
    ...output.relationshipChanges.flatMap((r) => [r.change, r.characterAName, r.characterBName]),
    ...output.openLoopUpdates.flatMap((o) => [o.question, o.note]),
    ...output.revealProgress.flatMap((r) => [r.title, r.safeNote]),
    ...output.continuityWarnings.flatMap((w) => [w.title, w.body]),
  ].filter((t): t is string => Boolean(t));

  for (const t of texts) {
    assertNoForbiddenMarkers(t);
  }

  return output;
}