import type {
  WriterContextPacket,
  WriterSafetyEnvelope,
} from "@vibenovel/shared";
import type { ProseOutputValidationContext } from "./prose-output-safe-repair.js";

const MIN_HOOK_KEYWORD_LEN = 5;
const MAX_HOOK_KEYWORDS = 8;

function collectHookKeywordCandidates(packet: WriterContextPacket): string[] {
  const raw = [
    packet.hookTarget.chapterEndingHook,
    packet.hookTarget.beatStopCondition,
    packet.currentChapter.endingHook,
    packet.currentChapter.hook,
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  const keywords: string[] = [];
  for (const line of raw) {
    for (const token of line.split(/\s+/)) {
      const word = token.replace(/[^\p{L}\p{N}]/gu, "").trim();
      if (word.length >= MIN_HOOK_KEYWORD_LEN) {
        keywords.push(word);
      }
    }
  }
  return keywords;
}

export function buildProseValidationContextFromPacket(
  preview: { mustInclude: string[]; mustNotInclude: string[] },
  writerPacket: WriterContextPacket,
  povForbiddenFactTexts: string[],
  safetyEnvelope?: WriterSafetyEnvelope,
): ProseOutputValidationContext {
  const hookKeywords = [...new Set(collectHookKeywordCandidates(writerPacket))].slice(
    0,
    MAX_HOOK_KEYWORDS,
  );
  const tone = writerPacket.foundation.tone?.trim() ?? null;

  return {
    forbiddenConcepts: [
      ...(safetyEnvelope?.forbiddenRevealPhrases ?? []),
      ...(safetyEnvelope?.hardBeatConstraints.mustNotInclude ?? preview.mustNotInclude),
    ],
    mustInclude:
      safetyEnvelope?.hardBeatConstraints.mustInclude ?? preview.mustInclude,
    povForbiddenFactTexts,
    retentionHookKeywords: hookKeywords,
    styleToneHint: tone && tone.length >= 4 ? tone : null,
  };
}
