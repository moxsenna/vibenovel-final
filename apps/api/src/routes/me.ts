import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import type { AppEnv } from "../types.js";

export function registerMeRoutes(app: Hono<AppEnv>): void {
  app.get("/api/me", authMiddleware, (c) => {
    return jsonSuccess(c, {
      authenticated: true,
      userId: c.get("userId"),
      profile: null,
      note: "Auth shell only — profile fetch deferred to Task 2.6",
    });
  });
}