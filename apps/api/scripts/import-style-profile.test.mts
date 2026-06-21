import assert from "node:assert/strict";
import {
  buildAuthorVoiceProposalDraft,
  extractAuthorVoiceFromDraft,
  extractOperationalRules,
} from "../src/services/import/style-extraction.js";

const prose = [
  '"Jangan pergi," kata Nadira.',
  "",
  "Rama menutup pintu.",
  "",
  '"Aku akan kembali."',
].join("\n");

const rules = extractOperationalRules(prose);
assert.equal(rules.paragraphLength, "short");
assert.ok((rules.averageSentenceWords ?? 0) > 0);
assert.equal(rules.dialogueDensity, "high");

const extraction = extractAuthorVoiceFromDraft({
  draftImportId: "import-1",
  content: prose,
  chunks: [],
});
assert.deepEqual(extraction.operationalRules, rules);

const proposal = buildAuthorVoiceProposalDraft({
  projectId: "project-1",
  draftImportId: "import-1",
  authorVoice: extraction,
});
assert.ok(proposal.payload.operationalRules);
assert.equal(proposal.payload.extractionMode, "proposal_only");

console.log("PASS imported voice becomes operational style rules");
