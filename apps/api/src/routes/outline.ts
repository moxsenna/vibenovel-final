import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  getChapterOutlineForOwner,
  listChapterOutlinesForOwner,
  updateChapterOutlineForOwner,
} from "../services/chapter-outline.js";
import {
  generateOutlineForOwner,
  getOutlineBundleForOwner,
} from "../services/outline.js";
import {
  cancelPlannedRevealForOwner,
  createOpenLoopForOwner,
  createPlannedRevealForOwner,
  dropOpenLoopForOwner,
  listOpenLoopsForOwner,
  listPlannedRevealsForOwner,
  updateOpenLoopForOwner,
  updatePlannedRevealForOwner,
} from "../services/outline-tracking.js";
import type { AppEnv } from "../types.js";

export function registerOutlineRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/outline/chapters", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const chapters = await listChapterOutlinesForOwner(c.env, ownerId, projectId, {
      status: c.req.query("status"),
      chapterNumber: c.req.query("chapterNumber"),
    });
    return jsonSuccess(c, { chapters });
  });

  app.get("/api/projects/:id/outline/chapters/:chapterId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const chapterId = c.req.param("chapterId");
    const chapter = await getChapterOutlineForOwner(c.env, ownerId, projectId, chapterId);
    return jsonSuccess(c, chapter);
  });

  app.patch("/api/projects/:id/outline/chapters/:chapterId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const chapterId = c.req.param("chapterId");
    const body = await c.req.json();
    const chapter = await updateChapterOutlineForOwner(
      c.env,
      ownerId,
      projectId,
      chapterId,
      body,
    );
    return jsonSuccess(c, chapter);
  });
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

  app.get("/api/projects/:id/outline/open-loops", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const openLoops = await listOpenLoopsForOwner(c.env, ownerId, projectId, {
      status: c.req.query("status"),
    });
    return jsonSuccess(c, { openLoops });
  });

  app.post("/api/projects/:id/outline/open-loops", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const openLoop = await createOpenLoopForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, openLoop, 201);
  });

  app.patch("/api/projects/:id/outline/open-loops/:loopId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const loopId = c.req.param("loopId");
    const body = await c.req.json();
    const openLoop = await updateOpenLoopForOwner(c.env, ownerId, projectId, loopId, body);
    return jsonSuccess(c, openLoop);
  });

  app.delete("/api/projects/:id/outline/open-loops/:loopId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const loopId = c.req.param("loopId");
    const openLoop = await dropOpenLoopForOwner(c.env, ownerId, projectId, loopId);
    return jsonSuccess(c, openLoop);
  });

  app.get("/api/projects/:id/outline/reveals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const result = await listPlannedRevealsForOwner(c.env, ownerId, projectId, {
      status: c.req.query("status"),
      riskLevel: c.req.query("riskLevel"),
    });
    return jsonSuccess(c, result);
  });

  app.post("/api/projects/:id/outline/reveals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const reveal = await createPlannedRevealForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, reveal, 201);
  });

  app.patch("/api/projects/:id/outline/reveals/:revealId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const revealId = c.req.param("revealId");
    const body = await c.req.json();
    const reveal = await updatePlannedRevealForOwner(c.env, ownerId, projectId, revealId, body);
    return jsonSuccess(c, reveal);
  });

  app.delete("/api/projects/:id/outline/reveals/:revealId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const revealId = c.req.param("revealId");
    const reveal = await cancelPlannedRevealForOwner(c.env, ownerId, projectId, revealId);
    return jsonSuccess(c, reveal);
  });
}