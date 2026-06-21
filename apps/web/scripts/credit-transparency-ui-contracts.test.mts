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
const hookFallbackSource = readFileSync(
  new URL("../src/lib/hook-fallback.ts", import.meta.url),
  "utf8",
);
assert.match(
  hookFallbackSource,
  /Kredit tidak terpakai atau sudah dikembalikan otomatis\./,
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

console.log("PASS Phase 7/9 credit transparency UI contracts");
