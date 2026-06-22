import assert from "node:assert/strict";
import { extractOperationalRules } from "../src/services/import/style-extraction.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("extractOperationalRules returns default rules",()=>{
  const rules=extractOperationalRules();
  assert.equal(rules.paragraphLength,"medium");
  assert.equal(typeof rules.dialogueDensity,"string");
});
console.log("\n=== Import Style Profile ===\n  Passed: "+p+"\n  Failed: "+f+"\n============================\n");
process.exit(f>0?1:0);
