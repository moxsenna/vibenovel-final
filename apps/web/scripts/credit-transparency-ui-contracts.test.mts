import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WRITER_QUALITY_MODES } from "@vibenovel/shared";

const displayModule = (await import(
  "../src/services/ai-credit-display.ts"
)) as unknown as Record<string, unknown>;

assert.equal(
  typeof displayModule.formatCreditSuccessNotice,
  "function",
  "credit success copy must be centralized",
);
assert.equal(
  typeof displayModule.formatPremiumQualityWarning,
  "function",
  "Terbaik warning copy must be centralized",
);
assert.equal(
  typeof displayModule.formatFoundationCreditCostLabel,
  "function",
  "foundation credit label must be centralized",
);
assert.equal(
  typeof displayModule.formatOutlineCreditCostLabel,
  "function",
  "outline credit label must be centralized",
);

const formatCreditSuccessNotice = displayModule.formatCreditSuccessNotice as (
  actionLabel: string,
  creditCost: number,
  remainingBalance: number | null,
  idempotentReplay?: boolean,
) => string;
const formatPremiumQualityWarning =
  displayModule.formatPremiumQualityWarning as (
    qualityMode: string,
    creditCost: number,
  ) => string | null;
const formatFoundationCreditCostLabel =
  displayModule.formatFoundationCreditCostLabel as (
    serverCreditCost?: number | null,
  ) => string;
const formatOutlineCreditCostLabel =
  displayModule.formatOutlineCreditCostLabel as (
    serverCreditCost?: number | null,
  ) => string;

assert.equal(
  formatCreditSuccessNotice("Narasi AI berhasil dibuat", 7_500, 12_500),
  "Narasi AI berhasil dibuat. 7.500 kredit digunakan. Sisa kredit: 12.500.",
);
assert.equal(
  formatCreditSuccessNotice("Saran copy siap ditinjau", 400, null, true),
  "Saran copy siap ditinjau. 400 kredit digunakan. Hasil permintaan sebelumnya ditampilkan kembali.",
);
assert.equal(
  formatPremiumQualityWarning(WRITER_QUALITY_MODES.hemat, 800),
  null,
);
assert.equal(
  formatPremiumQualityWarning(WRITER_QUALITY_MODES.terbaik, 7_500),
  "Mode Terbaik memakai 7.500 kredit. Gunakan untuk adegan kunci seperti opening, klimaks, atau ending.",
);
assert.equal(
  formatFoundationCreditCostLabel(2_000),
  "Biaya: 2.000 kredit",
);
assert.equal(
  formatOutlineCreditCostLabel(2_500),
  "Biaya: 2.500 kredit",
);
const hookFallbackSource = readFileSync(
  new URL("../src/lib/hook-fallback.ts", import.meta.url),
  "utf8",
);
assert.match(
  hookFallbackSource,
  /Kredit tidak terpakai atau sudah dikembalikan otomatis\./,
);
assert.match(
  hookFallbackSource,
  /AI_PROVIDER_ERROR[\s\S]*Layanan AI sedang tidak tersedia/,
  "provider errors must map to safe user-facing copy",
);
assert.doesNotMatch(
  hookFallbackSource,
  /\$\{prefix\}\s*\(\$\{error\.message\}\)/,
  "AI generation failure copy must not expose raw API diagnostics",
);

