import { createMiddleware } from "hono/factory";
import { AppError } from "../errors.js";
import type { AppEnv } from "../types.js";

export type AuthVariables = {
  authToken: string;
  /** Placeholder until Task 2.6 JWT validation + profile sync */
  userId: string | null;
};

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing or invalid Authorization header");
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw AppError.unauthorized("Bearer token is empty");
  }

  // Task 2.6: validate JWT via Supabase auth.getUser(token)
  c.set("authToken", token);
  c.set("userId", null);

  await next();
});