import {
  MOBILE_FORMAT_PREFERENCES,
  OUTPUT_STYLE_PREFERENCES,
  PROJECT_ENTRY_PATHS,
  PROJECT_STATUSES,
  TARGET_LENGTH_PLANS,
  WRITER_QUALITY_MODES,
  type MobileFormatPreference,
  type OutputStylePreference,
  type Project,
  type ProjectEntryPath,
  type ProjectStatus,
  type TargetLengthPlan,
  type WriterQualityMode,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { mapProjectRow, type ProjectRow } from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";

const PROJECT_SELECT =
  "id, owner_id, title, genre, status, current_chapter, entry_path, is_active, last_edited_at, created_at, updated_at";

const TITLE_MAX_LENGTH = 120;
const GENRE_MAX_LENGTH = 80;

const ENTRY_PATH_SET = new Set<string>(Object.values(PROJECT_ENTRY_PATHS));
const STATUS_SET = new Set<string>(Object.values(PROJECT_STATUSES));
const QUALITY_TIER_SET = new Set<string>(Object.values(WRITER_QUALITY_MODES));
const FORMAT_SET = new Set<string>(Object.values(MOBILE_FORMAT_PREFERENCES));
const OUTPUT_STYLE_SET = new Set<string>(Object.values(OUTPUT_STYLE_PREFERENCES));
const TARGET_LENGTH_SET = new Set<string>(Object.values(TARGET_LENGTH_PLANS));

export interface CreateProjectSettingsInput {
  qualityTier?: WriterQualityMode;
  outputStylePreference?: OutputStylePreference;
  defaultFormat?: MobileFormatPreference;
  targetLengthBand?: TargetLengthPlan;
}

export interface CreateProjectInput {
  title: string;
  entryPath?: ProjectEntryPath;
  targetLengthPlan?: TargetLengthPlan;
  defaultSettings?: CreateProjectSettingsInput;
}

export interface UpdateProjectInput {
  title?: string;
  status?: ProjectStatus;
  isActive?: boolean;
  genre?: string | null;
  targetLengthPlan?: TargetLengthPlan | null;
}

function assertNonEmptyTitle(title: unknown): string {
  if (typeof title !== "string") {
    throw AppError.badRequest("title must be a string");
  }
  const trimmed = title.trim();
  if (!trimmed) {
    throw AppError.badRequest("title is required");
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    throw AppError.badRequest(`title must be at most ${TITLE_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function assertOptionalEntryPath(value: unknown): ProjectEntryPath | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !ENTRY_PATH_SET.has(value)) {
    throw AppError.badRequest("entryPath is invalid");
  }
  return value as ProjectEntryPath;
}

function assertOptionalTargetLength(
  value: unknown,
  fieldName: string,
): TargetLengthPlan | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !TARGET_LENGTH_SET.has(value)) {
    throw AppError.badRequest(`${fieldName} is invalid`);
  }
  return value as TargetLengthPlan;
}

function assertOptionalTargetLengthNullable(
  value: unknown,
): TargetLengthPlan | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return assertOptionalTargetLength(value, "targetLengthPlan");
}

function parseDefaultSettings(raw: unknown): CreateProjectSettingsInput | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw AppError.badRequest("defaultSettings must be an object");
  }
  const obj = raw as Record<string, unknown>;
  const settings: CreateProjectSettingsInput = {};

  if (obj.qualityTier !== undefined) {
    if (typeof obj.qualityTier !== "string" || !QUALITY_TIER_SET.has(obj.qualityTier)) {
      throw AppError.badRequest("defaultSettings.qualityTier is invalid");
    }
    settings.qualityTier = obj.qualityTier as WriterQualityMode;
  }

  if (obj.outputStylePreference !== undefined) {
    if (
      typeof obj.outputStylePreference !== "string" ||
      !OUTPUT_STYLE_SET.has(obj.outputStylePreference)
    ) {
      throw AppError.badRequest("defaultSettings.outputStylePreference is invalid");
    }
    settings.outputStylePreference = obj.outputStylePreference as OutputStylePreference;
  }

  if (obj.defaultFormat !== undefined) {
    if (typeof obj.defaultFormat !== "string" || !FORMAT_SET.has(obj.defaultFormat)) {
      throw AppError.badRequest("defaultSettings.defaultFormat is invalid");
    }
    settings.defaultFormat = obj.defaultFormat as MobileFormatPreference;
  }

  if (obj.targetLengthBand !== undefined) {
    settings.targetLengthBand = assertOptionalTargetLength(
      obj.targetLengthBand,
      "defaultSettings.targetLengthBand",
    );
  }

  return settings;
}

async function userHasActiveProject(
  admin: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("is_active", true);

  if (error) {
    console.error("projects active check failed");
    throw AppError.internal("Failed to check active project");
  }

  return (count ?? 0) > 0;
}

async function deactivateOtherProjects(
  admin: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  exceptProjectId?: string,
): Promise<void> {
  let query = admin
    .from("projects")
    .update({ is_active: false })
    .eq("owner_id", ownerId)
    .eq("is_active", true);

  if (exceptProjectId) {
    query = query.neq("id", exceptProjectId);
  }

  const { error } = await query;
  if (error) {
    console.error("projects deactivate failed");
    throw AppError.internal("Failed to update active project");
  }
}

async function getOwnedProjectRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<ProjectRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("projects select by id failed");
    throw AppError.internal("Failed to load project");
  }

  if (!data) {
    throw AppError.notFound("Project not found");
  }

  return data as ProjectRow;
}

export async function listProjectsForOwner(
  bindings: AppBindings,
  ownerId: string,
  includeArchived: boolean,
): Promise<Project[]> {
  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });

  if (!includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("projects list failed");
    throw AppError.internal("Failed to list projects");
  }

  return ((data ?? []) as ProjectRow[]).map(mapProjectRow);
}

export async function getProjectForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<Project> {
  const row = await getOwnedProjectRow(bindings, ownerId, projectId);
  return mapProjectRow(row);
}

export async function createProjectForOwner(
  bindings: AppBindings,
  ownerId: string,
  raw: unknown,
): Promise<Project> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const title = assertNonEmptyTitle(body.title);
  const entryPath = assertOptionalEntryPath(body.entryPath);
  const targetLengthPlan = assertOptionalTargetLength(body.targetLengthPlan, "targetLengthPlan");
  const defaultSettings = parseDefaultSettings(body.defaultSettings);

  const admin = createServiceRoleClient(bindings);
  const hasActive = await userHasActiveProject(admin, ownerId);
  const isActive = !hasActive;

  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      owner_id: ownerId,
      title,
      status: PROJECT_STATUSES.draft,
      current_chapter: 1,
      entry_path: entryPath ?? null,
      is_active: isActive,
      last_edited_at: new Date().toISOString(),
    })
    .select(PROJECT_SELECT)
    .single();

  if (projectError || !project) {
    console.error("projects insert failed");
    throw AppError.internal("Failed to create project");
  }

  const projectId = (project as ProjectRow).id;
  const settingsRow = {
    project_id: projectId,
    quality_tier: defaultSettings?.qualityTier ?? WRITER_QUALITY_MODES.seimbang,
    output_style_preference:
      defaultSettings?.outputStylePreference ?? OUTPUT_STYLE_PREFERENCES.warm_emotional,
    default_format: defaultSettings?.defaultFormat ?? MOBILE_FORMAT_PREFERENCES.hp_kbm,
    target_length_band:
      defaultSettings?.targetLengthBand ?? targetLengthPlan ?? null,
  };

  const { error: settingsError } = await admin.from("project_settings").insert(settingsRow);

  if (settingsError) {
    console.error("project_settings insert failed");
    await admin.from("projects").delete().eq("id", projectId).eq("owner_id", ownerId);
    throw AppError.internal("Failed to create project settings");
  }

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "project_created",
    entityType: "project",
    entityId: projectId,
    metadata: {
      title,
      entryPath: entryPath ?? null,
      isActive,
    },
  });

  return mapProjectRow(project as ProjectRow);
}

export async function updateProjectForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<Project> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;
  const forbidden = ["ownerId", "owner_id", "id", "createdAt", "created_at"];
  for (const key of forbidden) {
    if (key in body) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
  }

  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  await getOwnedProjectRow(bindings, ownerId, projectId);

  const updates: Record<string, unknown> = {
    last_edited_at: new Date().toISOString(),
  };
  const changedFields: string[] = [];

  if (body.title !== undefined) {
    updates.title = assertNonEmptyTitle(body.title);
    changedFields.push("title");
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUS_SET.has(body.status)) {
      throw AppError.badRequest("status is invalid");
    }
    updates.status = body.status;
    changedFields.push("status");
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      throw AppError.badRequest("isActive must be a boolean");
    }
    if (body.isActive) {
      const admin = createServiceRoleClient(bindings);
      await deactivateOtherProjects(admin, ownerId, projectId);
    }
    updates.is_active = body.isActive;
    changedFields.push("isActive");
  }

  if (body.genre !== undefined) {
    if (body.genre !== null) {
      if (typeof body.genre !== "string") {
        throw AppError.badRequest("genre must be a string or null");
      }
      const trimmed = body.genre.trim();
      if (trimmed.length > GENRE_MAX_LENGTH) {
        throw AppError.badRequest(`genre must be at most ${GENRE_MAX_LENGTH} characters`);
      }
      updates.genre = trimmed || null;
    } else {
      updates.genre = null;
    }
    changedFields.push("genre");
  }

  const admin = createServiceRoleClient(bindings);

  if (Object.keys(updates).length > 1) {
    const { data, error } = await admin
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .eq("owner_id", ownerId)
      .select(PROJECT_SELECT)
      .single();

    if (error || !data) {
      console.error("projects update failed");
      throw AppError.internal("Failed to update project");
    }

    if (body.targetLengthPlan !== undefined) {
      const targetLength = assertOptionalTargetLengthNullable(body.targetLengthPlan);
      const { error: settingsError } = await admin
        .from("project_settings")
        .update({ target_length_band: targetLength })
        .eq("project_id", projectId);

      if (settingsError) {
        console.error("project_settings update failed");
        throw AppError.internal("Failed to update project settings");
      }
      changedFields.push("targetLengthPlan");
    }

    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "project_updated",
      entityType: "project",
      entityId: projectId,
      metadata: { changedFields },
    });

    return mapProjectRow(data as ProjectRow);
  }

  if (body.targetLengthPlan !== undefined) {
    const targetLength = assertOptionalTargetLengthNullable(body.targetLengthPlan);
    const { error: settingsError } = await admin
      .from("project_settings")
      .update({ target_length_band: targetLength })
      .eq("project_id", projectId);

    if (settingsError) {
      console.error("project_settings update failed");
      throw AppError.internal("Failed to update project settings");
    }

    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "project_updated",
      entityType: "project",
      entityId: projectId,
      metadata: { changedFields: ["targetLengthPlan"] },
    });
  }

  const row = await getOwnedProjectRow(bindings, ownerId, projectId);
  return mapProjectRow(row);
}

/** Soft archive — sets is_active false; no hard delete. */
export async function archiveProjectForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<Project> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("projects")
    .update({
      is_active: false,
      last_edited_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .select(PROJECT_SELECT)
    .single();

  if (error || !data) {
    console.error("projects archive failed");
    throw AppError.internal("Failed to archive project");
  }

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "project_updated",
    entityType: "project",
    entityId: projectId,
    metadata: { reason: "archive", changedFields: ["isActive"] },
  });

  return mapProjectRow(data as ProjectRow);
}