const publishHookSource = readFileSync(
  new URL("../src/hooks/usePublishData.ts", import.meta.url),
  "utf8",
);
const publishPanelSource = readFileSync(
  new URL("../src/components/publish/PublishAiCopyPanel.tsx", import.meta.url),
  "utf8",
);
const intakeHookSource = readFileSync(
  new URL("../src/hooks/useIntakeData.ts", import.meta.url),
  "utf8",
);
const conceptHookSource = readFileSync(
  new URL("../src/hooks/useConceptsData.ts", import.meta.url),
  "utf8",
);
const writerPanelSource = readFileSync(
  new URL("../src/components/writer/WriterAssistantPanel.tsx", import.meta.url),
  "utf8",
);
const writerMobileSource = readFileSync(
  new URL("../src/components/writer/WriterMobileLayout.tsx", import.meta.url),
  "utf8",
);
const foundationServiceSource = readFileSync(
  new URL("../src/services/foundation-flow.ts", import.meta.url),
  "utf8",
);
const foundationHookSource = readFileSync(
  new URL("../src/hooks/useFoundationFlow.ts", import.meta.url),
  "utf8",
);
const foundationPanelSource = readFileSync(
  new URL("../src/components/foundation/FoundationProposalsPanel.tsx", import.meta.url),
  "utf8",
);
const outlineServiceSource = readFileSync(
  new URL("../src/services/outline.ts", import.meta.url),
  "utf8",
);
const outlineHookSource = readFileSync(
  new URL("../src/hooks/useOutlineData.ts", import.meta.url),
  "utf8",
);
const outlineActionsSource = readFileSync(
  new URL("../src/components/outline/OutlineWorkflowActions.tsx", import.meta.url),
  "utf8",
);
const foundationApiSource = readFileSync(
  new URL("../../api/src/services/foundation-proposal.ts", import.meta.url),
  "utf8",
);
const outlineApiSource = readFileSync(
  new URL("../../api/src/services/outline.ts", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  publishPanelSource,
  /qualityModeLabel|Mode kualitas/,
  "publish is fixed-price and must not display a prose quality mode",
);
assert.match(
  publishHookSource,
  /fetchCreditEstimate\("publish_package",\s*undefined,/,
  "publish estimate must not depend on quality mode",
);
assert.doesNotMatch(
  publishHookSource,
  /improvePublishCopy[\s\S]{0,300}\bqualityMode\b/,
  "publish requests must stop sending the prose quality mode",
);
assert.match(
  intakeHookSource,
  /fetchCreditEstimate\("intake_chat_reply"/,
  "intake must show a server-driven pre-action estimate",
);
assert.match(
  conceptHookSource,
  /formatCreditSuccessNotice/,
  "concept generation must show post-success credit usage",
);
assert.match(
  writerPanelSource,
  /premiumCreditWarning/,
  "desktop writer must render the Terbaik warning before spend",
);
assert.match(
  writerMobileSource,
  /premiumCreditWarning/,
  "mobile writer must render the Terbaik warning before spend",
);
assert.match(
  foundationHookSource,
  /fetchCreditEstimate\("foundation_setup",\s*undefined,\s*token\)/,
  "foundation must fetch the server-authoritative fixed-price estimate",
);
assert.match(
  outlineHookSource,
  /fetchCreditEstimate\("outline_10_chapters",\s*undefined,\s*token\)/,
  "outline must fetch the server-authoritative fixed-price estimate",
);
assert.match(
  foundationHookSource,
  /formatCreditSuccessNotice/,
  "foundation generation must show debit and remaining balance after success",
);
assert.match(
  outlineHookSource,
  /formatCreditSuccessNotice/,
  "outline generation must show debit and remaining balance after success",
);
assert.match(
  foundationPanelSource,
  /creditCostLabel/,
  "foundation proposal action must render its pre-action credit label",
);
assert.match(
  outlineActionsSource,
  /creditCostLabel/,
  "outline generation action must render its pre-action credit label",
);
assert.doesNotMatch(
  `${foundationPanelSource}\n${outlineActionsSource}`,
  /qualityMode|Mode kualitas|Pilih kualitas/,
  "foundation and outline fixed-price actions must not expose quality controls",
);
for (const [label, source] of [
  ["foundation web response", foundationServiceSource],
  ["outline web response", outlineServiceSource],
  ["foundation API result", foundationApiSource],
  ["outline API result", outlineApiSource],
] as const) {
  assert.match(source, /creditCost/, `${label} must expose creditCost`);
  assert.match(source, /creditBalance/, `${label} must expose creditBalance`);
  assert.match(source, /idempotentReplay/, `${label} must expose idempotentReplay`);
}

console.log("PASS Phase 7/9 credit transparency UI contracts");
