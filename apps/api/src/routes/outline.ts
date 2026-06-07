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
}