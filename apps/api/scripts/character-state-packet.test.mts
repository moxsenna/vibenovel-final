/**
 * Character State Packet — contract tests.
 * Verifikasi relevant character selection dan state snapshot di packet.
 * Run: npm run test:character-state-packet -w @vibenovel/api
 */
import assert from "node:assert/strict";
import { selectRelevantCharacters } from "../src/services/relevant-character-selector.js";
import type { CharacterSafeSummary } from "@vibenovel/shared";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}`); console.error(`      ${e instanceof assert.AssertionError ? e.message : e}`); }
}

const chars: CharacterSafeSummary[] = [
  { id: "c1", name: "Nadira", roleLabel: "Protagonis", descriptionSummary: "Main character" },
  { id: "c2", name: "Rama", roleLabel: "Antagonis", descriptionSummary: "Villain" },
  { id: "c3", name: "Sari", roleLabel: "Sahabat", descriptionSummary: "Best friend" },
  { id: "c4", name: "Budi", roleLabel: "Figuran", descriptionSummary: "Side character" },
  { id: "c5", name: "Dewi", roleLabel: "Mentor", descriptionSummary: "Guide" },
  { id: "c6", name: "Joko", roleLabel: "Figuran", descriptionSummary: "Extra" },
  { id: "c7", name: "Rina", roleLabel: "Figuran", descriptionSummary: "Extra" },
  { id: "c8", name: "Tono", roleLabel: "Figuran", descriptionSummary: "Extra" },
  { id: "c9", name: "Wati", roleLabel: "Figuran", descriptionSummary: "Extra beyond max" },
];

test("selectRelevantCharacters includes POV character first", () => {
  const result = selectRelevantCharacters({ povCharacterId: "c1", mainCharacterIds: [], beatSummaryTokens: [], beatDirectionTokens: [], mustIncludeTokens: [], allCharacters: chars });
  assert.ok(result.some(c => c.id === "c1"));
  assert.equal(result[0].id, "c1");
});

test("selectRelevantCharacters includes main characters", () => {
  const result = selectRelevantCharacters({ povCharacterId: null, mainCharacterIds: ["c1", "c2"], beatSummaryTokens: [], beatDirectionTokens: [], mustIncludeTokens: [], allCharacters: chars });
  assert.ok(result.some(c => c.id === "c1"));
  assert.ok(result.some(c => c.id === "c2"));
});

test("selectRelevantCharacters identifies characters by name in beat tokens", () => {
  const result = selectRelevantCharacters({ povCharacterId: "c1", mainCharacterIds: [], beatSummaryTokens: ["Sari enters the room"], beatDirectionTokens: [], mustIncludeTokens: [], allCharacters: chars });
  assert.ok(result.some(c => c.id === "c3"), "Sari should be selected from beat token");
});

test("selectRelevantCharacters caps at 8", () => {
  const result = selectRelevantCharacters({ povCharacterId: "c1", mainCharacterIds: ["c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"], beatSummaryTokens: [], beatDirectionTokens: [], mustIncludeTokens: [], allCharacters: chars });
  assert.ok(result.length <= 8);
});

console.log(`\n=== Character State Packet ===\n  Passed: ${passed}\n  Failed: ${failed}\n============================\n`);
process.exit(failed > 0 ? 1 : 0);
