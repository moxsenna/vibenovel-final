import { INTAKE_PHASES, type IntakePhase } from "@vibenovel/shared";
import type { IntakeFilledSignalSummary } from "./intake-extraction.js";
import { buildIntakeExtractionInstructions } from "./intake-extraction.js";

export type NarraPhase = IntakePhase;

export interface ResolveNarraPhaseInput {
  requestedPhase?: string;
  entrypoint?: string;
}

export interface NarraPromptContext {
  phase: NarraPhase;
  projectTitle: string;
  foundationSummary?: string;
  readinessSummary?: string;
  missingSignals?: string[];
  filledSignals?: IntakeFilledSignalSummary[];
}

export function resolveNarraPhase(input: ResolveNarraPhaseInput): NarraPhase {
  if (
    input.requestedPhase === INTAKE_PHASES.foundation_refinement ||
    input.entrypoint === "foundation"
  ) {
    return INTAKE_PHASES.foundation_refinement;
  }
  if (input.requestedPhase === INTAKE_PHASES.concept_generation) {
    return INTAKE_PHASES.concept_generation;
  }
  if (input.requestedPhase === INTAKE_PHASES.signal_detection) {
    return INTAKE_PHASES.signal_detection;
  }
  if (input.requestedPhase === INTAKE_PHASES.foundation_preparation) {
    return INTAKE_PHASES.foundation_preparation;
  }
  return INTAKE_PHASES.idea_collection;
}

export function buildNarraSystemPrompt(ctx: NarraPromptContext): string {
  const base =
    "Kamu adalah Asisten Narra, rekan cerita untuk penulis serial Indonesia. " +
    "Jawab hangat, ringkas, spesifik, dan tidak robotik. " +
    "Ajukan satu pertanyaan berguna saja setiap giliran. " +
    "Jangan membuat fakta canon diam-diam. Semua perubahan cerita harus menjadi proposal yang bisa ditinjau penulis.";

  if (ctx.phase === INTAKE_PHASES.foundation_refinement) {
    return [
      base,
      "Mode saat ini: foundation refinement.",
      `Judul proyek: ${ctx.projectTitle}`,
      `Ringkasan fondasi: ${ctx.foundationSummary ?? "(belum tersedia)"}`,
      `Kesiapan fondasi: ${ctx.readinessSummary ?? "(belum dihitung)"}`,
      "Tugasmu: bantu penulis mematangkan motivasi tokoh, tekanan lawan, stakes, janji pembaca, dan gaya serial.",
      "Jangan ulangi detail yang sudah jelas. Jika informasi sudah cukup, arahkan penulis untuk membuat Usulan Narra.",
    ].join("\n");
  }

  const ideaPrompt = [
    base,
    "Mode saat ini: idea intake.",
    `Judul proyek: ${ctx.projectTitle}`,
    "Tugasmu: bantu penulis mengumpulkan ide, tokoh, konflik, genre, tone, target pembaca, dan rahasia yang perlu ditahan.",
  ].join("\n");

  return ideaPrompt + buildIntakeExtractionInstructions(ctx.missingSignals ?? [], ctx.filledSignals ?? []);
}
