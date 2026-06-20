import assert from "node:assert/strict";
import type { WriterPrecedingProseTail } from "@vibenovel/shared";
let p=0,f=0;
function t(n:string,fn:()=>void){try{fn();p++;console.log(`  ✓ ${n}`)}catch(e){f++;console.log(`  ✗ ${n}`);console.error(`      ${e instanceof assert.AssertionError?e.message:e}`)}}
t("WriterPrecedingProseTail works",()=>{
  const tail:WriterPrecedingProseTail={text:"hello",sourceChapterNumber:1,sourceBeatId:"b1",sourceVersionId:"v1",sourceType:"same_chapter_previous_beat"};
  assert.equal(tail.sourceType,"same_chapter_previous_beat");
});
console.log(`\n=== Entity Resolution ===\n  Passed: ${p}\n  Failed: ${f}\n=========================\n`);
process.exit(f>0?1:0);
