import {
  PUBLISH_PACKAGE_STATUSES,
  type PublishPackage,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapPublishPackageRow, type PublishPackageRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import {
  generatePublishPackageStub,
  PUBLISH_GENERATOR_VERSION,
} from "./publish-package-generator.js";
import { loadPublishGenerationSnapshot } from "./publish-snapshot.js";

const PACKAGE_SELECT =
  "id, project_id, chapter_outline_id, chapter_summary_id, chapter_number, chapter_title, status, package_version, is_current, display_title, teaser, short_synopsis, caption, reader_question, next_chapter_teaser, tags, genre, mobile_preview_excerpt, checklist_json, safety_flags, generator_version, exported_at, metadata, created_at, updated_at";

const PUBLISH_STATUS_SET = new Set<string>(Object.values(PUBLISH_PACKAGE_STATUSES));

export interface ListPublishPackagesQuery {
  status?: string;
  chapterOutlineId?: string;
}

export interface GeneratePublishPackageResult {
  publishPackage: PublishPackage;
  created: boolean;
}

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

async function fetchCurrentPackageRow(
  bindings: AppBindings,
  projectId: string,
  chapterOutlineId: string,
): Promise<PublishPackageRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("publish_packages")
    .select(PACKAGE_SELECT)
    .eq("project_id", projectId)
    .eq("chapter_outline_id", chapterOutlineId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    console.error("publish_packages select current failed");
    throw AppError.internal("Failed to load current publish package");
  }
  return data as PublishPackageRow | null;
}

export async function listPublishPackagesForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: ListPublishPackagesQuery,
): Promise<PublishPackage[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  let dbQuery = admin
    .from("publish_packages")
    .select(PACKAGE_SELECT)
    .eq("project_id", projectId)
    .order("chapter_number", { ascending: true })
    .order("package_version", { ascending: false });

  if (query.chapterOutlineId) {
    dbQuery = dbQuery.eq("chapter_outline_id", query.chapterOutlineId);
  }

  if (query.status) {
    if (!PUBLISH_STATUS_SET.has(query.status)) {
      throw AppError.badRequest("status filter is invalid");
    }
    dbQuery = dbQuery.eq("status", query.status);
  } else {
    dbQuery = dbQuery.eq("is_current", true);
  }

  const { data, error } = await dbQuery;
  if (error) {
    console.error("publish_packages list failed");
    throw AppError.internal("Failed to list publish packages");
  }

  return ((data ?? []) as PublishPackageRow[]).map(mapPublishPackageRow);
}

export async function getPublishPackageDetailForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  packageId: string,
): Promise<PublishPackage> {
  const row = await getOwnedPackageRow(bindings, ownerId, projectId, packageId);
  return mapPublishPackageRow(row);
}

export async function getPublishPackageByChapterForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  chapterOutlineId: string,
): Promise<PublishPackage | null> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data: chapter, error: chapterError } = await admin
    .from("chapter_outlines")
    .select("id")
    .eq("project_id", projectId)
    .eq("id", chapterOutlineId)
    .maybeSingle();

  if (chapterError) {
    console.error("chapter_outlines select for publish by-chapter failed");
    throw AppError.internal("Failed to load chapter outline");
  }
  if (!chapter) {
    throw AppError.notFound("Chapter outline not found");
  }

  const row = await fetchCurrentPackageRow(bindings, projectId, chapterOutlineId);
  if (!row) {
    return null;
  }
  return mapPublishPackageRow(row);
}

export async function generatePublishPackageForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<GeneratePublishPackageResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const chapterOutlineId = body.chapterOutlineId;
  if (typeof chapterOutlineId !== "string" || !chapterOutlineId.trim()) {
    throw AppError.badRequest("chapterOutlineId is required");
  }

  let chapterSummaryId: string | undefined;
  if (body.chapterSummaryId !== undefined && body.chapterSummaryId !== null) {
    if (typeof body.chapterSummaryId !== "string" || !body.chapterSummaryId.trim()) {
      throw AppError.badRequest("chapterSummaryId must be a non-empty string");
    }
    chapterSummaryId = body.chapterSummaryId.trim();
  }

  const regenerate = body.regenerate === true;
  const trimmedOutlineId = chapterOutlineId.trim();

  await getOwnedProjectRow(bindings, ownerId, projectId);

  const existing = await fetchCurrentPackageRow(bindings, projectId, trimmedOutlineId);

  if (existing && !regenerate) {
    return {
      publishPackage: mapPublishPackageRow(existing),
      created: false,
    };
  }

  const { snapshot, proseVersionIdsUsed } = await loadPublishGenerationSnapshot(
    bindings,
    ownerId,
    projectId,
    trimmedOutlineId,
    chapterSummaryId,
  );

  const draft = generatePublishPackageStub(snapshot, proseVersionIdsUsed);
  const admin = createServiceRoleClient(bindings);

  let nextVersion = 1;
  if (regenerate && existing) {
    const { data: maxRow, error: maxError } = await admin
      .from("publish_packages")
      .select("package_version")
      .eq("project_id", projectId)
      .eq("chapter_outline_id", trimmedOutlineId)
      .order("package_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error("publish_packages max version lookup failed");
      throw AppError.internal("Failed to generate publish package");
    }
    nextVersion =
      maxRow !== null ? ((maxRow as { package_version: number }).package_version + 1) : 1;

    const { data: currentRows, error: currentFetchError } = await admin
      .from("publish_packages")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("chapter_outline_id", trimmedOutlineId)
      .eq("is_current", true);

    if (currentFetchError) {
      console.error("publish_packages current rows fetch failed");
      throw AppError.internal("Failed to generate publish package");
    }

    for (const row of currentRows ?? []) {
      const current = row as { id: string; status: string };
      const nextStatus =
        current.status === PUBLISH_PACKAGE_STATUSES.exported
          ? PUBLISH_PACKAGE_STATUSES.exported
          : PUBLISH_PACKAGE_STATUSES.superseded;

      const { error: supersedeError } = await admin
        .from("publish_packages")
        .update({
          is_current: false,
          status: nextStatus,
        })
        .eq("id", current.id);

      if (supersedeError) {
        console.error("publish_packages supersede failed");
        throw AppError.internal("Failed to generate publish package");
      }
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("publish_packages")
    .insert({
      project_id: projectId,
      chapter_outline_id: trimmedOutlineId,
      chapter_summary_id: snapshot.approvedSummaryId,
      chapter_number: snapshot.chapterNumber,
      chapter_title: draft.chapterTitle,
      status: draft.status,
      package_version: nextVersion,
      is_current: true,
      display_title: draft.displayTitle,
      teaser: draft.teaser,
      short_synopsis: draft.shortSynopsis,
      caption: draft.caption,
      reader_question: draft.readerQuestion,
      next_chapter_teaser: draft.nextChapterTeaser,
      tags: draft.tags,
      genre: draft.genre,
      mobile_preview_excerpt: draft.mobilePreviewExcerpt,
      checklist_json: draft.checklist,
      safety_flags: draft.safetyFlags,
      generator_version: PUBLISH_GENERATOR_VERSION,
      metadata: draft.metadata,
    })
    .select(PACKAGE_SELECT)
    .single();

  if (insertError || !inserted) {
    console.error("publish_packages insert failed");
    throw AppError.internal("Failed to generate publish package");
  }

  return {
    publishPackage: mapPublishPackageRow(inserted as PublishPackageRow),
    created: true,
  };
}