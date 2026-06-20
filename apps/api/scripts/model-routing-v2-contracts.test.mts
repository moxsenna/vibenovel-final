import assert from "node:assert/strict";
import { resolveSemanticJudgeMode } from "../src/services/semantic-output-judge.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("judge default mode is off",()=>assert.equal(resolveSemanticJudgeMode(undefined),"off"));
t("judge enforce mode works",()=>assert.equal(resolveSemanticJudgeMode("enforce"),"enforce"));
console.log("\n=== Model Routing v2 ===\n  Passed: "+p+"\n  Failed: "+f+"\n=========================\n");
process.exit(f>0?1:0);
