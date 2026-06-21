import assert from "node:assert/strict";
import {
  buildKnowledgeConstraints,
  categorizeKnowledge,
} from "../src/services/character-knowledge.js";

const facts = [
  { id: "known", text: "Nadira kidal." },
  { id: "partial", text: "Kunci disimpan di gudang timur." },
  { id: "suspect", text: "Rama bekerja untuk dewan." },
  { id: "false", text: "Sari adalah pengkhianat." },
  { id: "unknown", text: "Arman adalah ayah kandung Rama." },
];
const rows = [
  { fact_id: "known", knowledge_status: "knows" },
  { fact_id: "partial", knowledge_status: "partially_knows" },
  { fact_id: "suspect", knowledge_status: "suspects" },
  { fact_id: "false", knowledge_status: "misbelieves" },
];

const constraints = buildKnowledgeConstraints("character-1", rows, facts);
assert.equal(
  constraints.find((constraint) => constraint.factId === "known")?.allowedMode,
  "certain",
);
assert.equal(
  constraints.find((constraint) => constraint.factId === "partial")?.allowedMode,
  "partial",
);
assert.equal(
  constraints.find((constraint) => constraint.factId === "suspect")?.allowedMode,
  "suspicion",
);
assert.equal(
  constraints.find((constraint) => constraint.factId === "false")?.allowedMode,
  "false_belief",
);
assert.equal(
  constraints.find((constraint) => constraint.factId === "unknown")?.allowedMode,
  "forbidden",
);

assert.deepEqual(categorizeKnowledge(rows), {
  knownIds: ["known"],
  suspectedIds: ["suspect"],
  partialIds: ["partial"],
  falseBeliefIds: ["false"],
});

console.log("PASS character knowledge semantics");
