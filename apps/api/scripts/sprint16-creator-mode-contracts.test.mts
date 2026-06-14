import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CREATOR_MODES,
  type CreatorMode,
} from "@vibenovel/shared";
import {
  mapProjectSettingsResponse,
  type ProjectSettingsRow,
} from "../src/lib/mappers.ts";

assert.equal(CREATOR_MODES.simple, "simple");
assert.equal(CREATOR_MODES.advanced, "advanced");

const row: ProjectSettingsRow = {
  id: "settings-creator-mode",
  project_id: "project-creator-mode",
  quality_tier: "seimbang",
  output_style_preference: "warm_emotional",
  default_format: "hp_kbm",
  target_length_band: null,
  creator_mode: CREATOR_MODES.advanced,
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-06-14T00:00:00.000Z",
};

const response = mapProjectSettingsResponse(row);
const mode: CreatorMode = response.creatorMode;
assert.equal(mode, "advanced");

const migrationSql = readFileSync(
  "../../supabase/migrations/00014_sprint16_creator_mode.sql",
  "utf8",
);

assert.match(migrationSql, /creator_mode/i);
assert.match(migrationSql, /CHECK\s*\(creator_mode IN \('simple', 'advanced'\)\)/i);
assert.match(migrationSql, /DEFAULT 'simple'/i);

console.log("PASS Sprint 16 creator mode contracts");
