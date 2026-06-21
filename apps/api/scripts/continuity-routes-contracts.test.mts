import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseContinuityKnowledgeUpdate,
  parseContinuityStateUpdate,
} from "../src/routes/continuity.js";

const state = parseContinuityStateUpdate({
  confirmation: "UPDATE_CONTINUITY_STATE",
  chapterNumber: 4,
  emotionalState: "cemas",
  physicalState: "terluka",
});
assert.equal(state.chapterNumber, 4);
assert.equal(state.physicalState, "terluka");
assert.throws(() => parseContinuityStateUpdate({ chapterNumber: 4 }));
assert.throws(() =>
  parseContinuityStateUpdate({
    confirmation: "UPDATE_CONTINUITY_STATE",
    chapterNumber: 0,
  }),
);

const knowledge = parseContinuityKnowledgeUpdate({
  confirmation: "UPDATE_CONTINUITY_KNOWLEDGE",
  knowledgeStatus: "suspects",
  confidence: 0.6,
  learnedAtChapter: 3,
});
assert.equal(knowledge.knowledgeStatus, "suspects");
assert.equal(knowledge.confidence, 0.6);
assert.throws(() =>
  parseContinuityKnowledgeUpdate({
    confirmation: "UPDATE_CONTINUITY_KNOWLEDGE",
    knowledgeStatus: "invented",
  }),
);

const routesIndex = readFileSync("src/routes/index.ts", "utf8");
assert.match(routesIndex, /registerContinuityRoutes\(app\)/);

const routeSource = readFileSync("src/routes/continuity.ts", "utf8");
assert.match(routeSource, /upsertCharacterStateForOwner/);
assert.match(routeSource, /upsertCharacterKnowledgeForOwner/);
assert.match(routeSource, /continuity_state_updated/);
assert.match(routeSource, /continuity_knowledge_updated/);
assert.doesNotMatch(routeSource, /Stub|return \[\]/);

console.log("PASS continuity route behavior contracts");
