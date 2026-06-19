import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENROUTER_MODELS_URL,
  REJECTED_OPENROUTER_MODEL_IDS,
  VERIFIED_OPENROUTER_MODELS,
  fetchOpenRouterModelCatalog,
  getVerificationSnapshotDrift,
  verifyOpenRouterModels,
} from "../src/services/openrouter-model-verification.ts";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const defaultReportPath = resolve(
  repoRoot,
  "docs/audit/20-credit-v2-model-verification-2026-06-19.md",
);
const noWrite = process.argv.includes("--no-write");
const outputArgIndex = process.argv.indexOf("--output");
const reportPath =
  outputArgIndex >= 0 && process.argv[outputArgIndex + 1]
    ? resolve(process.cwd(), process.argv[outputArgIndex + 1])
    : defaultReportPath;
const activeIds = Object.keys(VERIFIED_OPENROUTER_MODELS).sort();
const requestedIds = [...activeIds, ...REJECTED_OPENROUTER_MODEL_IDS].sort();
const verifiedAt = new Date().toISOString();

function formatNumber(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("en-US");
}

function formatPrice(value: number | null): string {
  return value === null ? "-" : `$${value.toFixed(6)}`;
}

try {
  const catalog = await fetchOpenRouterModelCatalog({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  const evaluated = verifyOpenRouterModels(
    requestedIds,
    catalog,
    verifiedAt,
  ).map((result) => ({
    result,
    active: activeIds.includes(result.requestedModelId),
    drift: activeIds.includes(result.requestedModelId)
      ? getVerificationSnapshotDrift(result)
      : [],
  }));

  const lines = [
    "# Credit v2 OpenRouter Model Verification",
    "",
    `- Verified at (UTC): \`${verifiedAt}\``,
    `- Source: ${OPENROUTER_MODELS_URL}`,
    "- Mode: read-only catalog verification; no generation requests were sent.",
    `- Authentication: ${process.env.OPENROUTER_API_KEY ? "Bearer key supplied" : "anonymous catalog GET"}.`,
    "- Required runtime parameters: `max_tokens`, `temperature`.",
    "- Catalog pricing is per token; values below are normalized to USD per 1M tokens.",
    "",
    "| Requested model | Decision | Status | Canonical ID | Context | Input / 1M | Output / 1M | Snapshot drift |",
    "|---|---|---|---|---:|---:|---:|---|",
    ...evaluated.map(({ result, active, drift }) => {
      const driftText = drift.length > 0 ? drift.join(", ") : "none";
      return `| \`${result.requestedModelId}\` | ${active ? "ACTIVE" : "REJECTED"} | ${result.status} | \`${result.canonicalId ?? "-"}\` | ${formatNumber(result.contextLength)} | ${formatPrice(result.inputUsdPer1M)} | ${formatPrice(result.outputUsdPer1M)} | ${driftText} |`;
    }),
    "",
    "## Supported Parameters",
    "",
    ...evaluated.flatMap(({ result, active }) => [
      `### ${result.requestedModelId}`,
      "",
      `- Routing decision: ${active ? "ACTIVE" : "REJECTED"}`,
      `- Status: ${result.status}`,
      `- Parameters: ${result.supportedParameters.map((value) => `\`${value}\``).join(", ") || "-"}`,
      `- Missing required parameters: ${result.missingRequiredParameters.map((value) => `\`${value}\``).join(", ") || "none"}`,
      `- Reason: ${result.reason ?? "Exact catalog match and compatible runtime parameters."}`,
      "",
    ]),
    "## Routing Decision",
    "",
    "- All production routing IDs are constrained to the verified source records.",
    "- `anthropic/claude-opus-4.8` and `openai/gpt-5.2` were not retained because the catalog did not advertise `temperature`, which the current client sends.",
    "- Mode `terbaik` uses `anthropic/claude-opus-4.6` with `google/gemini-3.1-pro-preview` as fallback.",
    "- User-facing credit prices are unchanged; this affects provider routing and internal cost telemetry only.",
  ];

  if (!noWrite) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  }

  for (const { result, active, drift } of evaluated) {
    console.log(
      `${active ? "ACTIVE" : "REJECTED"}\t${result.status}\t${result.requestedModelId}\tdrift=${drift.join(",") || "none"}`,
    );
  }

  const failures = evaluated.filter(
    ({ result, active, drift }) =>
      active
        ? result.status !== "VERIFIED" || drift.length > 0
        : result.status === "VERIFIED",
  );
  if (failures.length > 0) {
    console.error(
      `OpenRouter verification failed for ${failures.length} model(s). Review ${reportPath}.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `PASS OpenRouter model verification (${activeIds.length} active, ${REJECTED_OPENROUTER_MODEL_IDS.length} rejected)${noWrite ? "" : ` -> ${reportPath}`}`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`OpenRouter model verification could not run: ${message}`);
  console.error(
    "If the catalog requires authentication, set OPENROUTER_API_KEY and retry. No live generation is performed.",
  );
  process.exitCode = 1;
}
