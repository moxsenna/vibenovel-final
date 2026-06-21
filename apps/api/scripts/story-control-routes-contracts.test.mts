import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseStyleProfileUpdate } from "../src/routes/story-control.js";

const parsed = parseStyleProfileUpdate({
  confirmation: "UPDATE_STYLE_PROFILE",
  operationalRules: {
    paragraphLength: "short",
    averageSentenceWords: 11,
    dialogueDensity: "high",
    narrationStyle: ["close POV"],
    forbiddenStyle: ["head hopping"],
    signatureMoves: ["compressed ending"],
    expositionTolerance: "low",
    metaphorDensity: "medium",
    endingRhythm: ["cliffhanger"],
  },
});

assert.equal(parsed.source, "manual_story_control");
assert.equal(parsed.operationalRules.paragraphLength, "short");
assert.deepEqual(parsed.operationalRules.forbiddenStyle, ["head hopping"]);
assert.throws(() =>
  parseStyleProfileUpdate({
    operationalRules: {},
  }),
);

const routesIndex = readFileSync("src/routes/index.ts", "utf8");
assert.match(routesIndex, /registerStoryControlRoutes\(app\)/);

const routeSource = readFileSync("src/routes/story-control.ts", "utf8");
assert.match(routeSource, /getStyleProfileForOwner/);
assert.match(routeSource, /upsertStyleProfileForOwner/);
assert.match(routeSource, /UPDATE_STYLE_PROFILE/);
assert.match(routeSource, /style_profile_updated/);
assert.doesNotMatch(routeSource, /planning_truth/);

const outlineRoutes = readFileSync("src/routes/outline.ts", "utf8");
assert.match(outlineRoutes, /UPDATE_PLANNING_TRUTH/);
assert.match(outlineRoutes, /delete sanitizedBody\.confirmation/);

console.log("PASS story control API and secret-write boundary contracts");
