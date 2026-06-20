import type { WriterContextPacket } from "@vibenovel/shared";

/* ------------------------------------------------------------------ */
/*  Budget tables                                                      */
/* ------------------------------------------------------------------ */

export const WRITER_CONTEXT_PROFILE_BUDGETS = {
  conservative: {
    foundation: 600,
    currentChapterAndBeat: 2_400,
    canonFacts: 3_000,
    charactersAndState: 3_000,
    knowledge: 2_500,
    speechRules: 1_000,
    priorSummaries: 1_200,
    precedingProseTail: 900,
    timeline: 500,
    openLoops: 800,
    breadcrumbs: 500,
    retrievalMemory: 600,
    styleRules: 800,
  },
  full: {
    foundation: 1_800,
    currentChapterAndBeat: 2_400,
    canonFacts: 4_000,
    charactersAndState: 4_000,
    knowledge: 3_500,
    speechRules: 2_000,
    priorSummaries: 5_000,
    precedingProseTail: 900,
    timeline: 2_500,
    openLoops: 2_500,
    breadcrumbs: 1_500,
    retrievalMemory: 3_000,
    styleRules: 2_000,
  },
} as const;

export const WRITER_CONTEXT_TOTAL_CHAR_CAP = {
  conservative: 17_800,
  full: 35_100,
} as const;

export type BudgetProfile = keyof typeof WRITER_CONTEXT_PROFILE_BUDGETS;

/* ------------------------------------------------------------------ */
/*  Env resolver                                                       */
/* ------------------------------------------------------------------ */

export function resolveContextBudgetProfile(
  raw: string | undefined,
): BudgetProfile {
  if (raw === "full") return "full";
  return "conservative";
}

/* ------------------------------------------------------------------ */
/*  Serializer                                                         */
/* ------------------------------------------------------------------ */

export interface SerializeContextResult {
  text: string;
  truncatedSections: string[];
  sectionChars: Record<string, number>;
}

/**
 * Serialize a WriterContextPacket into budgeted prompt text.
 * Truncates sections according to priority order when over total cap.
 */
