import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  generateOutlineForOwner,
  getOutlineBundleForOwner,
} from "../services/outline.js";
import type { AppEnv } from "../types.js";

export function registerOutlineRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/outline", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const bundle = await getOutlineBundleForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, bundle);
  });

  app.post("/api/projects/:id/outline/generate", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await generateOutlineForOwner(c.env, ownerId, projectId, body);
    const status = result.created ? 201 : 200;
    return jsonSuccess(c, result, status);
  });
}