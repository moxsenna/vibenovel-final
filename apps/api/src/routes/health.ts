import type { Context, Hono } from "hono";
import { getEnvPresenceFlags } from "../env.js";
import { jsonSuccess } from "../response.js";
import type { AppEnv } from "../types.js";

const API_VERSION = "0.1.0";

function healthHandler(c: Context<AppEnv>) {
  return jsonSuccess(c, {
    service: "vibenovel-api",
    version: API_VERSION,
    env: getEnvPresenceFlags(c.env),
  });
}

export function registerHealthRoutes(app: Hono<AppEnv>): void {
  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
}