export interface OperationalStyleRules {
  paragraphLength: "short" | "medium" | "long";
  averageSentenceWords: number | null;
  dialogueDensity: "low" | "medium" | "high";
  narrationStyle: string[];
  forbiddenStyle: string[];
  signatureMoves: string[];
  expositionTolerance: "low" | "medium" | "high";
  metaphorDensity: "low" | "medium" | "high";
  endingRhythm: string[];
}

export const DEFAULT_STYLE_RULES: OperationalStyleRules = {
  paragraphLength: "medium",
  averageSentenceWords: null,
  dialogueDensity: "medium",
  narrationStyle: [],
  forbiddenStyle: [],
  signatureMoves: [],
  expositionTolerance: "medium",
  metaphorDensity: "medium",
  endingRhythm: [],
};
