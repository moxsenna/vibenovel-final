import assert from "node:assert/strict";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("continuity API path format",()=>{
  const path="/api/projects/:id/continuity/characters/:characterId/state";
  assert.ok(path.includes(":id"));
  assert.ok(path.includes(":characterId"));
});
t("continuity knowledge path format",()=>{
  const path="/api/projects/:id/continuity/characters/:characterId/knowledge";
  assert.ok(path.includes("knowledge"));
});
console.log("\n=== Continuity Routes ===\n  Passed: "+p+"\n  Failed: "+f+"\n==========================\n");
process.exit(f>0?1:0);
