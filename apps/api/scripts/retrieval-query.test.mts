import assert from "node:assert/strict";
import {
  buildRetrievalQueryText,
  retrieveRelevantDraftMemory,
} from "../src/services/import/retrieval-query.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${name}`);
    console.error(error);
  }
}

const input = {
  chapterTitle: "Ch5",
  chapterPurpose: null,
  beatTitle: "The Fight",
  beatSummary: "Hero fights villain",
  beatDirection: "Keep tension high",
  mustInclude: ["sword"],
  relevantCharacterNames: ["Hero"],
  activeOpenLoopQuestions: ["Who wins?"],
};

await test("buildRetrievalQueryText combines active beat context", () => {
  const text = buildRetrievalQueryText(input);
  for (const expected of ["Ch5", "The Fight", "sword", "Hero", "Who wins?"]) {
    assert.match(text, new RegExp(expected.replace(/[?]/g, "\\?")));
  }
});

await test("retrieval embeds query and forwards owner/project scope to matcher", async () => {
  let embeddedText = "";
  let matchScope = "";
  const snippets = await retrieveRelevantDraftMemory(
    {} as never,
    "owner-1",
    "project-1",
    input,
    {
      embedText: async (_bindings, text) => {
        embeddedText = text;
        return [0.1, 0.2, 0.3];
      },
      match: async (_bindings, ownerId, projectId, embedding) => {
        matchScope = `${ownerId}:${projectId}:${embedding.length}`;
        return [
          {
            sourceRef: "draft:1",
            chunkText: "Relevant memory",
            similarity: 0.92,
            metadata: {},
          },
        ];
      },
    },
  );
  assert.match(embeddedText, /Hero fights villain/);
  assert.equal(matchScope, "owner-1:project-1:3");
  assert.equal(snippets[0]?.sourceRef, "draft:1");
});

await test("retrieval skips RPC when embedding is unavailable", async () => {
  let matcherCalled = false;
  const snippets = await retrieveRelevantDraftMemory(
    {} as never,
    "owner-1",
    "project-1",
    input,
    {
      embedText: async () => null,
      match: async () => {
        matcherCalled = true;
        return [];
      },
    },
  );
  assert.deepEqual(snippets, []);
  assert.equal(matcherCalled, false);
});

console.log(
  `\n=== Retrieval Query ===\n  Passed: ${passed}\n  Failed: ${failed}\n=======================\n`,
);
process.exit(failed > 0 ? 1 : 0);
