import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  generateConceptsForOwner,
  getConceptForOwner,
  listConceptsForOwner,
  selectConceptForOwner,
  updateConceptForOwner,
} from "../services/concept.js";
import type { AppEnv } from "../types.js";

export function registerConceptRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/concepts", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const concepts = await listConceptsForOwner(c.env, ownerId, projectId, {
      status: c.req.query("status"),
      includeRejected: c.req.query("includeRejected"),
    });
    return jsonSuccess(c, { concepts });
  });

  app.post("/api/projects/:id/concepts/generate", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await generateConceptsForOwner(
      c.env,
      ownerId,
      projectId,
      body as Record<string, unknown>,
    );
    return jsonSuccess(c, result, result.created ? 201 : 200);
  });

  app.get("/api/projects/:id/concepts/:conceptId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const conceptId = c.req.param("conceptId");
    const concept = await getConceptForOwner(c.env, ownerId, projectId, conceptId);
    return jsonSuccess(c, { concept });
  });

  app.patch("/api/projects/:id/concepts/:conceptId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const conceptId = c.req.param("conceptId");
    const body = await c.req.json();
    const concept = await updateConceptForOwner(
      c.env,
      ownerId,
      projectId,
      conceptId,
      body as Record<string, unknown>,
    );
    return jsonSuccess(c, { concept });
  });

  app.post("/api/projects/:id/concepts/:conceptId/select", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const conceptId = c.req.param("conceptId");
    const result = await selectConceptForOwner(c.env, ownerId, projectId, conceptId);
    return jsonSuccess(c, result);
  });
}