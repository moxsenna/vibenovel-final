import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  appendUserMessageForOwner,
  createOrResetIntakeForOwner,
  extractDetectedSignalsForOwner,
  getIntakeBundleForOwner,
  listDetectedSignalsForOwner,
  listIntakeMessagesForOwner,
  updateDetectedSignalStatusForOwner,
} from "../services/intake.js";
import type { AppEnv } from "../types.js";

export function registerIntakeRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/intake", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const bundle = await getIntakeBundleForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, bundle);
  });

  app.post("/api/projects/:id/intake", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const session = await createOrResetIntakeForOwner(
      c.env,
      ownerId,
      projectId,
      body as Record<string, unknown>,
    );
    return jsonSuccess(c, { session }, 201);
  });

  app.get("/api/projects/:id/intake/messages", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const limit = c.req.query("limit");
    const result = await listIntakeMessagesForOwner(c.env, ownerId, projectId, limit);
    return jsonSuccess(c, result);
  });

  app.post("/api/projects/:id/intake/messages", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const result = await appendUserMessageForOwner(
      c.env,
      ownerId,
      projectId,
      body as Record<string, unknown>,
    );
    return jsonSuccess(c, result, 201);
  });

  app.get("/api/projects/:id/intake/signals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const status = c.req.query("status");
    const result = await listDetectedSignalsForOwner(c.env, ownerId, projectId, status);
    return jsonSuccess(c, result);
  });

  app.post("/api/projects/:id/intake/extract-signals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const result = await extractDetectedSignalsForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, result);
  });

  app.patch("/api/projects/:id/intake/signals/:signalId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const signalId = c.req.param("signalId");
    const body = await c.req.json();
    const signal = await updateDetectedSignalStatusForOwner(
      c.env,
      ownerId,
      projectId,
      signalId,
      body as Record<string, unknown>,
    );
    return jsonSuccess(c, { signal });
  });
}