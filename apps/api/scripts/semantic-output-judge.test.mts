import assert from "node:assert/strict";
import { resolveSemanticJudgeMode, createEmptyJudgeResult } from "../src/services/semantic-output-judge.js";
let p=0,f=0;
function t(n:string,fn:()=>void){try{fn();p++;console.log(`  ✓ ${n}`)}catch(e){f++;console.log(`  ✗ ${n}`);console.error(`      ${e instanceof assert.AssertionError?e.message:e}`)}}
t("judge mode off is default",()=>{assert.equal(resolveSemanticJudgeMode(undefined),"off");});
t("judge mode enforce works",()=>{assert.equal(resolveSemanticJudgeMode("enforce"),"enforce");});
t("judge mode shadow works",()=>{assert.equal(resolveSemanticJudgeMode("shadow"),"shadow");});
t("empty judge result has score 1",()=>{assert.equal(createEmptyJudgeResult().instructionCompliance.score,1);});
console.log(`\n=== Semantic Output Judge ===\n  Passed: ${p}\n  Failed: ${f}\n=============================\n`);
process.exit(f>0?1:0);
