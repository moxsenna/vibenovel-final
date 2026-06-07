import type { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { registerHealthRoutes } from "./health.js";
import { registerMeRoutes } from "./me.js";
import { registerProjectRoutes } from "./projects.js";
import { registerProjectSettingsRoutes } from "./project-settings.js";

export function registerRoutes(app: Hono<AppEnv>): void {
  registerHealthRoutes(app);
  registerMeRoutes(app);
  registerProjectRoutes(app);
  registerProjectSettingsRoutes(app);
}