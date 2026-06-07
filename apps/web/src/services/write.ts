import type {
  ChapterBeat,
  ChapterProseVersion,
  ChapterWritingState,
  WriterContextPacketPreview,
  WritingSession,
} from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";

export interface WritingSessionDetail {
  session: WritingSession;
  writingState: ChapterWritingState;
  chapterOutline: {
    id: string;
    chapterNumber: number;
    title: string;
    summary: string;
    status: string;
  };
  activeBeat: ChapterBeat | null;
  beatsCount: number;
}

export interface StartWritingSessionResponse {
  session: WritingSession;
  writingState: ChapterWritingState;
}

export interface BeatProseVersionsResponse {
  versions: ChapterProseVersion[];
  currentVersion: ChapterProseVersion | null;
}

export interface SaveProseDraftResponse {
  version: ChapterProseVersion;
  chapterWordCount: number;
}

export interface GenerateBeatsResponse {
  beats: ChapterBeat[];
  created: boolean;
}

export interface ContextPacketSafetyMeta {
  planningTruthPresent: false;
  futureChapterSummaryPresent: false;
  packetHash: string;
  builderVersion: string;
}

export interface BuildContextPacketResponse {
  packetLogId: string;
  preview: WriterContextPacketPreview;
  safety: ContextPacketSafetyMeta;
}

export interface ReadyForSummaryResponse {
  session: WritingSession;
  writingState: ChapterWritingState;
}

export async function startWritingSession(
  projectId: string,
  token: string | null | undefined,
  body: { chapterOutlineId: string; activeBeatId?: string },
): Promise<StartWritingSessionResponse> {
  return apiRequest<StartWritingSessionResponse>(`/api/projects/${projectId}/write/sessions`, {
    method: "POST",
    body,
    token,
  });
}

export async function fetchWritingSession(
  projectId: string,
  sessionId: string,
  token?: string | null,
): Promise<WritingSessionDetail> {
  return apiRequest<WritingSessionDetail>(
    `/api/projects/${projectId}/write/sessions/${sessionId}`,
    { token },
  );
}

export async function patchWritingSession(
  projectId: string,
  sessionId: string,
  token: string | null | undefined,
  body: { activeBeatId?: string | null; status?: string },
): Promise<{ session: WritingSession }> {
  return apiRequest<{ session: WritingSession }>(
    `/api/projects/${projectId}/write/sessions/${sessionId}`,
    { method: "PATCH", body, token },
  );
}

export async function fetchSessionBeats(
  projectId: string,
  sessionId: string,
  token?: string | null,
): Promise<{ beats: ChapterBeat[] }> {
  return apiRequest<{ beats: ChapterBeat[] }>(
    `/api/projects/${projectId}/write/sessions/${sessionId}/beats`,
    { token },
  );
}

export async function generateSessionBeats(
  projectId: string,
  sessionId: string,
  token: string | null | undefined,
  body: { regenerate?: boolean } = {},
): Promise<GenerateBeatsResponse> {
  return apiRequest<GenerateBeatsResponse>(
    `/api/projects/${projectId}/write/sessions/${sessionId}/beats/generate`,
    { method: "POST", body, token },
  );
}

export async function fetchBeatProseVersions(
  projectId: string,
  beatId: string,
  token?: string | null,
): Promise<BeatProseVersionsResponse> {
  return apiRequest<BeatProseVersionsResponse>(
    `/api/projects/${projectId}/write/beats/${beatId}/prose`,
    { token },
  );
}

export async function saveBeatProse(
  projectId: string,
  beatId: string,
  token: string | null | undefined,
  body: {
    proseText: string;
    source?: "user_edited" | "stub_deterministic";
    contextPacketLogId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<SaveProseDraftResponse> {
  return apiRequest<SaveProseDraftResponse>(
    `/api/projects/${projectId}/write/beats/${beatId}/prose`,
    { method: "POST", body, token },
  );
}

export async function fetchProseVersion(
  projectId: string,
  versionId: string,
  token?: string | null,
): Promise<{ version: ChapterProseVersion }> {
  return apiRequest<{ version: ChapterProseVersion }>(
    `/api/projects/${projectId}/write/prose/${versionId}`,
    { token },
  );
}

export async function buildContextPacket(
  projectId: string,
  token: string | null | undefined,
  body: { chapterOutlineId: string; beatId?: string },
): Promise<BuildContextPacketResponse> {
  return apiRequest<BuildContextPacketResponse>(
    `/api/projects/${projectId}/write/context-packet`,
    { method: "POST", body, token },
  );
}

export async function markSessionReadyForSummary(
  projectId: string,
  sessionId: string,
  token: string | null | undefined,
): Promise<ReadyForSummaryResponse> {
  return apiRequest<ReadyForSummaryResponse>(
    `/api/projects/${projectId}/write/sessions/${sessionId}/ready-for-summary`,
    { method: "POST", body: {}, token },
  );
}