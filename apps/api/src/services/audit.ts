import type { AuditAction, AuditEntityType } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { sanitizeAuditMetadata, sanitizeAuditSnapshot } from "./audit-snapshot.js";

export type { AuditAction, AuditEntityType };

export interface WriteAuditLogInput {
  userId?: string | null;
  projectId?: string | null;
  action: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
}

/** Append-only audit log — service role only; never log secrets or tokens. */
export async function writeAuditLog(
  bindings: AppBindings,
  input: WriteAuditLogInput,
): Promise<void> {
  const admin = createServiceRoleClient(bindings);
  const metadata = input.metadata ? sanitizeAuditMetadata(input.metadata) : null;
  const beforeData = input.beforeData ? sanitizeAuditSnapshot(input.beforeData) : null;
  const afterData = input.afterData ? sanitizeAuditSnapshot(input.afterData) : null;

  const { error } = await admin.from("audit_logs").insert({
    user_id: input.userId ?? null,
    project_id: input.projectId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata,
    before_data: beforeData,
    after_data: afterData,
  });

  if (error) {
    console.error("audit_logs insert failed");
    throw AppError.internal("Failed to write audit log");
  }
}