import assert from "node:assert/strict";
import { createFixturePacket, FIXTURE_CHAPTER_COUNT, FIXTURE_REVEAL_CHAPTER } from "./fixtures/long-serial-30-chapters-fixture.data.js";
import { assertWriterPacketSafe } from "../src/services/context-packet-safety.js";
import { serializeContext } from "../src/services/writer-context-serializer.js";
import { normalizeCanonFacts } from "../src/services/writer-context-normalizer.js";

let p=0,f=0;
function t(n,fn){try{fn();p++;console.log("  \u2713 "+n)}catch(e){f++;console.log("  \u2717 "+n);console.error("      "+(e instanceof assert.AssertionError?e.message:e))}}

t("fixture has 30 chapters",()=>{
  assert.equal(FIXTURE_CHAPTER_COUNT,30);
  assert.equal(FIXTURE_REVEAL_CHAPTER,25);
});

t("chapters 1-24 have no future truth in packet",()=>{
  for(let i=1;i<25;i++){
    const packet=createFixturePacket(i);
    assert.equal(JSON.stringify(packet).includes("anak rahasia di masa lalu"),false,
      `chapter ${i} should not contain future reveal truth`);
  }
});

t("chapter 25 has allowed reveal",()=>{
  const packet=createFixturePacket(25);
  assert.ok(packet.revealGate.allowedReveals.length>0,
    "chapter 25 should have allowed reveals");
  assert.equal(packet.revealGate.forbiddenReveals.length,0,
    "chapter 25 should have no forbidden reveals");
});

t("each chapter serializer output is within conservative budget",()=>{
  for(let i=1;i<=FIXTURE_CHAPTER_COUNT;i++){
    const packet=createFixturePacket(i);
    const result=serializeContext(packet,"conservative");
    assert.ok(result.text.length<=17800,
      `chapter ${i}: ${result.text.length} > 17800`);
  }
});

t("normalizeCanonFacts converts all fixture facts",()=>{
  const packet=createFixturePacket(1);
  const facts=normalizeCanonFacts(packet);
  assert.ok(facts.length>=2);
  assert.ok(facts.some(f=>f.id.startsWith("legacy:")));
});

t("all 30 packets pass safety checks",()=>{
  for(let i=1;i<=FIXTURE_CHAPTER_COUNT;i++){
    const packet=createFixturePacket(i);
    assert.doesNotThrow(()=>{
      assertWriterPacketSafe(packet,{
        currentChapterNumber:i,
        futureChapterSummaries:[],
        futureChapterTitles:[],
      });
    },`chapter ${i} failed safety check`);
  }
});

console.log("\n=== Long Serial Acceptance ===\n  Passed: "+p+"\n  Failed: "+f+"\n==============================\n");
process.exit(f>0?1:0);
