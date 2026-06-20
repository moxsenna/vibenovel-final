import assert from "node:assert/strict";
import { createStyleFeedback } from "../src/services/style-feedback.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("style feedback exists",()=>assert.equal(typeof createStyleFeedback,"function"));
console.log("\n=== Style Feedback ===\n  Passed: "+p+"\n  Failed: "+f+"\n=======================\n");
process.exit(f>0?1:0);
