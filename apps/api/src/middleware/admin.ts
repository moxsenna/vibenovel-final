import { createMiddleware } from "hono/factory";
import { USER_ROLES } from "@vibenovel/shared";
import { AppError } from "../errors.js";
import { getOrCreateProfileForAuthUser } from "../services/profile.js";
import type { AppEnv } from "../types.js";

export type AdminMinRole = "admin" | "super_admin";

const ROLE_RANK: Record<string, number> = {
  [USER_ROLES.writer]: 0,
  [USER_ROLES.admin]: 1,
  [USER_ROLES.super_admin]: 2,
};

function roleSatisfies(actorRole: string | undefined, minRole: AdminMinRole): boolean {
  const actorRank = ROLE_RANK[actorRole ?? USER_ROLES.writer] ?? 0;
  const requiredRank = ROLE_RANK[minRole] ?? 1;
  return actorRank >= requiredRank;
}

export function requireAdmin(options: { minRole: AdminMinRole }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("authUser");
    const profile = await getOrCreateProfileForAuthUser(c.env, user);
    const role = profile.role ?? USER_ROLES.writer;

    if (!roleSatisfies(role, options.minRole)) {
      throw AppError.forbidden("Requires admin access");
    }

    c.set("adminRole", role);
    await next();
  });
}