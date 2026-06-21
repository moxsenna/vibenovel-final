import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@vibenovel/shared";
import type { Hono } from "hono";
import { AppError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import { writeAuditLog } from "../services/audit.js";
import {
  getStyleProfileForOwner,
  normalizeOperationalStyleRules,
  upsertStyleProfileForOwner,
  type UpsertStyleProfileInput,
} from "../services/style-profile.js";
import type { AppEnv } from "../types.js";

export function parseStyleProfileUpdate(raw: unknown): UpsertStyleProfileInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  if (body.confirmation !== "UPDATE_STYLE_PROFILE") {
    throw AppError.badRequest("Must send confirmation: UPDATE_STYLE_PROFILE");
  }
  if (!body.operationalRules || typeof body.operationalRules !== "object") {
    throw AppError.badRequest("operationalRules is required");
  }
  return {
    operationalRules: normalizeOperationalStyleRules(body.operationalRules),
    source: "manual_story_control",
  };
}

export function registerStoryControlRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/style-profile", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const profile = await getStyleProfileForOwner(c.env, ownerId, projectId);
    return jsonSuccess(c, { profile });
  });

  app.put("/api/projects/:id/style-profile", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const input = parseStyleProfileUpdate(await c.req.json().catch(() => null));
    const before = await getStyleProfileForOwner(c.env, ownerId, projectId);
    const profile = await upsertStyleProfileForOwner(c.env, ownerId, projectId, {
      ...input,
      metrics: before?.metrics,
      sourceProseVersionIds: before?.sourceProseVersionIds,
    });

    await writeAuditLog(c.env, {
      userId: ownerId,
      projectId,
      action: AUDIT_ACTIONS.style_profile_updated,
      entityType: AUDIT_ENTITY_TYPES.style_profile,
      entityId: profile.id,
      beforeData: before
        ? {
            version: before.version,
            source: before.source,
            operationalRules: before.operationalRules,
          }
        : undefined,
      afterData: {
        version: profile.version,
        source: profile.source,
        operationalRules: profile.operationalRules,
      },
    });

    return jsonSuccess(c, profile);
  });
}
