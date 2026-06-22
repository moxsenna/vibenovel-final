import assert from "node:assert/strict";
import { matchProseEmbeddings } from "../src/services/import/semantic-retrieval.js";
let p=0,f=0;
function t(n:string,fn:()=>void){try{fn();p++;console.log(`  ✓ ${n}`)}catch(e){f++;console.log(`  ✗ ${n}`);console.error(`      ${e instanceof assert.AssertionError?e.message:e}`)}}
t("semantic retrieval exports function",()=>{assert.equal(typeof matchProseEmbeddings,"function");});
console.log(`\n=== Semantic Retrieval ===\n  Passed: ${p}\n  Failed: ${f}\n==========================\n`);
process.exit(f>0?1:0);
