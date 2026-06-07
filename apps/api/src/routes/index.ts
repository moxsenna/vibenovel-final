import type { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { registerHealthRoutes } from "./health.js";
import { registerMeRoutes } from "./me.js";

export function registerRoutes(app: Hono<AppEnv>): void {
  registerHealthRoutes(app);
  registerMeRoutes(app);
}