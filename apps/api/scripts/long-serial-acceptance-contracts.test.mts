import assert from "node:assert/strict";
import {
  createFixturePacket,
  fixtureStateRows,
  FIXTURE_CHAPTER_COUNT,
  FIXTURE_KNOWLEDGE_TRANSITIONS,
  FIXTURE_OPEN_LOOPS,
  FIXTURE_RELATIONSHIP_EVENTS,
  FIXTURE_REVEAL_CHAPTER,
} from "./fixtures/long-serial-30-chapters-fixture.data.js";
import { assertWriterPacketSafe } from "../src/services/context-packet-safety.js";
import { serializeContext } from "../src/services/writer-context-serializer.js";
import { normalizeCanonFacts } from "../src/services/writer-context-normalizer.js";
import { getLatestStateAtChapter } from "../src/services/character-state.js";
import { buildKnowledgeConstraints } from "../src/services/character-knowledge.js";
import { selectPrecedingProseTailFromRows } from "../src/services/preceding-prose-context.js";

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

t("state snapshot selects latest state at or before chapter",()=>{
  assert.equal(getLatestStateAtChapter(fixtureStateRows(), 13)?.chapterNumber, 8);
  assert.equal(getLatestStateAtChapter(fixtureStateRows(), 14)?.physicalState, "pergelangan kaki masih nyeri");
  assert.equal(getLatestStateAtChapter(fixtureStateRows(), 15)?.physicalState, "pulih");
});

t("fixture includes required knowledge, false belief, relationship, location, and payoff transitions",()=>{
  assert.ok(FIXTURE_KNOWLEDGE_TRANSITIONS.length >= 4);
  assert.ok(createFixturePacket(5).continuity.povKnowledge.falseBeliefs.length >= 2);
  assert.ok(FIXTURE_RELATIONSHIP_EVENTS.some(event=>event.chapter===12));
  assert.ok(new Set(fixtureStateRows().map(row=>row.location_label)).size >= 4);
  assert.ok(FIXTURE_OPEN_LOOPS.every(loop=>loop.payoff>loop.opened));
});

t("unknown facts compile as forbidden, never certain knowledge",()=>{
  const constraints=buildKnowledgeConstraints(
    "char-nadira",
    [{fact_id:"fact-known",knowledge_status:"knows"}],
    [{id:"fact-known",text:"Nadira menikah lima tahun lalu"},{id:"fact-unknown",text:"Future truth"}],
  );
  assert.equal(constraints.find(item=>item.factId==="fact-unknown")?.allowedMode,"forbidden");
});

t("preceding prose selects current immediate predecessor and rejects non-current version",()=>{
  const tail=selectPrecedingProseTailFromRows([
    {id:"old",proseText:"VERSI SALAH",isCurrent:false,chapterOutlineId:"chapter-2",chapterNumber:2,beatId:"beat-1",beatNumber:1},
    {id:"current",proseText:"VERSI CURRENT",isCurrent:true,chapterOutlineId:"chapter-2",chapterNumber:2,beatId:"beat-1",beatNumber:1},
  ],{
    currentChapterOutlineId:"chapter-2",
    previousChapterOutlineId:"chapter-1",
    previousChapterNumber:1,
    currentBeatId:"beat-2",
    currentBeatNumber:2,
    currentChapterNumber:2,
  });
  assert.equal(tail?.sourceVersionId,"current");
  assert.equal(tail?.text,"VERSI CURRENT");
});

t("first beat can use last current prose from previous chapter",()=>{
  const tail=selectPrecedingProseTailFromRows([
    {id:"prev-1",proseText:"beat pertama",isCurrent:true,chapterOutlineId:"chapter-1",chapterNumber:1,beatId:"beat-1-1",beatNumber:1},
    {id:"prev-last",proseText:"beat terakhir",isCurrent:true,chapterOutlineId:"chapter-1",chapterNumber:1,beatId:"beat-1-3",beatNumber:3},
  ],{
    currentChapterOutlineId:"chapter-2",
    previousChapterOutlineId:"chapter-1",
    previousChapterNumber:1,
    currentBeatId:"beat-2-1",
    currentBeatNumber:1,
    currentChapterNumber:2,
  });
  assert.equal(tail?.sourceVersionId,"prev-last");
});

t("retrieval memory remains labeled context-only",()=>{
  const packet=createFixturePacket(10);
  assert.ok(packet.continuity.retrievalMemory.every(item=>item.readOnly&&item.usage==="context_only"));
  assert.match(serializeContext(packet,"conservative").text,/CONTEXT ONLY/);
});

console.log("\n=== Long Serial Acceptance ===\n  Passed: "+p+"\n  Failed: "+f+"\n==============================\n");
process.exit(f>0?1:0);
