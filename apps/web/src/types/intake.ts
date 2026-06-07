export type IntakeMessageRole = "agent" | "user";

export type IntakeProgressStatus = "done" | "active" | "pending";

export interface IntakeMessage {
  id: string;
  role: IntakeMessageRole;
  content: string;
  timestamp: string;
}

export interface IntakeProgressItem {
  id: string;
  label: string;
  status: IntakeProgressStatus;
  detail?: string;
}

export interface DetectedSignal {
  id: string;
  label: string;
  icon: string;
  pending?: boolean;
}

export interface IntakeSession {
  projectId: string;
  pageTitle: string;
  introTitle: string;
  introSubtitle: string;
  messages: IntakeMessage[];
  progress: IntakeProgressItem[];
  progressPercent: number;
  detectedSignals: DetectedSignal[];
  suggestedActions: string[];
  conceptsRoute: string;
  inputPlaceholder: string;
  inputTip: string;
  ctaLabel: string;
  ctaHint: string;
}