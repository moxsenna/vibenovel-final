import type { User } from "@supabase/supabase-js";
import { createMiddleware } from "hono/factory";
import { assertAuthBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createAnonClient } from "../lib/supabase.js";
import type { AppEnv } from "../types.js";

export type AuthVariables = {
  authToken: string;
  userId: string;
  email: string;
  authUser: User;
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

  try {
    assertAuthBindings(c.env);
  } catch {
    throw AppError.serviceUnavailable("Auth is not configured");
  }

  const supabase = createAnonClient(c.env);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw AppError.unauthorized("Invalid or expired access token");
  }

  c.set("authToken", token);
  c.set("userId", data.user.id);
  c.set("email", data.user.email ?? "");
  c.set("authUser", data.user);

  await next();
});