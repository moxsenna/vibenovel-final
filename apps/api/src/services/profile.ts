import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapProfileRow, type ProfileRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";

function resolveDisplayName(user: User): string {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.display_name === "string" && meta.display_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim());
  if (fromMeta) return fromMeta;

  const email = user.email?.trim();
  if (email) {
    const prefix = email.split("@")[0]?.trim();
    if (prefix) return prefix;
  }

  return "Writer";
}

/**
 * Ensures a profiles row exists for the authenticated Supabase user.
 * Uses service role with explicit user id filter — never trusts body user_id.
 */
export async function getOrCreateProfileForAuthUser(
  bindings: AppBindings,
  user: User,
): Promise<UserProfile> {
  const admin = createServiceRoleClient(bindings);
  const userId = user.id;

  const { data: existing, error: selectError } = await admin
    .from("profiles")
    .select(
      "id, display_name, email, default_language, plan_label, role, subscription_plan, created_at, updated_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    console.error("profiles select failed");
    throw AppError.internal("Failed to load profile");
  }

  if (existing) {
    return mapProfileRow(existing as ProfileRow);
  }

  const email = user.email?.trim() ?? "";
  const insertRow = {
    id: userId,
    email,
    display_name: resolveDisplayName(user),
    role: "writer" as const,
    subscription_plan: "free" as const,
  };

  const { data: created, error: insertError } = await admin
    .from("profiles")
    .insert(insertRow)
    .select(
      "id, display_name, email, default_language, plan_label, role, subscription_plan, created_at, updated_at",
    )
    .single();

  if (insertError || !created) {
    console.error("profiles insert failed");
    throw AppError.internal("Failed to create profile");
  }

  return mapProfileRow(created as ProfileRow);
}