import type { JsonObject } from "@vibenovel/shared";

const PUBLISH_COPY_SUGGESTION_KEYS = new Set([
  "teaser",
  "caption",
  "readerQuestion",
  "shortSynopsis",
  "nextChapterTeaser",
]);

const FORBIDDEN_METADATA_KEYS = new Set([
  "token",
  "service_role",
  "serviceRole",
  "api_key",
  "apiKey",
  "MAYAR_API_KEY",
  "mayar_api_key",
  "DUITKU_MERCHANT_CODE",
  "DUITKU_MERCHANT_KEY",
  "duitku_merchant_code",
  "duitku_merchant_key",
  "authorization",
  "Authorization",
  "provider_payload_safe",
  "providerPayloadSafe",
  "payload_safe_json",
  "payloadSafeJson",
  "raw_payload",
  "rawPayload",
  "webhook_body",
  "webhookBody",
  "raw_body",
  "rawBody",
  "customerEmail",
  "customerMobile",
  "customerName",
  "merchantEmail",
  "full_prompt",
  "fullPrompt",
  "packet_json",
  "packetJson",
  "planningTruth",
  "planning_truth",
  "prose_text",
  "proseText",
  "content_text",
  "contentText",
  "delta_json",
  "deltaJson",
  "payload",
  "caption",
  "teaser",
  "short_synopsis",
  "shortSynopsis",
]);

const METADATA_MAX_BYTES = 4096;
const SNAPSHOT_MAX_BYTES = 2048;

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export function truncateAuditText(value: string, max = 120): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}

export function compactChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

function stripForbiddenKeys(
  value: unknown,
  depth = 0,
  parentKey?: string,
): unknown {
  if (depth > 6) return "[depth_truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const maxLen = parentKey === "suggestions" ? 1500 : 500;
    return truncateAuditText(value, maxLen);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => stripForbiddenKeys(item, depth + 1, parentKey));
  }
  if (typeof value === "object") {
    const out: JsonObject = {};
    const allowPublishSuggestions = parentKey === "suggestions";
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (allowPublishSuggestions) {
        if (!PUBLISH_COPY_SUGGESTION_KEYS.has(key)) continue;
      } else if (FORBIDDEN_METADATA_KEYS.has(key)) {
        continue;
      }
      out[key] = stripForbiddenKeys(child, depth + 1, key) as JsonObject[keyof JsonObject];
    }
    return out;
  }
  return value;
}

function enforceSizeCap(value: JsonObject, maxBytes: number): JsonObject {
  let serialized = JSON.stringify(value);
  if (serialized.length <= maxBytes) return value;

  const capped: JsonObject = { ...value, _truncated: true };
  delete capped.before_data;
  delete capped.after_data;
  serialized = JSON.stringify(capped);
  if (serialized.length <= maxBytes) return capped;

  return {
    _truncated: true,
    correlationId: value.correlationId,
    task: value.task,
  };
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown>): JsonObject {
  const cleaned = stripForbiddenKeys(metadata) as JsonObject;
  return enforceSizeCap(cleaned, METADATA_MAX_BYTES);
}

export function sanitizeAuditSnapshot(snapshot: Record<string, unknown>): JsonObject {
  const cleaned = stripForbiddenKeys(snapshot) as JsonObject;
  return enforceSizeCap(cleaned, SNAPSHOT_MAX_BYTES);
}

export function snapshotFoundationLock(
  before: { isLocked?: boolean; status?: string; readinessPercent?: number | null } | null,
  after: { isLocked: boolean; status: string; readinessPercent: number | null },
): { beforeData: JsonObject; afterData: JsonObject } {
  return {
    beforeData: sanitizeAuditSnapshot({
      isLocked: before?.isLocked ?? false,
      status: before?.status ?? null,
      readinessPercent: before?.readinessPercent ?? null,
    }),
    afterData: sanitizeAuditSnapshot({
      isLocked: after.isLocked,
      status: after.status,
      readinessPercent: after.readinessPercent,
    }),
  };
}

export function snapshotChapterDelta(delta: {
  id: string;
  status: string;
  extractor_version: string | null;
  chapter_summary_id: string;
}): JsonObject {
  return sanitizeAuditSnapshot({
    deltaId: delta.id,
    status: delta.status,
    extractorVersion: delta.extractor_version,
    chapterSummaryId: delta.chapter_summary_id,
  });
}

export function snapshotCanonPromotion(promoted: {
  entityType: string;
  entityId: string;
  created: boolean;
}): JsonObject {
  return sanitizeAuditSnapshot({
    promotedEntityType: promoted.entityType,
    promotedEntityId: promoted.entityId,
    created: promoted.created,
  });
}

export function snapshotPublishPackageStatus(row: {
  id: string;
  status: string;
  chapter_number: number;
  package_version: number;
  is_current: boolean;
}): JsonObject {
  return sanitizeAuditSnapshot({
    packageId: row.id,
    status: row.status,
    chapterNumber: row.chapter_number,
    packageVersion: row.package_version,
    isCurrent: row.is_current,
  });
}

export function snapshotChapterSummaryApproval(summary: {
  id: string;
  status: string;
  chapter_number: number;
  summary_version: number;
}): JsonObject {
  return sanitizeAuditSnapshot({
    summaryId: summary.id,
    status: summary.status,
    chapterNumber: summary.chapter_number,
    summaryVersion: summary.summary_version,
  });
}