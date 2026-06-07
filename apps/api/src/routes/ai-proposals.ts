import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  acceptProposalForOwner,
  createProposalForOwner,
  getProposalForOwner,
  listProposalsForOwner,
  mergeProposalForOwner,
  rejectProposalForOwner,
  updateProposalForOwner,
} from "../services/ai-proposal.js";
import type { AppEnv } from "../types.js";

export function registerAiProposalRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/proposals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const proposals = await listProposalsForOwner(c.env, ownerId, projectId, {
      status: c.req.query("status"),
      type: c.req.query("type"),
      riskLevel: c.req.query("riskLevel"),
      includeResolved: c.req.query("includeResolved") === "true",
    });
    return jsonSuccess(c, proposals);
  });

  app.post("/api/projects/:id/proposals", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const proposal = await createProposalForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, proposal, 201);
  });

  app.get("/api/projects/:id/proposals/:proposalId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const proposalId = c.req.param("proposalId");
    const proposal = await getProposalForOwner(c.env, ownerId, projectId, proposalId);
    return jsonSuccess(c, proposal);
  });

  app.patch("/api/projects/:id/proposals/:proposalId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const proposalId = c.req.param("proposalId");
    const body = await c.req.json();
    const proposal = await updateProposalForOwner(c.env, ownerId, projectId, proposalId, body);
    return jsonSuccess(c, proposal);
  });

  app.post(
    "/api/projects/:id/proposals/:proposalId/accept",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const proposalId = c.req.param("proposalId");
      const proposal = await acceptProposalForOwner(c.env, ownerId, projectId, proposalId);
      return jsonSuccess(c, proposal);
    },
  );

  app.post(
    "/api/projects/:id/proposals/:proposalId/reject",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const proposalId = c.req.param("proposalId");
      let body: unknown = undefined;
      try {
        body = await c.req.json();
      } catch {
        body = undefined;
      }
      const proposal = await rejectProposalForOwner(
        c.env,
        ownerId,
        projectId,
        proposalId,
        body,
      );
      return jsonSuccess(c, proposal);
    },
  );

  app.post(
    "/api/projects/:id/proposals/:proposalId/merge",
    authMiddleware,
    async (c) => {
      const ownerId = c.get("userId");
      const projectId = c.req.param("id");
      const proposalId = c.req.param("proposalId");
      let body: unknown = undefined;
      try {
        body = await c.req.json();
      } catch {
        body = undefined;
      }
      const proposal = await mergeProposalForOwner(
        c.env,
        ownerId,
        projectId,
        proposalId,
        body,
      );
      return jsonSuccess(c, proposal);
    },
  );
}