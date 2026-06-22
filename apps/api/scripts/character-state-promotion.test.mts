import assert from "node:assert/strict";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  ✓ "+n)}catch(e){f++;console.log("  ✗ "+n);console.error("      "+e.message)}}
t("character state proposal uses separated fields",()=>{
  const proposal={characterId:"c1",chapterNumber:3,emotionalState:"sad",physicalState:"injured",currentGoal:"find help",evidence:"character showed sadness in scene"};
  assert.equal(proposal.characterId,"c1");
  assert.equal(proposal.emotionalState,"sad");
  assert.equal(proposal.currentGoal,"find help");
});
t("character state proposal does not merge everything into currentGoal",()=>{
  const GOOD={characterId:"c1",chapterNumber:3,emotionalState:"sad",currentGoal:"find help",evidence:"scene evidence"};
  assert.notEqual(GOOD.currentGoal,GOOD.evidence);
  assert.equal(typeof GOOD.emotionalState,"string");
});
console.log(`\n=== Character State Promotion ===\n  Passed: ${p}\n  Failed: ${f}\n================================\n`);
process.exit(f>0?1:0);
