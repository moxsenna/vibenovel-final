import assert from "node:assert/strict";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("advanced controls shape",()=>{
  const controls={targetChapterCount:10,revealDensity:"sedang",retentionIntensity:"seimbang",proseStyleTarget:"emosional"};
  assert.equal(controls.targetChapterCount,10);
  assert.ok(["rendah","sedang","padat"].includes(controls.revealDensity));
});
console.log("\n=== Advanced Outline Controls ===\n  Passed: "+p+"\n  Failed: "+f+"\n================================\n");
process.exit(f>0?1:0);
