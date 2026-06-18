import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import { getOrCreateProfileForAuthUser } from "../services/profile.js";
import {
  archiveProjectForOwner,
  createProjectForOwner,
  getProjectForOwner,
  listProjectsForOwner,
  listProjectsPageForOwner,
  parseListProjectsQueryOptions,
  updateProjectForOwner,
} from "../services/project.js";
import type { AppEnv } from "../types.js";

export function registerProjectRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const pageOpts = parseListProjectsQueryOptions({
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
      cursor: c.req.query("cursor"),
      q: c.req.query("q"),
      status: c.req.query("status"),
      sort: c.req.query("sort"),
      order: c.req.query("order"),
      includeArchived: c.req.query("includeArchived"),
    });
    if (pageOpts) {
      const cursorRaw = c.req.query("cursor")?.trim();
      if (cursorRaw) {
        const cursorOffset = Number.parseInt(cursorRaw, 10);
        if (Number.isFinite(cursorOffset) && cursorOffset >= 0) {
          pageOpts.offset = cursorOffset;
        }
      }
      const page = await listProjectsPageForOwner(c.env, ownerId, pageOpts);
      return jsonSuccess(c, page);
    }
    const includeArchived = c.req.query("includeArchived") === "true";
    const projects = await listProjectsForOwner(c.env, ownerId, includeArchived);
    return jsonSuccess(c, projects);
  });

  app.post("/api/projects", authMiddleware, async (c) => {
    const user = c.get("authUser");
    await getOrCreateProfileForAuthUser(c.env, user);
    const body = await c.req.json();
    const project = await createProjectForOwner(c.env, user.id, body);
    return jsonSuccess(c, project, 201);
  });

  app.get("/api/projects/:id", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const project = await getProjectForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, project);
  });

  app.patch("/api/projects/:id", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const project = await updateProjectForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, project);
  });

  app.delete("/api/projects/:id", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const project = await archiveProjectForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, project);
  });
}