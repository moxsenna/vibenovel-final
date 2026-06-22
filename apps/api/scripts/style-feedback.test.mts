import assert from "node:assert/strict";
import { createStyleFeedback } from "../src/services/style-feedback.js";
let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n)}}
t("createStyleFeedback returns event with projectId",()=>{
  const ev=createStyleFeedback({projectId:"p1",sourceVersionId:"v1",editedVersionId:"v2",feedbackType:"accepted_edit",appliedToProfileVersion:null});
  assert.equal(ev.projectId,"p1");
  assert.equal(ev.feedbackType,"accepted_edit");
});
console.log("\n=== Style Feedback ===\n  Passed: "+p+"\n  Failed: "+f+"\n=======================\n");
process.exit(f>0?1:0);
