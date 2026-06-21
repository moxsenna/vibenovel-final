import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { AI_MODEL_REGISTRY } from "../src/services/ai-model-registry.ts";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const allowed = new Set(["src/services/ai-model-registry.ts"]);

const rawIds = Object.values(AI_MODEL_REGISTRY).flatMap((model) =>
  Object.values(model.deployments)
    .filter(Boolean)
    .map((deployment) => deployment.modelId),
);

for (const file of walk("src").filter((file) => file.endsWith(".ts"))) {
  const normalized = relative(".", file).replaceAll("\\", "/");
  if (allowed.has(normalized)) continue;
  const source = readFileSync(file, "utf8");
  for (const rawId of rawIds) {
    assert.equal(
      source.includes(rawId),
      false,
      `${rawId} must only exist in ai-model-registry.ts; found in ${normalized}`,
    );
  }
}

console.log("PASS raw provider model IDs stay inside registry");
