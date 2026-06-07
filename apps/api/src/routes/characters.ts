import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  archiveCharacterForOwner,
  createCharacterForOwner,
  listCharactersForOwner,
  updateCharacterForOwner,
} from "../services/character.js";
import type { AppEnv } from "../types.js";

export function registerCharacterRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/characters", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const includeArchived = c.req.query("includeArchived") === "true";
    const characters = await listCharactersForOwner(
      c.env,
      ownerId,
      projectId,
      includeArchived,
    );
    return jsonSuccess(c, characters);
  });

  app.post("/api/projects/:id/characters", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const character = await createCharacterForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, character, 201);
  });

  app.patch("/api/projects/:id/characters/:characterId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const characterId = c.req.param("characterId");
    const body = await c.req.json();
    const character = await updateCharacterForOwner(
      c.env,
      ownerId,
      projectId,
      characterId,
      body,
    );
    return jsonSuccess(c, character);
  });

  app.delete("/api/projects/:id/characters/:characterId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const characterId = c.req.param("characterId");
    const character = await archiveCharacterForOwner(
      c.env,
      ownerId,
      projectId,
      characterId,
    );
    return jsonSuccess(c, character);
  });
}