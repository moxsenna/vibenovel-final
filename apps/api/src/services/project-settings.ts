import {
  DEFAULT_LANGUAGES,
  MOBILE_FORMAT_PREFERENCES,
  OUTPUT_STYLE_PREFERENCES,
  TARGET_LENGTH_PLANS,
  WRITER_QUALITY_MODES,
  type DefaultLanguage,
} from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import {
  mapProjectSettingsResponse,
  type ProjectSettingsResponse,
  type ProjectSettingsRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { writeAuditLog } from "./audit.js";
import { getOwnedProjectRow } from "./project.js";

const SETTINGS_SELECT =
  "id, project_id, quality_tier, output_style_preference, default_format, target_length_band, created_at, updated_at";

const QUALITY_MODE_SET = new Set<string>(Object.values(WRITER_QUALITY_MODES));
const LANGUAGE_SET = new Set<string>(Object.values(DEFAULT_LANGUAGES));
const FORMAT_SET = new Set<string>(Object.values(MOBILE_FORMAT_PREFERENCES));
const OUTPUT_STYLE_SET = new Set<string>(Object.values(OUTPUT_STYLE_PREFERENCES));
const TARGET_LENGTH_SET = new Set<string>(Object.values(TARGET_LENGTH_PLANS));

const FORBIDDEN_PUT_KEYS = new Set([
  "id",
  "projectId",
  "project_id",
  "ownerId",
  "owner_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

const RAW_MODEL_PATTERNS = [
  /openrouter/i,
  /gemini[-\d]/i,
  /\bgpt[-\d]/i,
  /\bclaude[-\d]/i,
  /\bllama[-\d]/i,
  /\bmistral[-\d]/i,
  /anthropic/i,
  /deepseek/i,
];

const GENRE_MAX_LENGTH = 80;

const DEFAULT_SETTINGS_ROW = {
  quality_tier: WRITER_QUALITY_MODES.seimbang,
  output_style_preference: OUTPUT_STYLE_PREFERENCES.warm_emotional,
  default_format: MOBILE_FORMAT_PREFERENCES.hp_kbm,
  target_length_band: null,
} as const;

function assertNoRawModelStrings(value: string, fieldName: string): void {
  for (const pattern of RAW_MODEL_PATTERNS) {
    if (pattern.test(value)) {
      throw AppError.badRequest(`${fieldName} must not contain model or provider names`);
    }
  }
}

function scanBodyForRawModels(body: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      assertNoRawModelStrings(value, key);
    }
  }
}

function settingsSnapshot(row: ProjectSettingsRow): Record<string, unknown> {
  return {
    qualityTier: row.quality_tier,
    outputStylePreference: row.output_style_preference,
    defaultFormat: row.default_format,
    targetLengthBand: row.target_length_band,
  };
}

async function fetchSettingsRow(
  bindings: AppBindings,
  projectId: string,
): Promise<ProjectSettingsRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("project_settings")
    .select(SETTINGS_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("project_settings select failed");
    throw AppError.internal("Failed to load project settings");
  }

  return data as ProjectSettingsRow | null;
}

async function createDefaultSettingsRow(
  bindings: AppBindings,
  projectId: string,
): Promise<ProjectSettingsRow> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("project_settings")
    .insert({
      project_id: projectId,
      ...DEFAULT_SETTINGS_ROW,
    })
    .select(SETTINGS_SELECT)
    .single();

  if (error || !data) {
    console.error("project_settings default insert failed");
    throw AppError.internal("Failed to create project settings");
  }

  return data as ProjectSettingsRow;
}

async function getOrCreateSettingsRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<ProjectSettingsRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const existing = await fetchSettingsRow(bindings, projectId);
  if (existing) return existing;
  return createDefaultSettingsRow(bindings, projectId);
}

async function fetchProfileLanguage(
  bindings: AppBindings,
  ownerId: string,
): Promise<DefaultLanguage | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("profiles")
    .select("default_language")
    .eq("id", ownerId)
    .maybeSingle();

  if (error || !data) return null;
  return data.default_language as DefaultLanguage;
}

async function fetchProjectGenre(
  bindings: AppBindings,
  projectId: string,
): Promise<string | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("projects")
    .select("genre")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) return null;
  return data.genre;
}

function buildSettingsResponse(
  row: ProjectSettingsRow,
  extras?: { defaultLanguage?: DefaultLanguage | null; defaultGenre?: string | null },
): ProjectSettingsResponse & {
  defaultLanguage?: DefaultLanguage | null;
  defaultGenre?: string | null;
} {
  const mapped = mapProjectSettingsResponse(row);
  return {
    ...mapped,
    ...(extras?.defaultLanguage !== undefined ? { defaultLanguage: extras.defaultLanguage } : {}),
    ...(extras?.defaultGenre !== undefined ? { defaultGenre: extras.defaultGenre } : {}),
  };
}

export async function getProjectSettingsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<ProjectSettingsResponse & { defaultLanguage?: DefaultLanguage | null; defaultGenre?: string | null }> {
  const row = await getOrCreateSettingsRow(bindings, ownerId, projectId);
  const [defaultLanguage, defaultGenre] = await Promise.all([
    fetchProfileLanguage(bindings, ownerId),
    fetchProjectGenre(bindings, projectId),
  ]);
  return buildSettingsResponse(row, { defaultLanguage, defaultGenre });
}

