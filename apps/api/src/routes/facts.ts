import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  createFactForOwner,
  deprecateFactForOwner,
  listFactsForOwner,
  updateFactForOwner,
} from "../services/fact.js";
import type { AppEnv } from "../types.js";

export function registerFactRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/facts", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const includeDeprecated = c.req.query("includeDeprecated") === "true";
    const facts = await listFactsForOwner(c.env, ownerId, projectId, includeDeprecated);
    return jsonSuccess(c, facts);
  });

  app.post("/api/projects/:id/facts", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const fact = await createFactForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, fact, 201);
  });

  app.patch("/api/projects/:id/facts/:factId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const factId = c.req.param("factId");
    const body = await c.req.json();
    const fact = await updateFactForOwner(c.env, ownerId, projectId, factId, body);
    return jsonSuccess(c, fact);
  });

  app.delete("/api/projects/:id/facts/:factId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const factId = c.req.param("factId");
    const fact = await deprecateFactForOwner(c.env, ownerId, projectId, factId);
    return jsonSuccess(c, fact);
  });
}