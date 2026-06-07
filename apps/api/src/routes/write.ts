import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  buildContextPacketForOwner,
  getContextPacketPreviewForOwner,
} from "../services/context-packet-builder.js";
import type { AppEnv } from "../types.js";

export function registerWriteRoutes(app: Hono<AppEnv>): void {
  app.post("/api/projects/:id/write/context-packet", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await buildContextPacketForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, result, 200);
  });

  app.get("/api/projects/:id/write/context-packet/:logId/preview", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const logId = c.req.param("logId");
    const preview = await getContextPacketPreviewForOwner(c.env, ownerId, projectId, logId);
    return jsonSuccess(c, { preview });
  });
}