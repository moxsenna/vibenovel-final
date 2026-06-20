import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AI_MODEL_REGISTRY,
  getAiModel,
  getAiModelDeployment,
  getDeploymentCost,
  isAiLogicalModelKey,
} from "../src/services/ai-model-registry.ts";

assert.equal(isAiLogicalModelKey("minimax_text"), true);
assert.equal(isAiLogicalModelKey("minimax/minimax-m3"), false);
assert.equal(isAiLogicalModelKey("prose_premium"), false);

const minimax = getAiModel("minimax_text");
assert.equal(minimax.modality, "text");
assert.equal(minimax.capabilities.textGeneration, true);
assert.equal(minimax.capabilities.structuredJson, true);

const openRouterMinimax = getAiModelDeployment("minimax_text", "openrouter");
assert.equal(openRouterMinimax.modelId, "minimax/minimax-m3");
assert.equal(openRouterMinimax.verificationStatus, "verified");

const tokenRouterMinimax = getAiModelDeployment("minimax_text", "tokenrouter");
assert.equal(tokenRouterMinimax.modelId, "MiniMax-M3");
assert.equal(tokenRouterMinimax.verificationStatus, "documented");
assert.equal(tokenRouterMinimax.promotionEndsOn, "2026-06-22");

assert.deepEqual(getDeploymentCost("minimax_text", "openrouter"), {
  inputUsdPer1M: 0.3,
  outputUsdPer1M: 1.2,
});
assert.deepEqual(getDeploymentCost("minimax_text", "tokenrouter"), {
  inputUsdPer1M: 0,
  outputUsdPer1M: 0,
});

assert.equal(getAiModel("openai_embedding_small").embeddingDimensions, 1536);

for (const [logicalModel, model] of Object.entries(AI_MODEL_REGISTRY)) {
  assert.ok(
    Object.keys(model.deployments).length > 0,
    `${logicalModel} needs a deployment`,
  );
  for (const deployment of Object.values(model.deployments)) {
    assert.ok(deployment.modelId.length > 0);
    assert.ok(deployment.contextWindow > 0);
    assert.ok(Number.isFinite(Date.parse(deployment.verifiedAt)));
    assert.ok(deployment.verificationSource.length > 0);
    assert.ok(deployment.pricing.inputUsdPer1M >= 0);
    assert.ok(deployment.pricing.outputUsdPer1M >= 0);
  }
}

const audit = readFileSync(
  "../../docs/audit/20-credit-v2-model-verification-2026-06-19.md",
  "utf8",
);
const auditPrices = new Map<
  string,
  {
    inputUsdPer1M: number;
    outputUsdPer1M: number;
  }
>();
for (const line of audit.split(/\r?\n/)) {
  if (!line.startsWith("| `")) continue;
  const columns = line
    .split("|")
    .slice(1, -1)
    .map((column) => column.trim());
  if (columns[2] !== "VERIFIED") continue;
  auditPrices.set(columns[0].replaceAll("`", ""), {
    inputUsdPer1M: Number(columns[5].replace("$", "")),
    outputUsdPer1M: Number(columns[6].replace("$", "")),
  });
}

for (const model of Object.values(AI_MODEL_REGISTRY)) {
  const deployment = model.deployments.openrouter;
  if (!deployment || deployment.verificationStatus !== "verified") continue;
  if (deployment.verificationSource !== "https://openrouter.ai/api/v1/models") {
    continue;
  }
  assert.deepEqual(
    deployment.pricing,
    auditPrices.get(deployment.modelId),
    `${deployment.modelId} pricing must equal audit 20`,
  );
}

console.log("PASS AI model registry contracts");
