import { callOpenAiCompatibleChat } from "../src/services/openai-compatible-client.ts";

const live = process.argv.includes("--live");
if (!live) {
  console.error("BLOCKED: pass --live to authorize one TokenRouter request");
  process.exit(2);
}

const apiKey = process.env.TOKENROUTER_API_KEY?.trim();
const baseUrl =
  process.env.TOKENROUTER_BASE_URL?.trim() || "https://api.tokenrouter.com/v1";

if (!apiKey) {
  console.error("BLOCKED: TOKENROUTER_API_KEY is missing");
  process.exit(2);
}

const started = Date.now();
const result = await callOpenAiCompatibleChat({
  provider: "tokenrouter",
  baseUrl,
  apiKey,
  modelId: "MiniMax-M3",
  messages: [
    {
      role: "system",
      content:
        "Return only compact JSON. Do not include markdown or explanation.",
    },
    {
      role: "user",
      content:
        'Return {"provider":"tokenrouter","model":"MiniMax-M3","items":[1,2,3]}.',
    },
  ],
  maxOutputTokens: 160,
  temperature: 0,
  timeoutMs: 30_000,
});

let parsed: unknown;
try {
  parsed = JSON.parse(
    result.text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim(),
  );
} catch {
  console.error("FAIL: response was not clean JSON");
  process.exit(1);
}

const object = parsed as {
  provider?: unknown;
  model?: unknown;
  items?: unknown;
};
if (
  object.provider !== "tokenrouter" ||
  object.model !== "MiniMax-M3" ||
  !Array.isArray(object.items) ||
  object.items.length !== 3
) {
  console.error("FAIL: JSON schema mismatch");
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: "VERIFIED",
    provider: "tokenrouter",
    modelId: "MiniMax-M3",
    maxTokensAccepted: true,
    structuredJson: true,
    inputTokens: result.inputTokens ?? null,
    outputTokens: result.outputTokens ?? null,
    latencyMs: Date.now() - started,
  }),
);
