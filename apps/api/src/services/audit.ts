import type { AppBindings } from "../env.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";

export type AuditAction =
  | "project_created"
  | "project_updated"
  | "settings_updated"
  | "foundation_created"
  | "foundation_updated"
  | "foundation_locked"
  | "character_created"
  | "character_updated"
  | "fact_created"
  | "fact_updated"
  | "fact_deprecated"
  | "speech_rule_created"
  | "speech_rule_updated"
  | "ai_proposal_created"
  | "ai_proposal_accepted"
  | "ai_proposal_rejected"
  | "ai_proposal_merged"
  | "credit_balance_seeded";

export type AuditEntityType =
  | "profile"
  | "project"
  | "project_settings"
  | "story_foundation"
  | "character"
  | "fact"
  | "relationship_speech_rule"
  | "ai_proposal"
  | "credit_balance";

export interface WriteAuditLogInput {
  userId: string;
  projectId?: string | null;
  action: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/** Append-only audit log — service role only; never log secrets or tokens. */
export async function writeAuditLog(
  bindings: AppBindings,
  input: WriteAuditLogInput,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const { error } = await admin.from("audit_logs").insert({
    user_id: input.userId,
    project_id: input.projectId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    console.error("audit_logs insert failed");
    throw AppError.internal("Failed to write audit log");
  }
}