import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  createDraftImportForOwner,
  extractDraftImportSignalsForOwner,
  getDraftImportForOwner,
} from "../services/draft-import.js";
import type { AppEnv } from "../types.js";

export function registerDraftImportRoutes(app: Hono<AppEnv>): void {
  app.post("/api/projects/:id/draft-imports", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await createDraftImportForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, result, 201);
  });

  app.get("/api/projects/:id/draft-imports/:draftImportId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const draftImportId = c.req.param("draftImportId");
    const result = await getDraftImportForOwner(c.env, ownerId, projectId, draftImportId);
    return jsonSuccess(c, result);
  });

  app.post(
    "/api/projects/:id/draft-imports/:draftImportId/extract-signals",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const draftImportId = c.req.param("draftImportId");
      const result = await extractDraftImportSignalsForOwner(
        c.env,
        ownerId,
        projectId,
        draftImportId,
      );
      return jsonSuccess(c, result);
    },
  );
}
