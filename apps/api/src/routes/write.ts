import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  generateBeatsForSessionForOwner,
  listBeatsForSessionForOwner,
  patchChapterBeatForOwner,
} from "../services/chapter-beat.js";
import {
  buildContextPacketForOwner,
  getContextPacketPreviewForOwner,
} from "../services/context-packet-builder.js";
import {
  getProseVersionForOwner,
  listProseVersionsForBeatForOwner,
  makeProseVersionCurrentForOwner,
  saveProseDraftForOwner,
} from "../services/prose-draft.js";
import {
  getWritingSessionDetailForOwner,
  markWritingSessionReadyForSummaryForOwner,
  patchWritingSessionForOwner,
  startOrResumeWritingSessionForOwner,
} from "../services/write-session.js";
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

  app.post("/api/projects/:id/write/sessions", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await startOrResumeWritingSessionForOwner(c.env, ownerId, projectId, body);
    const status = result.created ? 201 : 200;
    return jsonSuccess(c, { session: result.session, writingState: result.writingState }, status);
  });

  app.get("/api/projects/:id/write/sessions/:sessionId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const sessionId = c.req.param("sessionId");
    const detail = await getWritingSessionDetailForOwner(c.env, ownerId, projectId, sessionId);
    return jsonSuccess(c, detail);
  });

  app.patch("/api/projects/:id/write/sessions/:sessionId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const sessionId = c.req.param("sessionId");
    const body = await c.req.json().catch(() => ({}));
    const session = await patchWritingSessionForOwner(c.env, ownerId, projectId, sessionId, body);
    return jsonSuccess(c, { session });
  });

  app.post(
    "/api/projects/:id/write/sessions/:sessionId/ready-for-summary",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const sessionId = c.req.param("sessionId");
      const result = await markWritingSessionReadyForSummaryForOwner(
        c.env,
        ownerId,
        projectId,
        sessionId,
      );
      return jsonSuccess(c, result);
    },
  );

  app.get("/api/projects/:id/write/sessions/:sessionId/beats", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const sessionId = c.req.param("sessionId");
    const beats = await listBeatsForSessionForOwner(c.env, ownerId, projectId, sessionId);
    return jsonSuccess(c, { beats });
  });

  app.post(
    "/api/projects/:id/write/sessions/:sessionId/beats/generate",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const sessionId = c.req.param("sessionId");
      const body = await c.req.json().catch(() => ({}));
      const result = await generateBeatsForSessionForOwner(
        c.env,
        ownerId,
        projectId,
        sessionId,
        body,
      );
      const status = result.created ? 201 : 200;
      return jsonSuccess(c, result, status);
    },
  );

  app.patch("/api/projects/:id/write/beats/:beatId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const beatId = c.req.param("beatId");
    const body = await c.req.json().catch(() => ({}));
    const beat = await patchChapterBeatForOwner(c.env, ownerId, projectId, beatId, body);
    return jsonSuccess(c, { beat });
  });

  app.get("/api/projects/:id/write/beats/:beatId/prose", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const beatId = c.req.param("beatId");
    const result = await listProseVersionsForBeatForOwner(c.env, ownerId, projectId, beatId);
    return jsonSuccess(c, result);
  });

  app.post("/api/projects/:id/write/beats/:beatId/prose", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const beatId = c.req.param("beatId");
    const body = await c.req.json().catch(() => ({}));
    const result = await saveProseDraftForOwner(c.env, ownerId, projectId, beatId, body);
    return jsonSuccess(c, result, 201);
  });

  app.get("/api/projects/:id/write/prose/:versionId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const versionId = c.req.param("versionId");
    const version = await getProseVersionForOwner(c.env, ownerId, projectId, versionId);
    return jsonSuccess(c, { version });
  });

  app.post(
    "/api/projects/:id/write/prose/:versionId/make-current",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const versionId = c.req.param("versionId");
      const result = await makeProseVersionCurrentForOwner(
        c.env,
        ownerId,
        projectId,
        versionId,
      );
      return jsonSuccess(c, result);
    },
  );
}