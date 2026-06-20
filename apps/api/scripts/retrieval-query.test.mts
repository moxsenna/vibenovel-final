import assert from "node:assert/strict";
import { retrieveRelevantDraftMemory } from "../src/services/import/retrieval-query.js";
let p=0,f=0;
function t(n:string,fn:()=>void){try{fn();p++;console.log(`  ✓ ${n}`)}catch(e){f++;console.log(`  ✗ ${n}`);console.error(`      ${e instanceof assert.AssertionError?e.message:e}`)}}
t("retrieval query exports function",()=>{assert.equal(typeof retrieveRelevantDraftMemory,"function");});
console.log(`\n=== Retrieval Query ===\n  Passed: ${p}\n  Failed: ${f}\n=======================\n`);
process.exit(f>0?1:0);
