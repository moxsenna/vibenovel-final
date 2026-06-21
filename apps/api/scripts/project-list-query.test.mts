import assert from "node:assert/strict";
import { parseListProjectsQueryOptions } from "../src/services/project.ts";

assert.equal(parseListProjectsQueryOptions({}), null);
assert.equal(parseListProjectsQueryOptions({ limit: "" }), null);

const page = parseListProjectsQueryOptions({
  limit: "12",
  q: "  cerita  ",
  status: "draft,in_progress,bogus",
  sort: "title",
  order: "asc",
  includeArchived: "true",
});
assert.ok(page);
assert.equal(page.limit, 12);
assert.equal(page.offset, 0);
assert.equal(page.q, "cerita");
assert.deepEqual(page.status, ["draft", "in_progress"]);
assert.equal(page.sort, "title");
assert.equal(page.order, "asc");
assert.equal(page.includeArchived, true);

const cursorPage = parseListProjectsQueryOptions({ limit: "6", offset: "24" });
assert.ok(cursorPage);
assert.equal(cursorPage.offset, 24);

console.log("PASS project list query parse (doc 113 A2)");