import assert from "node:assert/strict";
import { DEFAULT_STYLE_RULES } from "../src/services/style-profile.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("style profile has defaults",()=>assert.ok(DEFAULT_STYLE_RULES.paragraphLength==="medium"));
console.log("\n=== Style Profile Contracts ===\n  Passed: "+p+"\n  Failed: "+f+"\n================================\n");
process.exit(f>0?1:0);
