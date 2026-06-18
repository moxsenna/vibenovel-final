import assert from "node:assert/strict";
import { CHARACTER_KNOWLEDGE_STATUSES } from "@vibenovel/shared";
import { collectPovForbiddenFactTexts } from "../src/services/character-knowledge-validator.ts";
import { validateAiOutput } from "../src/services/output-validator.ts";

const facts = [
  { id: "f-known", text: "Nadira tahu resep keluarga turun temurun dari neneknya." },
  { id: "f-secret", text: "Arman menyimpan surat lama dari Siska di laci meja kerja." },
];

const pov = {
  characterId: "char-nadira",
  knownFacts: [
    {
      factId: "f-known",
      text: facts[0].text,
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.knows,
      confidence: null,
      learnedAtChapter: 1,
    },
  ],
  suspectedFacts: [],
  partialFacts: [],
  falseBeliefs: [],
  unknownFactCount: 1,
};

const forbidden = collectPovForbiddenFactTexts(facts, pov);
assert.ok(forbidden.some((p) => p.includes("Siska")));

const safe = validateAiOutput({
  outputText: "Nadira mengaduk sup dengan tenang di dapur.",
  povForbiddenFactTexts: forbidden,
});
assert.equal(safe.allowed, true);

const leak = validateAiOutput({
  outputText:
    "Nadira menemukan bahwa Arman menyimpan surat lama dari Siska di laci meja kerja.",
  povForbiddenFactTexts: forbidden,
});
assert.equal(leak.allowed, false);
assert.ok(leak.checks.some((c) => c.key === "pov_character_knowledge" && !c.passed));

console.log("PASS character knowledge validator contracts");