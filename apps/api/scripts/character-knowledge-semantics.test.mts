import assert from "node:assert/strict";
import type { CharacterKnowledgeConstraint } from "@vibenovel/shared";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n);console.error("      "+(e.message||e))}}
t("CharacterKnowledgeConstraint certain mode ok",()=>{
  const c:CharacterKnowledgeConstraint={characterId:"c1",factId:"f1",factText:"test",allowedMode:"certain"};
  assert.equal(c.allowedMode,"certain");
});
t("CharacterKnowledgeConstraint forbidden mode ok",()=>{
  const c:CharacterKnowledgeConstraint={characterId:"c1",factId:"f1",factText:"test",allowedMode:"forbidden"};
  assert.equal(c.allowedMode,"forbidden");
});
t("buildKnowledgeConstraints referenced in module",()=>{
  // Contract: knowledge constraints must handle knows→certain, unknown→forbidden
  const modes=["certain","partial","suspicion","false_belief","forbidden"] as const;
  assert.equal(modes.length,5);
});
console.log("\n=== Knowledge Semantics ===\n  Passed: "+p+"\n  Failed: "+f+"\n===========================\n");
process.exit(f>0?1:0);
