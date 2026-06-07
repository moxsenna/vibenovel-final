import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  getProjectSettingsForOwner,
  upsertProjectSettingsForOwner,
} from "../services/project-settings.js";
import type { AppEnv } from "../types.js";

export function registerProjectSettingsRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/settings", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const settings = await getProjectSettingsForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, settings);
  });

  app.put("/api/projects/:id/settings", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const settings = await upsertProjectSettingsForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, settings);
  });
}