export function serializeContext(
  packet: WriterContextPacket,
  profile: BudgetProfile,
): SerializeContextResult {
  const budgets = WRITER_CONTEXT_PROFILE_BUDGETS[profile];
  const totalCap = WRITER_CONTEXT_TOTAL_CHAR_CAP[profile];

  // Build all sections with their budgets
  const sections: Array<{ label: string; content: string; budget: number }> = [];

  sections.push({
    label: "CURRENT BEAT CONTRACT",
    content: formatSection("CURRENT BEAT CONTRACT", [
      `Chapter ${packet.meta.chapterNumber}: ${packet.currentChapter.title}`,
      packet.currentChapter.summary,
      packet.currentChapter.purpose ? `Purpose: ${packet.currentChapter.purpose}` : null,
      packet.hookTarget.beatStopCondition
        ? `Stop condition: ${packet.hookTarget.beatStopCondition}`
        : null,
      packet.emotionalTarget.beatEmotionalShift
        ? `Emotional shift: ${packet.emotionalTarget.beatEmotionalShift}`
        : null,
      packet.constraints.mustInclude.length > 0
        ? `Must include: ${packet.constraints.mustInclude.join("; ")}`
        : null,
      packet.constraints.mustNotInclude.length > 0
        ? `Must avoid: ${packet.constraints.mustNotInclude.join("; ")}`
        : null,
      packet.constraints.mobileFormatRules.length > 0
        ? `Format: ${packet.constraints.mobileFormatRules.join(" ")}`
        : null,
    ].filter((s): s is string => s !== null)),
    budget: budgets.currentChapterAndBeat,
  });

  sections.push({
    label: "CANON FACTS",
    content: formatSection(
      "CANON FACTS",
      packet.canon.facts.map((f) => (typeof f === "string" ? f : f.text)),
    ),
    budget: budgets.canonFacts,
  });

  sections.push({
    label: "RELEVANT CHARACTERS AND CURRENT STATE",
    content: formatSection(
      "RELEVANT CHARACTERS AND CURRENT STATE",
      packet.canon.characters.map(
        (c) => `${c.name} (${c.roleLabel}): ${c.descriptionSummary}`,
      ),
    ),
    budget: budgets.charactersAndState,
  });

  sections.push({
    label: "CHARACTER KNOWLEDGE",
    content: "[Character knowledge constraints — not yet populated]",
    budget: budgets.knowledge,
  });

  sections.push({
    label: "SPEECH RULES",
    content: formatSection(
      "SPEECH RULES",
      packet.canon.speechRules.map(
        (r) => `${r.relationshipLabel}: ${r.ruleText}`,
      ),
    ),
    budget: budgets.speechRules,
  });

  sections.push({
    label: "RECENT APPROVED CHAPTER HISTORY",
    content: formatSection(
      "RECENT APPROVED CHAPTER HISTORY",
      packet.continuity.previousChapterSummaries,
    ),
    budget: budgets.priorSummaries,
  });

  sections.push({
    label: "PRECEDING CURRENT PROSE TAIL",
    content: "[Preceding prose — populated during generation]",
    budget: budgets.precedingProseTail,
  });

  sections.push({
    label: "PAST TIMELINE",
    content: formatSection(
      "PAST TIMELINE",
      packet.continuity.unresolvedThreadLabels,
    ),
    budget: budgets.timeline,
  });

  sections.push({
    label: "ACTIVE OPEN LOOPS",
    content: formatSection(
      "ACTIVE OPEN LOOPS",
      packet.continuity.openLoopsActive.map(
        (l) => `${l.question}${l.readerFacingHint ? ` (${l.readerFacingHint})` : ""}`,
      ),
    ),
    budget: budgets.openLoops,
  });

  sections.push({
    label: "ALLOWED BREADCRUMBS",
    content: formatSection(
      "ALLOWED BREADCRUMBS",
      packet.revealGate.allowedBreadcrumbs,
    ),
    budget: budgets.breadcrumbs,
  });

  sections.push({
    label: "RETRIEVED DRAFT MEMORY — CONTEXT ONLY",
    content: "[No retrieval memory available]",
    budget: budgets.retrievalMemory,
  });

  sections.push({
    label: "STYLE RULES",
    content: "[Style rules — not yet populated]",
    budget: budgets.styleRules,
  });

  // Foundation goes last (lowest priority)
  sections.push({
    label: "GENERAL FOUNDATION",
    content: formatSection("GENERAL FOUNDATION", [
      packet.foundation.premiseSummary,
      packet.foundation.mainConflictSummary,
      packet.foundation.readerPromise,
      packet.foundation.tone ? `Tone: ${packet.foundation.tone}` : null,
    ].filter((s): s is string => s !== null)),
    budget: budgets.foundation,
  });

  // Truncation priority order (first = keep, last = cut first)
  // The sections array is in priority order: highest priority first
  const truncatedSections: string[] = [];
  let remaining = totalCap;
  const sectionChars: Record<string, number> = {};

  const result: string[] = [];
  for (const section of sections) {
    const label = `[${section.label}]`;
    let content = section.content;

    // Truncate section content if it exceeds its budget
    if (content.length > section.budget) {
      content = content.slice(0, section.budget);
      truncatedSections.push(section.label);
    }

    const sectionText = content ? `${label}\n${content}` : label;
    const sectionLen = sectionText.length;

    if (sectionLen <= remaining) {
      result.push(sectionText);
      sectionChars[section.label] = sectionLen;
      remaining -= sectionLen;
    } else if (remaining > label.length + 5) {
      // Fit what we can
      const available = remaining - label.length - 3;
      const truncated = content.slice(0, Math.max(0, available));
      result.push(`${label}\n${truncated}`);
      sectionChars[section.label] = label.length + truncated.length + 1;
      remaining = 0;
      truncatedSections.push(section.label);
    } else {
      // Skip this section entirely
      truncatedSections.push(section.label);
    }
  }

  return {
    text: result.join("\n\n"),
    truncatedSections,
    sectionChars,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSection(label: string, items: string[]): string {
  if (items.length === 0) return `[${label}]`;
  return items.filter((s) => s.trim()).join("\n");
}
