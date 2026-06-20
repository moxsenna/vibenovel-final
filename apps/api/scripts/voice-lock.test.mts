import assert from "node:assert/strict";
import { DEFAULT_STYLE_RULES } from "../src/services/style-profile.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("voice lock has default rules",()=>assert.ok(DEFAULT_STYLE_RULES.paragraphLength==="medium"));
console.log("\n=== Voice Lock ===\n  Passed: "+p+"\n  Failed: "+f+"\n===================\n");
process.exit(f>0?1:0);
