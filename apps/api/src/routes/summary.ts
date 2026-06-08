import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  extractChapterDeltaForOwner,
  getChapterDeltaForOwner,
  getSummaryLinkedProposalsForOwner,
} from "../services/chapter-delta.js";
import { approveChapterSummaryForOwner } from "../services/chapter-summary-approval.js";
import {
  generateChapterSummaryForOwner,
  getSummaryByChapterForOwner,
  getSummaryDetailForOwner,
  listSummariesForOwner,
} from "../services/chapter-summary.js";
import {
  acceptLinkedProposalForOwner,
  rejectLinkedProposalForOwner,
} from "../services/summary-proposal-review.js";
import type { AppEnv } from "../types.js";

export function registerSummaryRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/summary", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const chapterOutlineId = c.req.query("chapterOutlineId");
    const status = c.req.query("status");

    const summaries = await listSummariesForOwner(c.env, ownerId, projectId, {
      chapterOutlineId: chapterOutlineId || undefined,
      status: status || undefined,
    });

    return jsonSuccess(c, { summaries });
  });

  app.get("/api/projects/:id/summary/by-chapter/:chapterOutlineId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const chapterOutlineId = c.req.param("chapterOutlineId");

    const detail = await getSummaryByChapterForOwner(
      c.env,
      ownerId,
      projectId,
      chapterOutlineId,
    );

    if (!detail) {
      return jsonSuccess(c, { summary: null, items: [] });
    }

    return jsonSuccess(c, detail);
  });

  app.post("/api/projects/:id/summary/generate", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const result = await generateChapterSummaryForOwner(c.env, ownerId, projectId, body);
    const status = result.created ? 201 : 200;
    return jsonSuccess(c, result, status);
  });

  app.get("/api/projects/:id/summary/:summaryId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const summaryId = c.req.param("summaryId");

    const detail = await getSummaryDetailForOwner(c.env, ownerId, projectId, summaryId);
    return jsonSuccess(c, detail);
  });

  app.post(
    "/api/projects/:id/summary/:summaryId/delta/extract",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const summaryId = c.req.param("summaryId");
      const body = await c.req.json().catch(() => ({}));
      const result = await extractChapterDeltaForOwner(
        c.env,
        ownerId,
        projectId,
        summaryId,
        body,
      );
      const status = result.created ? 201 : 200;
      return jsonSuccess(c, result, status);
    },
  );

  app.get("/api/projects/:id/summary/:summaryId/delta", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const summaryId = c.req.param("summaryId");
    const result = await getChapterDeltaForOwner(c.env, ownerId, projectId, summaryId);
    return jsonSuccess(c, result);
  });

  app.get("/api/projects/:id/summary/:summaryId/proposals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const summaryId = c.req.param("summaryId");
    const result = await getSummaryLinkedProposalsForOwner(
      c.env,
      ownerId,
      projectId,
      summaryId,
    );
    return jsonSuccess(c, result);
  });

  app.post("/api/projects/:id/summary/:summaryId/approve", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const summaryId = c.req.param("summaryId");
    const result = await approveChapterSummaryForOwner(
      c.env,
      ownerId,
      projectId,
      summaryId,
    );
    return jsonSuccess(c, result);
  });

  app.post(
    "/api/projects/:id/summary/:summaryId/proposals/:proposalId/accept",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const summaryId = c.req.param("summaryId");
      const proposalId = c.req.param("proposalId");
      const body = await c.req.json().catch(() => ({}));
      const result = await acceptLinkedProposalForOwner(
        c.env,
        ownerId,
        projectId,
        summaryId,
        proposalId,
        body,
      );
      return jsonSuccess(c, result);
    },
  );

  app.post(
    "/api/projects/:id/summary/:summaryId/proposals/:proposalId/reject",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const summaryId = c.req.param("summaryId");
      const proposalId = c.req.param("proposalId");
      const body = await c.req.json().catch(() => ({}));
      const result = await rejectLinkedProposalForOwner(
        c.env,
        ownerId,
        projectId,
        summaryId,
        proposalId,
        body,
      );
      return jsonSuccess(c, result);
    },
  );
}