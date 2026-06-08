import {
  PUBLISH_CHECKLIST_ITEM_IDS,
  PUBLISH_PACKAGE_STATUSES,
  type PublishChecklistItem,
  type PublishPackage,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapPublishPackageRow, type PublishPackageRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import { assertPublishUserTextSafe } from "./publish-safety.js";

const PACKAGE_SELECT =
  "id, project_id, chapter_outline_id, chapter_summary_id, chapter_number, chapter_title, status, package_version, is_current, display_title, teaser, short_synopsis, caption, reader_question, next_chapter_teaser, tags, genre, mobile_preview_excerpt, checklist_json, safety_flags, generator_version, exported_at, metadata, created_at, updated_at";

const FIELD_LIMITS = {
  displayTitle: 120,
  teaser: 280,
  shortSynopsis: 700,
  caption: 1500,
  readerQuestion: 180,
  nextChapterTeaser: 240,
  mobilePreviewExcerpt: 500,
  genre: 80,
  tagItem: 40,
  tagsCount: 12,
  checklistLabel: 120,
  checklistNote: 280,
} as const;

const ALLOWED_CHECKLIST_IDS = new Set<string>(Object.values(PUBLISH_CHECKLIST_ITEM_IDS));

const CHECKLIST_LABELS: Record<string, string> = {
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_teaser]: "Teaser menggoda tanpa membuka rahasia besar",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_caption]: "Caption siap untuk sosial media",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_tags]: "Tag/genre sudah sesuai arah cerita",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_question]: "Pertanyaan pembaca sudah ada",
  [PUBLISH_CHECKLIST_ITEM_IDS.chk_preview]: "Preview terbaca nyaman di layar HP",
};

const FORBIDDEN_FIELD_BODY_KEYS = new Set([
  "generatorVersion",
  "status",
  "packageVersion",
  "isCurrent",
  "exportedAt",
  "projectId",
  "chapterSummaryId",
  "chapterOutlineId",
  "chapterNumber",
  "chapterTitle",
  "safetyFlags",
  "metadata",
  "checklist",
  "id",
  "createdAt",
  "updatedAt",
]);

const EDITABLE_FIELD_KEYS = new Set([
  "displayTitle",
  "teaser",
  "shortSynopsis",
  "caption",
  "readerQuestion",
  "nextChapterTeaser",
  "tags",
  "genre",
  "mobilePreviewExcerpt",
]);

async function getOwnedPackageRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  packageId: string,
): Promise<PublishPackageRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("publish_packages")
    .select(PACKAGE_SELECT)
    .eq("id", packageId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("publish_packages select by id failed");
    throw AppError.internal("Failed to load publish package");
  }
  if (!data) {
    throw AppError.notFound("Publish package not found");
  }
  return data as PublishPackageRow;
}

function assertPackageEditable(row: PublishPackageRow): void {
  if (row.status === PUBLISH_PACKAGE_STATUSES.exported) {
    throw AppError.conflict("Exported publish packages cannot be edited", {
      missing: ["exported_package_locked"],
    });
  }
}

function assertMaxLength(value: string, max: number, field: string): void {
  if (value.length > max) {
    throw AppError.badRequest(`${field} exceeds maximum length of ${max}`);
  }
}

function parseChecklistJson(value: unknown): PublishChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PublishChecklistItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as PublishChecklistItem).id === "string",
  );
}

