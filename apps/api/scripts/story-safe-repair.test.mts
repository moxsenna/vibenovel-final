import assert from "node:assert/strict";
import { createRepairPlan, shouldContinueRepair } from "../src/services/safe-repair.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("createRepairPlan sets max 2 retries",()=>{
  const plan=createRepairPlan({passed:false,blocked:["test"],warnings:[]},0);
  assert.equal(plan.maxRetries,2);
});
t("shouldContinueRepair stops after 2 attempts",()=>{
  assert.ok(shouldContinueRepair(0));
  assert.ok(shouldContinueRepair(1));
  assert.equal(shouldContinueRepair(2),false);
});
console.log("\n=== Story Safe Repair ===\n  Passed: "+p+"\n  Failed: "+f+"\n=========================\n");
process.exit(f>0?1:0);
