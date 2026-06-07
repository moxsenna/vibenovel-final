import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  getFoundationBundleForOwner,
  upsertFoundationForOwner,
} from "../services/foundation.js";
import type { AppEnv } from "../types.js";

export function registerFoundationRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/foundation", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const bundle = await getFoundationBundleForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, bundle);
  });

  app.put("/api/projects/:id/foundation", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const foundation = await upsertFoundationForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, foundation);
  });
}