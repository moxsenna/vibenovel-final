import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  OUTLINE_PLAN_STATUSES,
  WORKFLOW_PHASES,
} from "@vibenovel/shared";
import { AppError } from "../src/errors.ts";
import { assertWriteRoomGates } from "../src/services/write-snapshot.ts";

function project(phase: string) {
  return {
    id: "project-write-contract",
    workflow_phase: phase,
  } as any;
}

function foundation(isLocked: boolean) {
  return {
    id: "foundation-write-contract",
    is_locked: isLocked,
  } as any;
}

function outlinePlan(status: string) {
  return {
    id: "outline-write-contract",
    status,
  } as any;
}

assert.doesNotThrow(() => {
  assertWriteRoomGates(
    project(WORKFLOW_PHASES.outline_locked),
    foundation(true),
    outlinePlan(OUTLINE_PLAN_STATUSES.locked),
  );
});

assert.throws(
  () => {
    assertWriteRoomGates(
      project(WORKFLOW_PHASES.foundation_locked),
      foundation(false),
      outlinePlan(OUTLINE_PLAN_STATUSES.generated),
    );
  },
  (err: unknown) =>
    err instanceof AppError &&
    err.code === "CONFLICT" &&
    err.message === "Write room is not ready" &&
    Array.isArray((err.details as { missing?: unknown }).missing) &&
    (err.details as { missing: string[] }).missing.includes("foundation_locked") &&
    (err.details as { missing: string[] }).missing.includes("outline_plan_locked") &&
    (err.details as { missing: string[] }).missing.includes("outline_locked"),
);

const proseDraftSource = readFileSync(
  fileURLToPath(new URL("../src/services/prose-draft.ts", import.meta.url)),
  "utf8",
);
const writeRoomMigration = readFileSync(
  fileURLToPath(new URL("../../../supabase/migrations/00004_sprint5_write_room.sql", import.meta.url)),
  "utf8",
);
assert.match(
  proseDraftSource,
  /export async function makeProseVersionCurrentForOwner/,
  "make-current endpoint must stay wired through the prose draft service",
);
assert.match(
  proseDraftSource,
  /if\s*\(\s*versionRow\.is_current\s*\)\s*\{[\s\S]*?return\s*\{/,
  "make-current must be idempotent when the selected version is already current",
);
assert.match(
  proseDraftSource,
  /\.update\(\{ is_current: false \}\)[\s\S]*\.eq\("chapter_beat_id"/,
  "make-current must demote only versions for the same beat before selecting the accepted one",
);
assert.match(
  proseDraftSource,
  /\.update\(\{ is_current: true \}\)[\s\S]*\.eq\("id", versionId\)[\s\S]*\.eq\("project_id", projectId\)/,
  "make-current must promote exactly the selected version within the project",
);
assert.doesNotMatch(
  proseDraftSource,
  /from\("chapter_prose_versions"\)\.delete\(\)/,
  "make-current must keep previous prose versions readable, not delete them",
);
assert.match(
  writeRoomMigration,
  /CREATE UNIQUE INDEX chapter_prose_versions_one_current_per_beat_idx[\s\S]*ON public\.chapter_prose_versions \(chapter_beat_id\)[\s\S]*WHERE is_current = true;/,
  "schema must enforce at most one current prose version per beat",
);

console.log("PASS write room gates and make-current contracts are explicit");
