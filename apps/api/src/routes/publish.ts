import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  generatePublishPackageForOwner,
  getPublishPackageByChapterForOwner,
  getPublishPackageDetailForOwner,
  listPublishPackagesForOwner,
} from "../services/publish-package.js";
import type { AppEnv } from "../types.js";

export function registerPublishRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/publish", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const chapterOutlineId = c.req.query("chapterOutlineId");
    const status = c.req.query("status");

    const packages = await listPublishPackagesForOwner(c.env, ownerId, projectId, {
      chapterOutlineId: chapterOutlineId || undefined,
      status: status || undefined,
    });

    return jsonSuccess(c, { packages });
  });

  app.get(
    "/api/projects/:id/publish/by-chapter/:chapterOutlineId",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const chapterOutlineId = c.req.param("chapterOutlineId");

      const publishPackage = await getPublishPackageByChapterForOwner(
        c.env,
        ownerId,
        projectId,
        chapterOutlineId,
      );

      return jsonSuccess(c, { publishPackage });
    },
  );

  app.post("/api/projects/:id/publish/generate", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await generatePublishPackageForOwner(c.env, ownerId, projectId, body);
    const status = result.created ? 201 : 200;
    return jsonSuccess(c, result, status);
  });

  app.get("/api/projects/:id/publish/:packageId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const packageId = c.req.param("packageId");

    const publishPackage = await getPublishPackageDetailForOwner(
      c.env,
      ownerId,
      projectId,
      packageId,
    );

    return jsonSuccess(c, { publishPackage });
  });
}