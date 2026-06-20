import assert from "node:assert/strict";
import { validateRevealLeak } from "../src/services/validators/reveal-validator.js";
import { validateBeatCompliance } from "../src/services/validators/beat-compliance-validator.js";
import { validateMobileReadability } from "../src/services/validators/mobile-readability-validator.js";
import type { WriterSafetyEnvelope } from "@vibenovel/shared";
let p=0,f=0;
function t(n:string,fn:()=>void){try{fn();p++;console.log(`  ✓ ${n}`)}catch(e){f++;console.log(`  ✗ ${n}`);console.error(`      ${e instanceof assert.AssertionError?e.message:e}`)}}
const env:WriterSafetyEnvelope={version:"writer_safety_v1",projectId:"p1",chapterOutlineId:"co1",chapterNumber:1,beatId:null,futureRevealFactIds:[],forbiddenRevealPhrases:["secret"],unknownFactConstraints:[],hardBeatConstraints:{mustInclude:[],mustNotInclude:[],stopCondition:null}};
t("revealValidator detects forbidden phrase",()=>{
  const r=validateRevealLeak("the secret is out there",env);
  assert.ok(r!==null);
  assert.equal(r!.type,"blocked");
});
t("beatCompliance detects missing mustInclude",()=>{
  const r=validateBeatCompliance("hello",["world"],[]);
  assert.equal(r.length,1);
  assert.equal(r[0].type,"warning");
});
t("mobileReadability flags long paragraphs",()=>{
  const longText="word ".repeat(200);
  const r=validateMobileReadability(longText);
  assert.ok(r.length>0);
});
console.log(`\n=== Validator Pipeline ===\n  Passed: ${p}\n  Failed: ${f}\n==========================\n`);
process.exit(f>0?1:0);
