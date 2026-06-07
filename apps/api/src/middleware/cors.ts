import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import { getAllowedOrigins } from "../env.js";
import type { AppEnv } from "../types.js";

export const corsMiddleware: MiddlewareHandler<AppEnv> = cors({
  origin: (origin, c) => {
    const allowed = getAllowedOrigins(c.env);
    if (!origin) return allowed[0] ?? "";
    return allowed.includes(origin) ? origin : "";
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 86400,
  credentials: true,
});