export async function updatePublishPackageFieldsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  packageId: string,
  raw: unknown,
): Promise<PublishPackage> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const row = await getOwnedPackageRow(bindings, ownerId, projectId, packageId);
  assertPackageEditable(row);

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_FIELD_BODY_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
    if (!EDITABLE_FIELD_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" is not editable`);
    }
  }

  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("At least one editable field is required");
  }

  const update: Record<string, unknown> = {};
  const merged = mapPublishPackageRow(row);

  if (body.displayTitle !== undefined) {
    if (typeof body.displayTitle !== "string") {
      throw AppError.badRequest("displayTitle must be a string");
    }
    const value = body.displayTitle.trim();
    if (!value) throw AppError.badRequest("displayTitle cannot be empty");
    assertMaxLength(value, FIELD_LIMITS.displayTitle, "displayTitle");
    assertPublishUserTextSafe(value, "displayTitle");
    update.display_title = value;
    merged.displayTitle = value;
  }

  if (body.teaser !== undefined) {
    if (typeof body.teaser !== "string") {
      throw AppError.badRequest("teaser must be a string");
    }
    const value = body.teaser.trim();
    if (!value) throw AppError.badRequest("teaser cannot be empty");
    assertMaxLength(value, FIELD_LIMITS.teaser, "teaser");
    assertPublishUserTextSafe(value, "teaser");
    update.teaser = value;
    merged.teaser = value;
  }

  if (body.shortSynopsis !== undefined) {
    if (typeof body.shortSynopsis !== "string") {
      throw AppError.badRequest("shortSynopsis must be a string");
    }
    const value = body.shortSynopsis.trim();
    if (!value) throw AppError.badRequest("shortSynopsis cannot be empty");
    assertMaxLength(value, FIELD_LIMITS.shortSynopsis, "shortSynopsis");
    assertPublishUserTextSafe(value, "shortSynopsis");
    update.short_synopsis = value;
    merged.shortSynopsis = value;
  }

  if (body.caption !== undefined) {
    if (typeof body.caption !== "string") {
      throw AppError.badRequest("caption must be a string");
    }
    const value = body.caption.trim();
    if (!value) throw AppError.badRequest("caption cannot be empty");
    assertMaxLength(value, FIELD_LIMITS.caption, "caption");
    assertPublishUserTextSafe(value, "caption");
    update.caption = value;
    merged.caption = value;
  }

  if (body.readerQuestion !== undefined) {
    if (typeof body.readerQuestion !== "string") {
      throw AppError.badRequest("readerQuestion must be a string");
    }
    const value = body.readerQuestion.trim();
    if (!value) throw AppError.badRequest("readerQuestion cannot be empty");
    assertMaxLength(value, FIELD_LIMITS.readerQuestion, "readerQuestion");
    assertPublishUserTextSafe(value, "readerQuestion");
    update.reader_question = value;
    merged.readerQuestion = value;
  }

  if (body.nextChapterTeaser !== undefined) {
    if (body.nextChapterTeaser === null) {
      update.next_chapter_teaser = null;
      merged.nextChapterTeaser = null;
    } else if (typeof body.nextChapterTeaser === "string") {
      const value = body.nextChapterTeaser.trim();
      assertMaxLength(value, FIELD_LIMITS.nextChapterTeaser, "nextChapterTeaser");
      if (value) assertPublishUserTextSafe(value, "nextChapterTeaser");
      update.next_chapter_teaser = value || null;
      merged.nextChapterTeaser = value || null;
    } else {
      throw AppError.badRequest("nextChapterTeaser must be a string or null");
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      throw AppError.badRequest("tags must be an array of strings");
    }
    if (body.tags.length > FIELD_LIMITS.tagsCount) {
      throw AppError.badRequest(`tags cannot exceed ${FIELD_LIMITS.tagsCount} items`);
    }
    const tags: string[] = [];
    for (const tag of body.tags) {
      if (typeof tag !== "string") throw AppError.badRequest("each tag must be a string");
      const value = tag.trim();
      if (!value) throw AppError.badRequest("tags cannot contain empty strings");
      assertMaxLength(value, FIELD_LIMITS.tagItem, "tag");
      assertPublishUserTextSafe(value, "tag");
      tags.push(value);
    }
    update.tags = tags;
    merged.tags = tags;
  }

  if (body.genre !== undefined) {
    if (body.genre === null) {
      update.genre = null;
      merged.genre = null;
    } else if (typeof body.genre === "string") {
      const value = body.genre.trim();
      assertMaxLength(value, FIELD_LIMITS.genre, "genre");
      if (value) assertPublishUserTextSafe(value, "genre");
      update.genre = value || null;
      merged.genre = value || null;
    } else {
      throw AppError.badRequest("genre must be a string or null");
    }
  }

  if (body.mobilePreviewExcerpt !== undefined) {
    if (typeof body.mobilePreviewExcerpt !== "string") {
      throw AppError.badRequest("mobilePreviewExcerpt must be a string");
    }
    const value = body.mobilePreviewExcerpt.trim();
    if (!value) throw AppError.badRequest("mobilePreviewExcerpt cannot be empty");
    assertMaxLength(value, FIELD_LIMITS.mobilePreviewExcerpt, "mobilePreviewExcerpt");
    assertPublishUserTextSafe(value, "mobilePreviewExcerpt");
    update.mobile_preview_excerpt = value;
    merged.mobilePreviewExcerpt = value;
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("publish_packages")
    .update(update)
    .eq("id", packageId)
    .eq("project_id", projectId)
    .select(PACKAGE_SELECT)
    .single();

  if (error || !data) {
    console.error("publish_packages field update failed");
    throw AppError.internal("Failed to update publish package fields");
  }

  return mapPublishPackageRow(data as PublishPackageRow);
}

export async function updatePublishPackageChecklistForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  packageId: string,
  raw: unknown,
): Promise<PublishPackage> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.items)) {
    throw AppError.badRequest("items array is required");
  }

  const row = await getOwnedPackageRow(bindings, ownerId, projectId, packageId);
  assertPackageEditable(row);

  if (body.items.length !== ALLOWED_CHECKLIST_IDS.size) {
    throw AppError.badRequest(`checklist must contain exactly ${ALLOWED_CHECKLIST_IDS.size} items`);
  }

  const seenIds = new Set<string>();
  const normalized: PublishChecklistItem[] = [];

  for (const item of body.items) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw AppError.badRequest("each checklist item must be an object");
    }
    const entry = item as Record<string, unknown>;
    const id = entry.id;
    if (typeof id !== "string" || !ALLOWED_CHECKLIST_IDS.has(id)) {
      throw AppError.badRequest(`checklist item id "${String(id)}" is not allowed`);
    }
    if (seenIds.has(id)) {
      throw AppError.badRequest(`duplicate checklist item id "${id}"`);
    }
    seenIds.add(id);

    if (typeof entry.checked !== "boolean") {
      throw AppError.badRequest(`checklist item "${id}" requires boolean checked`);
    }

    let label = CHECKLIST_LABELS[id] ?? id;
    if (entry.label !== undefined) {
      if (typeof entry.label !== "string") {
        throw AppError.badRequest(`checklist item "${id}" label must be a string`);
      }
      label = entry.label.trim();
      if (!label) throw AppError.badRequest(`checklist item "${id}" label cannot be empty`);
      assertMaxLength(label, FIELD_LIMITS.checklistLabel, "checklist label");
      assertPublishUserTextSafe(label, "checklist label");
    }

    let note: string | undefined;
    if (entry.note !== undefined && entry.note !== null) {
      if (typeof entry.note !== "string") {
        throw AppError.badRequest(`checklist item "${id}" note must be a string`);
      }
      note = entry.note.trim();
      if (note) {
        assertMaxLength(note, FIELD_LIMITS.checklistNote, "checklist note");
        assertPublishUserTextSafe(note, "checklist note");
      }
    }

    normalized.push({
      id,
      label,
      checked: entry.checked,
      ...(note ? { note } : {}),
    });
  }

  for (const requiredId of ALLOWED_CHECKLIST_IDS) {
    if (!seenIds.has(requiredId)) {
      throw AppError.badRequest(`missing required checklist item "${requiredId}"`);
    }
  }

  normalized.sort(
    (a, b) =>
      [...ALLOWED_CHECKLIST_IDS].indexOf(a.id as string) -
      [...ALLOWED_CHECKLIST_IDS].indexOf(b.id as string),
  );

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("publish_packages")
    .update({ checklist_json: normalized })
    .eq("id", packageId)
    .eq("project_id", projectId)
    .select(PACKAGE_SELECT)
    .single();

  if (error || !data) {
    console.error("publish_packages checklist update failed");
    throw AppError.internal("Failed to update publish package checklist");
  }

  return mapPublishPackageRow(data as PublishPackageRow);
}

export interface MarkPublishPackageExportedResult {
  publishPackage: PublishPackage;
  alreadyExported: boolean;
  warnings: string[];
}

export async function markPublishPackageExportedForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  packageId: string,
  raw: unknown,
): Promise<MarkPublishPackageExportedResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const row = await getOwnedPackageRow(bindings, ownerId, projectId, packageId);

  if (row.status === PUBLISH_PACKAGE_STATUSES.exported) {
    return {
      publishPackage: mapPublishPackageRow(row),
      alreadyExported: true,
      warnings: [],
    };
  }

  if (
    row.status !== PUBLISH_PACKAGE_STATUSES.ready &&
    row.status !== PUBLISH_PACKAGE_STATUSES.draft
  ) {
    throw AppError.conflict("Only ready or draft publish packages can be marked exported", {
      missing: ["package_not_exportable"],
    });
  }

  let exportTarget = "kbm_manual_copy";
  if (body.exportTarget !== undefined && body.exportTarget !== null) {
    if (typeof body.exportTarget !== "string" || body.exportTarget.trim() !== "kbm_manual_copy") {
      throw AppError.badRequest('exportTarget must be "kbm_manual_copy"');
    }
    exportTarget = body.exportTarget.trim();
  }

  let exportNote: string | undefined;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") {
      throw AppError.badRequest("note must be a string");
    }
    exportNote = body.note.trim();
    if (exportNote) {
      assertMaxLength(exportNote, FIELD_LIMITS.checklistNote, "export note");
      assertPublishUserTextSafe(exportNote, "export note");
    }
  }

  const checklist = parseChecklistJson(row.checklist_json);
  const warnings: string[] = [];
  const unchecked = checklist.filter((item) => !item.checked);
  if (unchecked.length > 0) {
    warnings.push("checklist_incomplete");
  }

  const existingMetadata =
    row.metadata !== null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  const metadata = {
    ...existingMetadata,
    exportTarget,
    ...(exportNote ? { exportNote } : {}),
    exportedMarker: true,
  };

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("publish_packages")
    .update({
      status: PUBLISH_PACKAGE_STATUSES.exported,
      exported_at: new Date().toISOString(),
      metadata,
    })
    .eq("id", packageId)
    .eq("project_id", projectId)
    .select(PACKAGE_SELECT)
    .single();

  if (error || !data) {
    console.error("publish_packages mark-exported failed");
    throw AppError.internal("Failed to mark publish package exported");
  }

  return {
    publishPackage: mapPublishPackageRow(data as PublishPackageRow),
    alreadyExported: false,
    warnings,
  };
}