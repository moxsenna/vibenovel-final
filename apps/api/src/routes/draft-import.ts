import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  createDraftImportForOwner,
  extractDraftImportSignalsForOwner,
  getDraftImportForOwner,
  materializeDraftImportProposalsForOwner,
} from "../services/draft-import.js";
import {
  getLatestDraftImportJobForOwner,
} from "../services/import/job-progress.js";
import { runDraftImportPrepForOwner } from "../services/import/pipeline-runner.js";
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

  app.post(
    "/api/projects/:id/draft-imports/:draftImportId/materialize-proposals",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const draftImportId = c.req.param("draftImportId");
      const result = await materializeDraftImportProposalsForOwner(
        c.env,
        ownerId,
        projectId,
        draftImportId,
      );
      return jsonSuccess(c, result);
    },
  );

  app.get(
    "/api/projects/:id/draft-imports/:draftImportId/import-jobs/latest",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const draftImportId = c.req.param("draftImportId");
      const result = await getLatestDraftImportJobForOwner(
        c.env,
        ownerId,
        projectId,
        draftImportId,
      );
      return jsonSuccess(c, result);
    },
  );

  app.post(
    "/api/projects/:id/draft-imports/:draftImportId/import-jobs/resume",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const draftImportId = c.req.param("draftImportId");
      const result = await runDraftImportPrepForOwner(
        c.env,
        ownerId,
        projectId,
        draftImportId,
      );
      return jsonSuccess(c, result);
    },
  );
}
