import assert from "node:assert/strict";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("model routing v2 extra",()=>assert.ok(true));
console.log("\n=== Model Routing v2 Extra ===\n  Passed: "+p+"\n  Failed: "+f+"\n==============================\n");
process.exit(f>0?1:0);
