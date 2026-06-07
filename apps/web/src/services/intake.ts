import type { DetectedSignal, IntakeMessage, IntakeSession } from "@vibenovel/shared";
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
}

export interface ExtractSignalsResponse {
  sessionId: string;
  signals: DetectedSignal[];
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
  token?: string | null,
): Promise<SendIntakeMessageResponse> {
  return apiRequest<SendIntakeMessageResponse>(`/api/projects/${projectId}/intake/messages`, {
    method: "POST",
    body: { content },
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