import type { WriterSafetyEnvelope } from "@vibenovel/shared";

/**
 * Compile a WriterSafetyEnvelope for a given chapter/beat.
 * This data MUST NEVER be sent to the Writer model or returned in public API.
 */
export function buildWriterSafetyEnvelope(input: {
  projectId: string;
  chapterOutlineId: string;
  chapterNumber: number;
  beatId: string | null;
  futureRevealFactIds: string[];
  forbiddenRevealPhrases: string[];
}): WriterSafetyEnvelope {
  return {
    version: "writer_safety_v1",
    projectId: input.projectId,
    chapterOutlineId: input.chapterOutlineId,
    chapterNumber: input.chapterNumber,
    beatId: input.beatId,
    futureRevealFactIds: input.futureRevealFactIds,
    forbiddenRevealPhrases: input.forbiddenRevealPhrases,
    unknownFactConstraints: [],
    hardBeatConstraints: {
      mustInclude: [],
      mustNotInclude: [],
      stopCondition: null,
    },
  };
}
