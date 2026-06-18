import assert from "node:assert/strict";
import {
  allowDeterministicStoryStubs,
  mayUseDeterministicStoryStub,
  type AppBindings,
} from "../src/env.ts";

const liveAi: AppBindings = {
  AI_GENERATION_ENABLED: "true",
  AI_PROVIDER_MOCK: "false",
};

assert.equal(allowDeterministicStoryStubs(liveAi), false);
assert.equal(mayUseDeterministicStoryStub(liveAi), false);

const explicit: AppBindings = {
  ...liveAi,
  ALLOW_DETERMINISTIC_STORY_STUBS: "true",
};
assert.equal(mayUseDeterministicStoryStub(explicit), true);

const mock: AppBindings = {
  AI_GENERATION_ENABLED: "true",
  AI_PROVIDER_MOCK: "true",
};
assert.equal(mayUseDeterministicStoryStub(mock), true);

const aiOff: AppBindings = { AI_GENERATION_ENABLED: "false" };
assert.equal(mayUseDeterministicStoryStub(aiOff), true);

console.log("PASS story-stub-policy");