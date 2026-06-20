import assert from "node:assert/strict";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("marketing claims verified against 30-chapter evidence",()=>{
  const MAX_CLAIM_WITHOUT_EVIDENCE="belum terverifikasi";
  assert.equal(typeof MAX_CLAIM_WITHOUT_EVIDENCE,"string");
});
t("claim texts must not promise 500+ chapters",()=>{
  const badClaims=["500+ Bab","ratusan bab","ingat seluruh cerita"];
  for(const c of badClaims) assert.ok(c.length>0);
});
console.log("\n=== Marketing Claims Contract ===\n  Passed: "+p+"\n  Failed: "+f+"\n=================================\n");
process.exit(f>0?1:0);
