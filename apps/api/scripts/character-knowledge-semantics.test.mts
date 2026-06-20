import assert from "node:assert/strict";
import type { CharacterKnowledgeConstraint } from "@vibenovel/shared";
let p=0,f=0;
function t(n:string,fn:()=>void){try{fn();p++;console.log(`  ✓ ${n}`)}catch(e){f++;console.log(`  ✗ ${n}`);console.error(`      ${e instanceof assert.AssertionError?e.message:e}`)}}
t("CharacterKnowledgeConstraint certain mode ok",()=>{
  const c:CharacterKnowledgeConstraint={characterId:"c1",factId:"f1",factText:"test",allowedMode:"certain"};
  assert.equal(c.allowedMode,"certain");
});
t("CharacterKnowledgeConstraint forbidden mode ok",()=>{
  const c:CharacterKnowledgeConstraint={characterId:"c1",factId:"f1",factText:"test",allowedMode:"forbidden"};
  assert.equal(c.allowedMode,"forbidden");
});
console.log(`\n=== Knowledge Semantics ===\n  Passed: ${p}\n  Failed: ${f}\n===========================\n`);
process.exit(f>0?1:0);
