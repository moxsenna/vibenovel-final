import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  getFoundationBundleForOwner,
  upsertFoundationForOwner,
} from "../services/foundation.js";
import {
  generateFoundationProposalsForOwner,
  listFoundationProposalsForOwner,
} from "../services/foundation-proposal.js";
import { lockFoundationForOwner } from "../services/foundation-lock.js";
import { getFoundationReadinessForOwner } from "../services/foundation-readiness.js";
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

  app.post("/api/projects/:id/foundation/proposals/generate", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await generateFoundationProposalsForOwner(
      c.env,
      ownerId,
      projectId,
      body as Record<string, unknown>,
    );
    return jsonSuccess(c, result, result.created ? 201 : 200);
  });

  app.get("/api/projects/:id/foundation/proposals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const proposals = await listFoundationProposalsForOwner(c.env, ownerId, projectId, {
      status: c.req.query("status"),
      includeResolved: c.req.query("includeResolved"),
    });
    return jsonSuccess(c, { proposals });
  });

  app.get("/api/projects/:id/foundation/readiness", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const readiness = await getFoundationReadinessForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, readiness);
  });

  app.post("/api/projects/:id/foundation/lock", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const result = await lockFoundationForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, result);
  });
}