import assert from "node:assert/strict";
import { buildRetrievalQueryText, retrieveRelevantDraftMemory } from "../src/services/import/retrieval-query.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("buildRetrievalQueryText combines beat context",()=>{
  const text=buildRetrievalQueryText({chapterTitle:"Ch5",chapterPurpose:null,beatTitle:"The Fight",beatSummary:"Hero fights villain",beatDirection:"Keep tension high",mustInclude:["sword"],relevantCharacterNames:["Hero"],activeOpenLoopQuestions:["Who wins?"]});
  assert.ok(text.includes("Ch5"));
  assert.ok(text.includes("The Fight"));
  assert.ok(text.includes("sword"));
  assert.ok(text.includes("Hero"));
  assert.ok(text.includes("Who wins?"));
});
t("retrieveRelevantDraftMemory returns empty array when no embedding service",async()=>{
  const result=await retrieveRelevantDraftMemory();
  assert.equal(Array.isArray(result),true);
  assert.equal(result.length,0);
});
console.log("\n=== Retrieval Query ===\n  Passed: "+p+"\n  Failed: "+f+"\n=======================\n");
process.exit(f>0?1:0);
