import type {
  CreditBalance,
  DetectedSignal,
  IntakeMessage,
  IntakeSession,
} from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface IntakeBundleResponse {
  session: IntakeSession;
  messages: IntakeMessage[];
  signals: DetectedSignal[];
}

export interface SendIntakeMessageResponse {
  userMessage: IntakeMessage;
  agentMessage: IntakeMessage;
  session: IntakeSession;
  creditCost: number;
  creditBalance: CreditBalance | null;
  idempotentReplay: boolean;
}

export interface ExtractSignalsResponse {
  sessionId: string;
  signals: DetectedSignal[];
}

export function buildIntakeReplyIdempotencyKey(projectId: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `intake-${projectId}-${Date.now()}-${suffix}`;
}

export async function fetchIntakeBundle(
  projectId: string,
  token?: string | null,
): Promise<IntakeBundleResponse> {
  return apiRequest<IntakeBundleResponse>(`/api/projects/${projectId}/intake`, { token });
}

export async function sendIntakeMessage(
  projectId: string,
  content: string,
  token: string | null | undefined,
  options: {
    idempotencyKey: string;
    phase?: string;
    entrypoint?: string;
  },
): Promise<SendIntakeMessageResponse> {
  return apiRequest<SendIntakeMessageResponse>(`/api/projects/${projectId}/intake/messages`, {
    method: "POST",
    body: { content, ...options },
    token,
  });
}

export async function extractIntakeSignals(
  projectId: string,
  token?: string | null,
): Promise<ExtractSignalsResponse> {
  return apiRequest<ExtractSignalsResponse>(
    `/api/projects/${projectId}/intake/extract-signals`,
    { method: "POST", token },
  );
}
