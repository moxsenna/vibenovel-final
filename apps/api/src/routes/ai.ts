import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import { generateProseBeatForOwner } from "../services/prose-beat-generation.js";
import { rewriteProseForOwner } from "../services/prose-rewrite-generation.js";
import type { AppEnv } from "../types.js";

export function registerAiRoutes(app: Hono<AppEnv>): void {
  app.post("/api/projects/:id/ai/generate-prose", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await generateProseBeatForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, result, result.idempotentReplay ? 200 : 201);
  });

  app.post("/api/projects/:id/ai/rewrite-prose", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await rewriteProseForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, result, result.idempotentReplay ? 200 : 201);
  });
}