import type { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "../services/project.js";

/**
 * Continuity API routes — character state & knowledge management (advanced creator mode).
 * GET/PUT character state and knowledge for advanced manual editing.
 */
export function registerContinuityRoutes(app: Hono<AppEnv>): void {

  /* ---- Character State --------------------------------------------------- */

  app.get("/api/projects/:id/continuity/characters/:characterId/state", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const characterId = c.req.param("characterId");

    await getOwnedProjectRow(c.env, ownerId, projectId);

    // Stub — requires character_states table integration
    return jsonSuccess(c, { characterId, state: null });
  });

  app.put("/api/projects/:id/continuity/characters/:characterId/state", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const characterId = c.req.param("characterId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

    if (body.confirmation !== "UPDATE_CONTINUITY_STATE") {
      throw AppError.badRequest("Must send confirmation: UPDATE_CONTINUITY_STATE");
    }

    await getOwnedProjectRow(c.env, ownerId, projectId);

    // Stub — requires character_states table upsert integration
    return jsonSuccess(c, { characterId, updated: true });
  });

  /* ---- Character Knowledge ---------------------------------------------- */

  app.get("/api/projects/:id/continuity/characters/:characterId/knowledge", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const characterId = c.req.param("characterId");

    await getOwnedProjectRow(c.env, ownerId, projectId);

    // Stub — requires character_knowledge table integration
    return jsonSuccess(c, { characterId, knowledge: [] });
  });

  app.put("/api/projects/:id/continuity/characters/:characterId/knowledge/:factId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const characterId = c.req.param("characterId");
    const factId = c.req.param("factId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;

    await getOwnedProjectRow(c.env, ownerId, projectId);

    // Stub — requires character_knowledge table upsert integration
    return jsonSuccess(c, { characterId, factId, knowledgeStatus: body.knowledgeStatus ?? null });
  });
}
