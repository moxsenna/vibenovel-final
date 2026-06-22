import type { Hono } from "hono";
import type { UserProfile } from "@vibenovel/shared";
import { AppError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { mapProfileRow, type ProfileRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { jsonSuccess } from "../response.js";
import {
  getAdminGenerationAttemptDetail,
  getAdminOverview,
  getAdminProjectDetail,
  getAdminProposalDetail,
  getAdminSystemHealth,
  getAdminUserCreditSection,
  listAdminAuditLogs,
  listAdminGenerationAttempts,
  listAdminProjects,
  listAdminProposals,
} from "../services/admin-ops.js";

import type { AppEnv } from "../types.js";

const PROFILE_SELECT =
  "id, display_name, email, default_language, plan_label, role, subscription_plan, created_at, updated_at";

export interface AdminUsersListResponse {
  users: UserProfile[];
}

export interface AdminUserDetailResponse {
  user: UserProfile;
}

export interface AdminGrantCreditsBody {
  amount: number;
  reason: string;
  note?: string;
  idempotencyKey: string;
}

export function registerAdminRoutes(app: Hono<AppEnv>): void {
  const admin = app.basePath("/api/admin");

  admin.use("*", authMiddleware, requireAdmin({ minRole: "admin" }));

  admin.get("/overview", async (c) => {
    const body = await getAdminOverview(c.env);
    return jsonSuccess(c, body);
  });

  admin.get("/projects", async (c) => {
    const limit = c.req.query("limit");
    const body = await listAdminProjects(c.env, limit);
    return jsonSuccess(c, body);
  });

  admin.get("/projects/:projectId", async (c) => {
    const body = await getAdminProjectDetail(c.env, c.req.param("projectId"));
    return jsonSuccess(c, body);
  });

  admin.get("/proposals", async (c) => {
    const body = await listAdminProposals(c.env, {
      status: c.req.query("status"),
      limit: c.req.query("limit"),
    });
    return jsonSuccess(c, body);
  });

  admin.get("/proposals/:proposalId", async (c) => {
    const body = await getAdminProposalDetail(c.env, c.req.param("proposalId"));
    return jsonSuccess(c, body);
  });

  admin.get("/generation-attempts", async (c) => {
    const body = await listAdminGenerationAttempts(c.env, {
      status: c.req.query("status"),
      limit: c.req.query("limit"),
    });
    return jsonSuccess(c, body);
  });

  admin.get("/generation-attempts/:attemptId", async (c) => {
    const body = await getAdminGenerationAttemptDetail(c.env, c.req.param("attemptId"));
    return jsonSuccess(c, body);
  });

  admin.get("/users/:userId/credits", async (c) => {
    const body = await getAdminUserCreditSection(c.env, c.req.param("userId"));
    return jsonSuccess(c, body);
  });

  admin.get("/system/health", async (c) => {
    const body = await getAdminSystemHealth(c.env);
    return jsonSuccess(c, body);
  });

  admin.get("/audit-logs", async (c) => {
    const body = await listAdminAuditLogs(c.env, c.req.query("limit"));
    return jsonSuccess(c, body);
  });

  admin.get("/users", async (c) => {
    const client = createServiceRoleClient(c.env);
    const { data, error } = await client
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("admin profiles list failed");
      throw AppError.internal("Failed to load users");
    }

    const users = (data ?? []).map((row) => mapProfileRow(row as ProfileRow));
    const body: AdminUsersListResponse = { users };
    return jsonSuccess(c, body);
  });

  admin.get("/users/:userId", async (c) => {
    const userId = c.req.param("userId");
    const client = createServiceRoleClient(c.env);
    const { data, error } = await client
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("admin profile detail failed");
      throw AppError.internal("Failed to load user");
    }

    if (!data) {
      throw AppError.notFound("User not found");
    }

    const body: AdminUserDetailResponse = {
      user: mapProfileRow(data as ProfileRow),
    };
    return jsonSuccess(c, body);
  });

  admin.post("/users/:userId/credits/grant", async (c) => {
    const _userId = c.req.param("userId");
    const _body = (await c.req.json().catch(() => ({}))) as Partial<AdminGrantCreditsBody>;
    void _userId;
    void _body;
    throw AppError.notImplemented("Grant credit mutation is being implemented by Codex");
  });
}