import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import {
  createSpeechRuleForOwner,
  deactivateSpeechRuleForOwner,
  listSpeechRulesForOwner,
  updateSpeechRuleForOwner,
} from "../services/speech-rule.js";
import type { AppEnv } from "../types.js";

export function registerSpeechRuleRoutes(app: Hono<AppEnv>): void {
  app.get("/api/projects/:id/speech-rules", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const includeInactive = c.req.query("includeInactive") === "true";
    const rules = await listSpeechRulesForOwner(c.env, ownerId, projectId, includeInactive);
    return jsonSuccess(c, rules);
  });

  app.post("/api/projects/:id/speech-rules", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const rule = await createSpeechRuleForOwner(c.env, ownerId, projectId, body);
    return jsonSuccess(c, rule, 201);
  });

  app.patch("/api/projects/:id/speech-rules/:ruleId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const ruleId = c.req.param("ruleId");
    const body = await c.req.json();
    const rule = await updateSpeechRuleForOwner(c.env, ownerId, projectId, ruleId, body);
    return jsonSuccess(c, rule);
  });

  app.delete("/api/projects/:id/speech-rules/:ruleId", authMiddleware, async (c) => {
    const ownerId = c.get("userId");
    const projectId = c.req.param("id");
    const ruleId = c.req.param("ruleId");
    const rule = await deactivateSpeechRuleForOwner(c.env, ownerId, projectId, ruleId);
    return jsonSuccess(c, rule);
  });
}