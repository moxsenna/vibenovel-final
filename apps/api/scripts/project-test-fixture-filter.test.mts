import assert from "node:assert/strict";
import type { Project } from "@vibenovel/shared";
import type { AppBindings } from "../src/env.ts";
import {
  filterTestFixtureProjectsForProduction,
  isProductionTestFixtureTitle,
} from "../src/services/project.ts";

assert.equal(isProductionTestFixtureTitle("ZZ-TEST-readiness (hapus)"), true);
assert.equal(isProductionTestFixtureTitle("zz-test-s13"), true);
assert.equal(isProductionTestFixtureTitle("Cerita nyata (boleh dihapus)"), true);
assert.equal(isProductionTestFixtureTitle("Draft Saya"), false);
assert.equal(isProductionTestFixtureTitle("  ZZ-TEST-x  "), true);

function stubProject(title: string): Project {
  return {
    id: "p1",
    ownerId: "u1",
    title,
    genre: "Drama",
    status: "draft",
    currentChapter: 0,
    entryPath: "intake",
    isActive: true,
    lastEditedAt: "2026-01-01T00:00:00.000Z",
    workflowPhase: "intake",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const prodBindings = { APP_ENV: "production" } as AppBindings;
const devBindings = { APP_ENV: "development" } as AppBindings;

const mixed = [
  stubProject("Cerita Baru"),
  stubProject("ZZ-TEST-readiness (hapus)"),
];

assert.deepEqual(
  filterTestFixtureProjectsForProduction(mixed, prodBindings).map((p) => p.title),
  ["Cerita Baru"],
);
assert.deepEqual(
  filterTestFixtureProjectsForProduction(mixed, devBindings).map((p) => p.title),
  ["Cerita Baru", "ZZ-TEST-readiness (hapus)"],
);

console.log("PASS project test fixture filter (doc 113 A1)");