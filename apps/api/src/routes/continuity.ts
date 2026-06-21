import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  CHARACTER_KNOWLEDGE_STATUSES,
  type CharacterKnowledgeStatus,
} from "@vibenovel/shared";
import type { Hono } from "hono";
import { AppError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  listCharacterKnowledgeForOwner,
  upsertCharacterKnowledgeForOwner,
} from "../services/character-knowledge.js";
import {
  listCharacterStatesForOwner,
  upsertCharacterStateForOwner,
} from "../services/character-state.js";
import { listCharactersForOwner } from "../services/character.js";
import { listFactsForOwner } from "../services/fact.js";
import { writeAuditLog } from "../services/audit.js";
import type { AppEnv } from "../types.js";

const KNOWLEDGE_STATUS_SET = new Set<string>(
  Object.values(CHARACTER_KNOWLEDGE_STATUSES),
);

function recordBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  return raw as Record<string, unknown>;
}

function optionalText(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw AppError.badRequest(`${field} must be a string or null`);
  return value.trim() || null;
}

export function parseContinuityStateUpdate(raw: unknown) {
  const body = recordBody(raw);
  if (body.confirmation !== "UPDATE_CONTINUITY_STATE") {
    throw AppError.badRequest("Must send confirmation: UPDATE_CONTINUITY_STATE");
  }
  if (!Number.isInteger(body.chapterNumber) || Number(body.chapterNumber) < 1) {
    throw AppError.badRequest("chapterNumber must be a positive integer");
  }
  return {
    chapterNumber: Number(body.chapterNumber),
    emotionalState: optionalText(body.emotionalState, "emotionalState"),
    physicalState: optionalText(body.physicalState, "physicalState"),
    currentGoal: optionalText(body.currentGoal, "currentGoal"),
    locationId: optionalText(body.locationId, "locationId"),
  };
}

export function parseContinuityKnowledgeUpdate(raw: unknown) {
  const body = recordBody(raw);
  if (body.confirmation !== "UPDATE_CONTINUITY_KNOWLEDGE") {
    throw AppError.badRequest("Must send confirmation: UPDATE_CONTINUITY_KNOWLEDGE");
  }
  if (
    typeof body.knowledgeStatus !== "string" ||
    !KNOWLEDGE_STATUS_SET.has(body.knowledgeStatus)
  ) {
    throw AppError.badRequest("knowledgeStatus is invalid");
  }
  const confidence =
    body.confidence === undefined || body.confidence === null
      ? null
      : Number(body.confidence);
  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    throw AppError.badRequest("confidence must be between 0 and 1");
  }
  const learnedAtChapter =
    body.learnedAtChapter === undefined || body.learnedAtChapter === null
      ? null
      : Number(body.learnedAtChapter);
  if (
    learnedAtChapter !== null &&
    (!Number.isInteger(learnedAtChapter) || learnedAtChapter < 1)
  ) {
    throw AppError.badRequest("learnedAtChapter must be a positive integer");
  }
  return {
    knowledgeStatus: body.knowledgeStatus as CharacterKnowledgeStatus,
    confidence,
    learnedAtChapter,
    learnedFrom: optionalText(body.learnedFrom, "learnedFrom") ?? null,
  };
}

async function assertCharacterInProject(
  env: AppEnv["Bindings"],
  ownerId: string,
  projectId: string,
  characterId: string,
): Promise<void> {
  const characters = await listCharactersForOwner(env, ownerId, projectId, true);
  if (!characters.some((character) => character.id === characterId)) {
    throw AppError.notFound("Character not found");
  }
}

export function registerContinuityRoutes(app: Hono<AppEnv>): void {
  app.get(
    "/api/projects/:id/continuity/characters/:characterId/state",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const characterId = c.req.param("characterId");
      await assertCharacterInProject(c.env, ownerId, projectId, characterId);
      const states = await listCharacterStatesForOwner(
        c.env,
        ownerId,
        projectId,
        characterId,
      );
      return jsonSuccess(c, {
        characterId,
        state: states.at(-1) ?? null,
        history: states,
      });
    },
  );

  app.put(
    "/api/projects/:id/continuity/characters/:characterId/state",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const characterId = c.req.param("characterId");
      const input = parseContinuityStateUpdate(await c.req.json().catch(() => null));
      await assertCharacterInProject(c.env, ownerId, projectId, characterId);
      const state = await upsertCharacterStateForOwner(c.env, ownerId, projectId, {
        characterId,
        ...input,
      });
      await writeAuditLog(c.env, {
        userId: ownerId,
        projectId,
        action: AUDIT_ACTIONS.continuity_state_updated,
        entityType: AUDIT_ENTITY_TYPES.character_state,
        entityId: state.id,
        afterData: {
          characterId,
          chapterNumber: state.chapterNumber,
          emotionalState: state.emotionalState,
          physicalState: state.physicalState,
          currentGoal: state.currentGoal,
          locationId: state.locationId,
        },
      });
      return jsonSuccess(c, state);
    },
  );

  app.get(
    "/api/projects/:id/continuity/characters/:characterId/knowledge",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const characterId = c.req.param("characterId");
      await assertCharacterInProject(c.env, ownerId, projectId, characterId);
      const knowledge = await listCharacterKnowledgeForOwner(
        c.env,
        ownerId,
        projectId,
        characterId,
      );
      return jsonSuccess(c, { characterId, knowledge });
    },
  );

  app.put(
    "/api/projects/:id/continuity/characters/:characterId/knowledge/:factId",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const characterId = c.req.param("characterId");
      const factId = c.req.param("factId");
      const input = parseContinuityKnowledgeUpdate(await c.req.json().catch(() => null));

      const [characters, facts] = await Promise.all([
        listCharactersForOwner(c.env, ownerId, projectId, true),
        listFactsForOwner(c.env, ownerId, projectId, true),
      ]);
      if (!characters.some((character) => character.id === characterId)) {
        throw AppError.notFound("Character not found");
      }
      if (!facts.some((fact) => fact.id === factId)) {
        throw AppError.notFound("Fact not found");
      }

      const knowledge = await upsertCharacterKnowledgeForOwner(
        c.env,
        ownerId,
        projectId,
        { characterId, factId, ...input },
      );
      await writeAuditLog(c.env, {
        userId: ownerId,
        projectId,
        action: AUDIT_ACTIONS.continuity_knowledge_updated,
        entityType: AUDIT_ENTITY_TYPES.character_knowledge,
        entityId: knowledge.id,
        afterData: {
          characterId,
          factId,
          knowledgeStatus: knowledge.knowledgeStatus,
          confidence: knowledge.confidence,
          learnedAtChapter: knowledge.learnedAtChapter,
        },
      });
      return jsonSuccess(c, knowledge);
    },
  );
}