export async function upsertProjectSettingsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<ProjectSettingsResponse & { defaultLanguage?: DefaultLanguage | null; defaultGenre?: string | null }> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }

  const body = raw as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (FORBIDDEN_PUT_KEYS.has(key)) {
      throw AppError.badRequest(`Field "${key}" cannot be updated`);
    }
  }

  if (Object.keys(body).length === 0) {
    throw AppError.badRequest("No updatable fields provided");
  }

  scanBodyForRawModels(body);

  await getOwnedProjectRow(bindings, ownerId, projectId);
  const beforeRow = await getOrCreateSettingsRow(bindings, ownerId, projectId);
  const beforeData = settingsSnapshot(beforeRow);

  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];

  const qualityRaw = body.qualityMode ?? body.qualityTier;
  if (qualityRaw !== undefined) {
    if (typeof qualityRaw !== "string" || !QUALITY_MODE_SET.has(qualityRaw)) {
      throw AppError.badRequest("qualityMode must be hemat, seimbang, or terbaik");
    }
    updates.quality_tier = qualityRaw;
    changedFields.push("qualityMode");
  }

  const formatRaw = body.mobileFormatPreference ?? body.defaultFormat;
  if (formatRaw !== undefined) {
    if (typeof formatRaw !== "string" || !FORMAT_SET.has(formatRaw)) {
      throw AppError.badRequest("mobileFormatPreference is invalid");
    }
    updates.default_format = formatRaw;
    changedFields.push("mobileFormatPreference");
  }

  if (body.outputStylePreference !== undefined) {
    if (
      typeof body.outputStylePreference !== "string" ||
      !OUTPUT_STYLE_SET.has(body.outputStylePreference)
    ) {
      throw AppError.badRequest("outputStylePreference is invalid");
    }
    updates.output_style_preference = body.outputStylePreference;
    changedFields.push("outputStylePreference");
  }

  const lengthRaw = body.targetLengthPlan ?? body.targetLengthBand;
  if (lengthRaw !== undefined) {
    if (lengthRaw === null) {
      updates.target_length_band = null;
    } else if (typeof lengthRaw !== "string" || !TARGET_LENGTH_SET.has(lengthRaw)) {
      throw AppError.badRequest("targetLengthPlan is invalid");
    } else {
      updates.target_length_band = lengthRaw;
    }
    changedFields.push("targetLengthPlan");
  }

  const admin = createServiceRoleClient(bindings);
  let afterRow = beforeRow;

  if (Object.keys(updates).length > 0) {
    const { data, error } = await admin
      .from("project_settings")
      .update(updates)
      .eq("project_id", projectId)
      .select(SETTINGS_SELECT)
      .single();

    if (error || !data) {
      console.error("project_settings update failed");
      throw AppError.internal("Failed to update project settings");
    }

    afterRow = data as ProjectSettingsRow;
  }

  if (body.defaultLanguage !== undefined) {
    if (typeof body.defaultLanguage !== "string" || !LANGUAGE_SET.has(body.defaultLanguage)) {
      throw AppError.badRequest("defaultLanguage must be id or en");
    }
    const { error } = await admin
      .from("profiles")
      .update({ default_language: body.defaultLanguage })
      .eq("id", ownerId);

    if (error) {
      console.error("profiles language update failed");
      throw AppError.internal("Failed to update default language");
    }
    changedFields.push("defaultLanguage");
  }

  if (body.defaultGenre !== undefined) {
    let genre: string | null = null;
    if (body.defaultGenre !== null) {
      if (typeof body.defaultGenre !== "string") {
        throw AppError.badRequest("defaultGenre must be a string or null");
      }
      const trimmed = body.defaultGenre.trim();
      if (trimmed.length > GENRE_MAX_LENGTH) {
        throw AppError.badRequest(`defaultGenre must be at most ${GENRE_MAX_LENGTH} characters`);
      }
      assertNoRawModelStrings(trimmed, "defaultGenre");
      genre = trimmed || null;
    }
    const { error } = await admin
      .from("projects")
      .update({ genre })
      .eq("id", projectId)
      .eq("owner_id", ownerId);

    if (error) {
      console.error("projects genre update failed");
      throw AppError.internal("Failed to update default genre");
    }
    changedFields.push("defaultGenre");
  }

  if (body.defaultReaderTarget !== undefined) {
    throw AppError.badRequest(
      "defaultReaderTarget is not persisted in project_settings (deferred to foundation API)",
    );
  }

  if (body.metadata !== undefined) {
    throw AppError.badRequest("metadata is not supported for project settings");
  }

  const afterData = settingsSnapshot(afterRow);

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "settings_updated",
    entityType: "project_settings",
    entityId: afterRow.id,
    metadata: { changedFields },
    beforeData,
    afterData,
  });

  const [defaultLanguage, defaultGenre] = await Promise.all([
    fetchProfileLanguage(bindings, ownerId),
    fetchProjectGenre(bindings, projectId),
  ]);

  return buildSettingsResponse(afterRow, { defaultLanguage, defaultGenre });
}