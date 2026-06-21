import type {
  Character,
  CharacterKnowledge,
  CharacterKnowledgeStatus,
  CharacterState,
  Fact,
  OpenLoop,
  OpenLoopStatus,
  PlannedRevealStatus,
} from "@vibenovel/shared";
import { apiRequest } from "@/lib/api";
import type { PlannedRevealPublic } from "@/services/outline";

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

export interface StyleProfile {
  id: string;
  projectId: string;
  version: number;
  status: string;
  operationalRules: OperationalStyleRules;
  source: string;
  sourceProseVersionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_OPERATIONAL_STYLE_RULES: OperationalStyleRules = {
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

export interface CharacterStateResponse {
  characterId: string;
  state: CharacterState | null;
  history: CharacterState[];
}

export interface CharacterKnowledgeResponse {
  characterId: string;
  knowledge: CharacterKnowledge[];
}

export async function fetchStoryControlFacts(
  projectId: string,
  token?: string | null,
): Promise<Fact[]> {
  return apiRequest<Fact[]>(`/api/projects/${projectId}/facts`, { token });
}

export async function fetchStoryControlCharacters(
  projectId: string,
  token?: string | null,
): Promise<Character[]> {
  return apiRequest<Character[]>(`/api/projects/${projectId}/characters`, { token });
}

export async function fetchStyleProfile(
  projectId: string,
  token?: string | null,
): Promise<StyleProfile | null> {
  const result = await apiRequest<{ profile: StyleProfile | null }>(
    `/api/projects/${projectId}/style-profile`,
    { token },
  );
  return result.profile;
}

export async function patchStoryFact(
  projectId: string,
  factId: string,
  body: { isLocked: boolean },
  token?: string | null,
): Promise<Fact> {
  return apiRequest<Fact>(`/api/projects/${projectId}/facts/${factId}`, {
    method: "PATCH",
    body,
    token,
  });
}

export async function patchStoryOpenLoop(
  projectId: string,
  loopId: string,
  body: { status: OpenLoopStatus },
  token?: string | null,
): Promise<OpenLoop> {
  return apiRequest<OpenLoop>(
    `/api/projects/${projectId}/outline/open-loops/${loopId}`,
    { method: "PATCH", body, token },
  );
}

export async function patchStoryReveal(
  projectId: string,
  revealId: string,
  body:
    | { status: PlannedRevealStatus }
    | { planningTruth: string; confirmation: "UPDATE_PLANNING_TRUTH" },
  token?: string | null,
): Promise<PlannedRevealPublic> {
  return apiRequest<PlannedRevealPublic>(
    `/api/projects/${projectId}/outline/reveals/${revealId}`,
    { method: "PATCH", body, token },
  );
}

export async function fetchCharacterContinuity(
  projectId: string,
  characterId: string,
  token?: string | null,
): Promise<{
  state: CharacterStateResponse;
  knowledge: CharacterKnowledgeResponse;
}> {
  const [state, knowledge] = await Promise.all([
    apiRequest<CharacterStateResponse>(
      `/api/projects/${projectId}/continuity/characters/${characterId}/state`,
      { token },
    ),
    apiRequest<CharacterKnowledgeResponse>(
      `/api/projects/${projectId}/continuity/characters/${characterId}/knowledge`,
      { token },
    ),
  ]);
  return { state, knowledge };
}

export async function putCharacterState(
  projectId: string,
  characterId: string,
  body: {
    confirmation: "UPDATE_CONTINUITY_STATE";
    chapterNumber: number;
    emotionalState?: string | null;
    physicalState?: string | null;
    currentGoal?: string | null;
  },
  token?: string | null,
): Promise<CharacterState> {
  return apiRequest<CharacterState>(
    `/api/projects/${projectId}/continuity/characters/${characterId}/state`,
    { method: "PUT", body, token },
  );
}

export async function putCharacterKnowledge(
  projectId: string,
  characterId: string,
  factId: string,
  body: {
    confirmation: "UPDATE_CONTINUITY_KNOWLEDGE";
    knowledgeStatus: CharacterKnowledgeStatus;
    confidence?: number | null;
    learnedAtChapter?: number | null;
  },
  token?: string | null,
): Promise<CharacterKnowledge> {
  return apiRequest<CharacterKnowledge>(
    `/api/projects/${projectId}/continuity/characters/${characterId}/knowledge/${factId}`,
    { method: "PUT", body, token },
  );
}

export async function putStyleProfile(
  projectId: string,
  operationalRules: OperationalStyleRules,
  token?: string | null,
): Promise<StyleProfile> {
  return apiRequest<StyleProfile>(`/api/projects/${projectId}/style-profile`, {
    method: "PUT",
    body: {
      confirmation: "UPDATE_STYLE_PROFILE",
      operationalRules,
    },
    token,
  });
}
