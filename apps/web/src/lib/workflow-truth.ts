import type { Project, WorkflowPhase } from "@vibenovel/shared";
import { WORKFLOW_PHASES } from "@vibenovel/shared";
import type { DashboardProgressStep } from "@/mocks/dashboard";
import { ROUTES } from "@/routes/paths";

export type RouteTruthStatus =
  | "REAL_READY"
  | "REAL_PARTIAL"
  | "STUB_HONEST"
  | "LOCKED_UNTIL_PREVIOUS_STEP"
  | "DEV_DEMO_ONLY";

const PHASE_ORDER: WorkflowPhase[] = [
  WORKFLOW_PHASES.intake,
  WORKFLOW_PHASES.concepts,
  WORKFLOW_PHASES.foundation,
  WORKFLOW_PHASES.foundation_locked,
  WORKFLOW_PHASES.outline,
  WORKFLOW_PHASES.outline_locked,
  WORKFLOW_PHASES.writing,
];

function phaseIndex(phase: WorkflowPhase | null | undefined): number {
  if (!phase) return 0;
  const idx = PHASE_ORDER.indexOf(phase);
  return idx >= 0 ? idx : 0;
}

function hasReached(phase: WorkflowPhase | null | undefined, target: WorkflowPhase): boolean {
  return phaseIndex(phase) >= phaseIndex(target);
}

export function buildHonestProgressSteps(project: Project): DashboardProgressStep[] {
  const phase = project.workflowPhase ?? WORKFLOW_PHASES.intake;
  const chapter = project.currentChapter;

  const foundationDone = hasReached(phase, WORKFLOW_PHASES.foundation_locked);
  const outlineDone = hasReached(phase, WORKFLOW_PHASES.outline_locked);
  const writingActive =
    phase === WORKFLOW_PHASES.writing || (outlineDone && chapter > 0);

  return [
    {
      id: "intake",
      label: hasReached(phase, WORKFLOW_PHASES.concepts)
        ? "Intake selesai"
        : phase === WORKFLOW_PHASES.intake
          ? "Intake berjalan"
          : "Draft baru",
      status: hasReached(phase, WORKFLOW_PHASES.concepts) ? "done" : "current",
    },
    {
      id: "foundation",
      label: foundationDone
        ? "Fondasi dikunci"
        : hasReached(phase, WORKFLOW_PHASES.foundation)
          ? "Fondasi belum dikunci"
          : "Fondasi belum dibuat",
      status: foundationDone ? "done" : hasReached(phase, WORKFLOW_PHASES.foundation) ? "current" : "pending",
    },
    {
      id: "outline",
      label: outlineDone
        ? "Outline dikunci"
        : hasReached(phase, WORKFLOW_PHASES.outline)
          ? "Outline belum dikunci"
          : "Outline belum dibuat",
      status: outlineDone ? "done" : hasReached(phase, WORKFLOW_PHASES.outline) ? "current" : "pending",
    },
    {
      id: "chapter",
      label: writingActive
        ? chapter > 0
          ? `Bab ${chapter} sedang ditulis`
          : "Menunggu langkah berikutnya"
        : "Ruang tulis belum tersedia",
      status: writingActive ? "current" : "pending",
    },
    {
      id: "publish",
      label: "Paket publish belum tersedia di beta",
      status: "pending",
    },
  ];
}

export function buildHonestRecentStatusLabel(project: Project): string {
  const phase = project.workflowPhase ?? WORKFLOW_PHASES.intake;

  if (phase === WORKFLOW_PHASES.intake) return "Intake berjalan";
  if (phase === WORKFLOW_PHASES.concepts) return "Pilih konsep";
  if (phase === WORKFLOW_PHASES.foundation) return "Fondasi belum dikunci";
  if (phase === WORKFLOW_PHASES.foundation_locked) return "Outline belum dibuat";
  if (phase === WORKFLOW_PHASES.outline) return "Outline belum dikunci";
  if (phase === WORKFLOW_PHASES.outline_locked) return "Siap menulis";
  if (phase === WORKFLOW_PHASES.writing && project.currentChapter > 0) {
    return `Bab ${project.currentChapter}`;
  }
  return "Menunggu langkah berikutnya";
}

export function buildHonestRecentExcerpt(project: Project): string {
  const phase = project.workflowPhase ?? WORKFLOW_PHASES.intake;
  if (phase === WORKFLOW_PHASES.intake) {
    return "Lanjutkan obrolan intake untuk mengumpulkan ide cerita.";
  }
  if (phase === WORKFLOW_PHASES.concepts) {
    return "Pilih arah cerita sebelum membangun fondasi.";
  }
  if (!hasReached(phase, WORKFLOW_PHASES.foundation_locked)) {
    return "Lengkapi fondasi cerita sebelum outline dan ruang tulis.";
  }
  if (!hasReached(phase, WORKFLOW_PHASES.outline_locked)) {
    return "Buat dan kunci outline sebelum menulis bab.";
  }
  return project.genre
    ? `Proyek ${project.genre} — lanjutkan dari terakhir kali Anda menulis.`
    : "Lanjutkan proyek cerita Anda.";
}

export function resolveHonestProjectRoute(project: Project): string {
  const phase = project.workflowPhase ?? WORKFLOW_PHASES.intake;
  if (phase === WORKFLOW_PHASES.intake) return ROUTES.project.intake(project.id);
  if (phase === WORKFLOW_PHASES.concepts) return ROUTES.project.concepts(project.id);
  if (!hasReached(phase, WORKFLOW_PHASES.foundation_locked)) {
    return ROUTES.project.foundation(project.id);
  }
  if (!hasReached(phase, WORKFLOW_PHASES.outline_locked)) {
    return ROUTES.project.outline(project.id);
  }
  return ROUTES.project.write(project.id);
}

export interface NavLockState {
  foundation: boolean;
  outline: boolean;
  write: boolean;
  publish: boolean;
}

/** true = nav item enabled */
export function resolveNavLocks(phase: WorkflowPhase | null | undefined): NavLockState {
  const p = phase ?? WORKFLOW_PHASES.intake;
  return {
    foundation: hasReached(p, WORKFLOW_PHASES.foundation),
    outline: hasReached(p, WORKFLOW_PHASES.foundation_locked),
    write: hasReached(p, WORKFLOW_PHASES.outline_locked),
    publish: false,
  };
}

export const INTAKE_STUB_ASSISTANT_LABEL =
  "Balasan awal otomatis. AI penuh belum aktif untuk tahap ini.";

export const DEMO_MODE_LABEL = "Mode demo — data contoh Sprint 1, bukan proyek Anda.";