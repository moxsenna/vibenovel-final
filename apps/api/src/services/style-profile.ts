import type { JsonObject } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { AppError } from "../errors.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { getOwnedProjectRow } from "./project.js";

export interface OperationalStyleRules {
  paragraphLength: "short" | "medium" | "long";
  averageSentenceWords: number | null;
  dialogueDensity: "low" | "medium" | "high";
  narrationStyle: string[];
  forbiddenStyle: string[];
  signatureMoves: string[];
  expositionTolerance: "low" | "medium" | "high";
  metaphorDensity: "low" | "medium" | "high";
  endingRhythm: string[];
}

export interface StyleProfile {
  id: string;
  projectId: string;
  version: number;
  status: string;
  operationalRules: OperationalStyleRules;
  metrics: JsonObject;
  source: string;
  sourceProseVersionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_STYLE_RULES: OperationalStyleRules = {
  paragraphLength: "medium",
  averageSentenceWords: null,
  dialogueDensity: "medium",
  narrationStyle: [],
  forbiddenStyle: [],
  signatureMoves: [],
  expositionTolerance: "medium",
  metaphorDensity: "medium",
  endingRhythm: [],
};

const STYLE_PROFILE_SELECT =
  "id, project_id, version, status, operational_rules, metrics, source, source_prose_version_ids, created_at, updated_at";

interface StyleProfileRow {
  id: string;
  project_id: string;
  version: number;
  status: string;
  operational_rules: unknown;
  metrics: unknown;
  source: string;
  source_prose_version_ids: string[];
  created_at: string;
  updated_at: string;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export function normalizeOperationalStyleRules(
  value: unknown,
): OperationalStyleRules {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const averageSentenceWords =
    typeof input.averageSentenceWords === "number" &&
    Number.isFinite(input.averageSentenceWords) &&
    input.averageSentenceWords > 0
      ? Math.round(input.averageSentenceWords * 100) / 100
      : null;
  return {
    paragraphLength: enumValue(
      input.paragraphLength,
      ["short", "medium", "long"] as const,
      DEFAULT_STYLE_RULES.paragraphLength,
    ),
    averageSentenceWords,
    dialogueDensity: enumValue(
      input.dialogueDensity,
      ["low", "medium", "high"] as const,
      DEFAULT_STYLE_RULES.dialogueDensity,
    ),
    narrationStyle: stringArray(input.narrationStyle).slice(0, 12),
    forbiddenStyle: stringArray(input.forbiddenStyle).slice(0, 12),
    signatureMoves: stringArray(input.signatureMoves).slice(0, 12),
    expositionTolerance: enumValue(
      input.expositionTolerance,
      ["low", "medium", "high"] as const,
      DEFAULT_STYLE_RULES.expositionTolerance,
    ),
    metaphorDensity: enumValue(
      input.metaphorDensity,
      ["low", "medium", "high"] as const,
      DEFAULT_STYLE_RULES.metaphorDensity,
    ),
    endingRhythm: stringArray(input.endingRhythm).slice(0, 12),
  };
}

function mapStyleProfile(row: StyleProfileRow): StyleProfile {
  return {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    status: row.status,
    operationalRules: normalizeOperationalStyleRules(row.operational_rules),
    metrics:
      row.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics)
        ? (row.metrics as JsonObject)
        : {},
    source: row.source,
    sourceProseVersionIds: row.source_prose_version_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getStyleProfileForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
): Promise<StyleProfile | null> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("style_profiles")
    .select(STYLE_PROFILE_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    console.error("style_profiles select failed");
    throw AppError.internal("Failed to load style profile");
  }
  return data ? mapStyleProfile(data as StyleProfileRow) : null;
}

export interface UpsertStyleProfileInput {
  operationalRules: OperationalStyleRules;
  metrics?: JsonObject;
  source: string;
  sourceProseVersionIds?: string[];
}

export async function upsertStyleProfileForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  input: UpsertStyleProfileInput,
): Promise<StyleProfile> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const current = await getStyleProfileForOwner(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("style_profiles")
    .upsert(
      {
        project_id: projectId,
        version: (current?.version ?? 0) + 1,
        status: "active",
        operational_rules: normalizeOperationalStyleRules(input.operationalRules),
        metrics: input.metrics ?? {},
        source: input.source.trim() || "manual",
        source_prose_version_ids: input.sourceProseVersionIds ?? [],
      },
      { onConflict: "project_id" },
    )
    .select(STYLE_PROFILE_SELECT)
    .single();
  if (error || !data) {
    console.error("style_profiles upsert failed");
    throw AppError.internal("Failed to save style profile");
  }
  return mapStyleProfile(data as StyleProfileRow);
}

export function styleRulesToPromptLines(rules: OperationalStyleRules): string[] {
  return [
    `Paragraph length target: ${rules.paragraphLength}`,
    rules.averageSentenceWords
      ? `Average sentence target: ${rules.averageSentenceWords} words`
      : null,
    `Dialogue density target: ${rules.dialogueDensity}`,
    `Exposition tolerance: ${rules.expositionTolerance}`,
    `Metaphor density: ${rules.metaphorDensity}`,
    ...rules.narrationStyle.map((item) => `Narration: ${item}`),
    ...rules.forbiddenStyle.map((item) => `Forbidden style: ${item}`),
    ...rules.signatureMoves.map((item) => `Signature move: ${item}`),
    ...rules.endingRhythm.map((item) => `Ending rhythm: ${item}`),
  ].filter((line): line is string => Boolean(line));
}
