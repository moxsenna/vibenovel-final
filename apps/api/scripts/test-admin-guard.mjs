import assert from "node:assert/strict";
import { USER_ROLES } from "@vibenovel/shared";

const ROLE_RANK = {
  [USER_ROLES.writer]: 0,
  [USER_ROLES.admin]: 1,
  [USER_ROLES.super_admin]: 2,
};

function roleSatisfies(actorRole, minRole) {
  const actorRank = ROLE_RANK[actorRole ?? USER_ROLES.writer] ?? 0;
  const requiredRank = ROLE_RANK[minRole] ?? 1;
  return actorRank >= requiredRank;
}

assert.equal(roleSatisfies(USER_ROLES.writer, "admin"), false);
assert.equal(roleSatisfies(USER_ROLES.admin, "admin"), true);
assert.equal(roleSatisfies(USER_ROLES.super_admin, "admin"), true);
assert.equal(roleSatisfies(USER_ROLES.admin, "super_admin"), false);
assert.equal(roleSatisfies(USER_ROLES.super_admin, "super_admin"), true);

console.log("admin guard role matrix: ok");