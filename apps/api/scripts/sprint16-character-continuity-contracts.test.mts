import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AI_PROPOSAL_TYPES,
  CHARACTER_KNOWLEDGE_STATUSES,
  CHAPTER_SUMMARY_ITEM_TYPES,
  type PovKnowledgeSnapshot,
  type WriterContextPacket,
} from "@vibenovel/shared";
import {
  mapLinkedProposalSummary,
  type AiProposalRow,
  type ChapterSummaryItemRow,
  type ChapterSummaryProposalRow,
  type ChapterSummaryRow,
} from "../src/lib/mappers.ts";
import { buildPreviewFromPacket } from "../src/services/context-packet-builder.ts";
import {
  buildPovKnowledgeSnapshot,
  type PovKnowledgeFactInput,
} from "../src/services/character-knowledge.ts";
import { extractChapterDeltaStub } from "../src/services/chapter-delta-extractor.ts";
import { preflightPromotionToCanon } from "../src/services/proposal-canon-promotion.ts";

const textOf = (items: { text: string }[]) => items.map((item) => item.text);

assert.deepEqual(Object.values(CHARACTER_KNOWLEDGE_STATUSES), [
  "unknown",
  "suspects",
  "partially_knows",
  "knows",
  "misbelieves",
]);
assert.equal(AI_PROPOSAL_TYPES.character_state_update, "character_state_update");
assert.equal(AI_PROPOSAL_TYPES.character_knowledge_update, "character_knowledge_update");

{
  const facts = [
    { id: "fact-known", text: "Nadira knows the letter was moved." },
    { id: "fact-secret", text: "Siska is Bima's hidden sibling." },
    { id: "fact-suspect", text: "Bima may be hiding a second phone." },
    { id: "fact-partial", text: "The burned photo is connected to Siska." },
    { id: "fact-false", text: "Nadira believes Raka sent the threat." },
    { id: "fact-explicit-unknown", text: "The lawyer already switched the will." },
    { id: "fact-no-row", text: "The key was copied before the wedding." },
  ];

  const knowledgeRows: PovKnowledgeFactInput[] = [
    {
      characterId: "char-pov",
      factId: "fact-known",
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.knows,
      confidence: 1,
      learnedAtChapter: 2,
      learnedFrom: "chapter_2",
    },
    {
      characterId: "char-pov",
      factId: "fact-secret",
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.knows,
      confidence: 1,
      learnedAtChapter: 1,
      learnedFrom: "internal_state",
    },
    {
      characterId: "char-pov",
      factId: "fact-suspect",
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.suspects,
      confidence: 0.6,
      learnedAtChapter: 3,
      learnedFrom: "chapter_3",
    },
    {
      characterId: "char-pov",
      factId: "fact-partial",
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.partially_knows,
      confidence: 0.4,
      learnedAtChapter: 3,
      learnedFrom: "chapter_3",
    },
    {
      characterId: "char-pov",
      factId: "fact-false",
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.misbelieves,
      confidence: 0.8,
      learnedAtChapter: 4,
      learnedFrom: "misdirection",
    },
    {
      characterId: "char-pov",
      factId: "fact-explicit-unknown",
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.unknown,
      confidence: null,
      learnedAtChapter: null,
      learnedFrom: null,
    },
    {
      characterId: "char-other",
      factId: "fact-known",
      knowledgeStatus: CHARACTER_KNOWLEDGE_STATUSES.unknown,
      confidence: null,
      learnedAtChapter: null,
      learnedFrom: null,
    },
  ];

  const snapshot: PovKnowledgeSnapshot = buildPovKnowledgeSnapshot({
    povCharacterId: "char-pov",
    facts,
    knowledgeRows,
    futureRevealFactIds: new Set(["fact-secret"]),
  });

  assert.equal(snapshot.characterId, "char-pov");
  assert.deepEqual(textOf(snapshot.knownFacts), ["Nadira knows the letter was moved."]);
  assert.deepEqual(textOf(snapshot.suspectedFacts), ["Bima may be hiding a second phone."]);
  assert.deepEqual(textOf(snapshot.partialFacts), [
    "The burned photo is connected to Siska.",
  ]);
  assert.deepEqual(textOf(snapshot.falseBeliefs), ["Nadira believes Raka sent the threat."]);
  assert.equal(
    snapshot.unknownFactCount,
    2,
    "unknown count covers safe unknown facts without leaking future-secret fact text",
  );
  assert.ok(
    !JSON.stringify(snapshot).includes("hidden sibling"),
    "future reveal facts stay out of povKnowledge even when the POV row says knows",
  );
}

{
  const packet = {
    meta: {
      projectId: "project-1",
      chapterOutlineId: "chapter-1",
      chapterNumber: 4,
      builderVersion: "context_packet_v1_stub",
      packetHash: "hash",
      generatedAt: "2026-06-15T00:00:00.000Z",
    },
    foundation: {
      premiseSummary: "Premise",
      mainConflictSummary: "Conflict",
      readerPromise: "Promise",
      tone: null,
      storySecretsPreview: null,
    },
    concept: { title: "Concept", shortPitch: "Pitch", readerPromise: null },
    canon: { characters: [], facts: [], speechRules: [] },
    currentChapter: {
      title: "Bab 4",
      summary: "Summary",
      purpose: "Purpose",
      chapterFunction: "conflict",
      emotionalDirection: null,
      endingHook: null,
      miniVictory: null,
      hook: null,
      markers: [],
    },
    continuity: {
      previousChapterSummaries: [],
      openLoopsActive: [],
      unresolvedThreadLabels: [],
      recentTimeline: [],
      povKnowledge: {
        characterId: "char-pov",
        knownFacts: [{ factId: "fact-1", text: "Known fact", confidence: 1, learnedAtChapter: 2 }],
        suspectedFacts: [
          { factId: "fact-2", text: "Suspected fact", confidence: 0.5, learnedAtChapter: 3 },
        ],
        partialFacts: [],
        falseBeliefs: [],
        unknownFactCount: 1,
      },
    },
    revealGate: {
      allowedBreadcrumbs: [],
      allowedReveals: [],
      forbiddenReveals: [],
      forbiddenConcepts: [],
    },
    emotionalTarget: { chapterEmotion: null, beatEmotionalShift: null },
    hookTarget: { chapterEndingHook: null, beatStopCondition: null },
    constraints: {
      mustInclude: [],
      mustNotInclude: [],
      wordTarget: null,
      mobileFormatRules: [],
    },
  } satisfies WriterContextPacket;

  const preview = buildPreviewFromPacket(packet, "packet-log-1");
  assert.equal(preview.povKnowledgeSummary, "POV: 1 known, 1 suspect, 0 partial, 0 false, 1 unknown");
  assert.ok(preview.storyCheckLabels.includes("POV knowledge scoped"));
}

{
  const migrationSql = readFileSync(
    "../../supabase/migrations/00016_sprint16_character_continuity.sql",
    "utf8",
  );

  for (const required of [
    "character_states",
    "character_knowledge",
    "character_knowledge_status",
    "unknown",
    "suspects",
    "partially_knows",
    "knows",
    "misbelieves",
    "enable row level security",
    "is_project_owner\\(project_id\\)",
    "character_states_project_character_chapter_idx",
    "character_knowledge_project_character_status_idx",
    "ai_proposal_type",
    "character_state_update",
    "character_knowledge_update",
  ]) {
    assert.match(migrationSql, new RegExp(required, "i"), `${required} must exist`);
  }

  assert.doesNotMatch(
    migrationSql,
    /add\s+constraint\s+if\s+not\s+exists/i,
    "Postgres migrations cannot use ADD CONSTRAINT IF NOT EXISTS",
  );
}

{
  const now = "2026-06-15T00:00:00.000Z";
  const summary: ChapterSummaryRow = {
    id: "summary-1",
    project_id: "project-1",
    chapter_outline_id: "chapter-4",
    writing_session_id: "session-1",
    current_prose_version_ids: [],
    status: "generated",
    chapter_number: 4,
    title: "Bab 4",
    synopsis: "Nadira mulai menyelidiki surat yang dipindahkan.",
    mini_victory: null,
    emotional_outcome: "Nadira menjadi lebih curiga.",
    ending_hook: null,
    word_count: 1000,
    summary_version: 1,
    is_current: true,
    safety_flags: {},
    metadata: {},
    approved_at: null,
    created_at: now,
    updated_at: now,
  };

  const item = (overrides: Partial<ChapterSummaryItemRow>): ChapterSummaryItemRow => ({
    id: "item-base",
    project_id: "project-1",
    chapter_summary_id: summary.id,
    item_type: CHAPTER_SUMMARY_ITEM_TYPES.continuity_note,
    severity: "info",
    title: "Continuity",
    body: "Continuity note",
    related_character_id: null,
    related_fact_id: null,
    related_open_loop_id: null,
    related_reveal_id: null,
    metadata: {},
    sort_order: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  });

  const extracted = extractChapterDeltaStub(summary, [
    item({
      id: "item-state",
      item_type: CHAPTER_SUMMARY_ITEM_TYPES.character_change,
      title: "Nadira",
      body: "Nadira bertekad mencari sumber surat yang dipindahkan.",
      related_character_id: "char-pov",
    }),
    item({
      id: "item-knowledge",
      item_type: CHAPTER_SUMMARY_ITEM_TYPES.new_fact_candidate,
      title: "Surat dipindahkan",
      body: "Nadira membaca bukti bahwa surat itu dipindahkan sebelum pesta.",
      related_character_id: "char-pov",
      related_fact_id: "fact-known",
    }),
  ]);

  const stateDraft = extracted.proposalDrafts.find(
    (draft) => draft.proposalType === AI_PROPOSAL_TYPES.character_state_update,
  );
  assert.ok(stateDraft, "character_change items should propose character state updates");
  assert.equal(stateDraft.payload.targetEntityId, "char-pov");
  assert.equal(stateDraft.payload.chapterNumber, 4);
  assert.equal(
    stateDraft.payload.currentGoal,
    "Nadira bertekad mencari sumber surat yang dipindahkan.",
  );

  const knowledgeDraft = extracted.proposalDrafts.find(
    (draft) => draft.proposalType === AI_PROPOSAL_TYPES.character_knowledge_update,
  );
  assert.ok(knowledgeDraft, "related fact + related character should propose knowledge updates");
  assert.equal(knowledgeDraft.payload.characterId, "char-pov");
  assert.equal(knowledgeDraft.payload.factId, "fact-known");
  assert.equal(knowledgeDraft.payload.knowledgeStatus, CHARACTER_KNOWLEDGE_STATUSES.knows);
  assert.equal(knowledgeDraft.payload.learnedAtChapter, 4);

  const proposalBase: Omit<AiProposalRow, "proposal_type" | "payload" | "title"> = {
    id: "proposal-1",
    project_id: "project-1",
    status: "proposed",
    risk_level: "medium",
    source: "chapter_delta_stub",
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
    merged_into_id: null,
    result_fact_id: null,
    result_character_id: null,
    created_at: now,
    updated_at: now,
  };

  assert.doesNotThrow(() =>
    preflightPromotionToCanon({
      ...proposalBase,
      proposal_type: AI_PROPOSAL_TYPES.character_state_update,
      title: "State Nadira",
      payload: stateDraft.payload,
    }),
  );
  assert.doesNotThrow(() =>
    preflightPromotionToCanon({
      ...proposalBase,
      proposal_type: AI_PROPOSAL_TYPES.character_knowledge_update,
      title: "Knowledge Nadira",
      payload: knowledgeDraft.payload,
    }),
  );

  const linked = mapLinkedProposalSummary(
    {
      id: "link-1",
      project_id: "project-1",
      chapter_summary_id: summary.id,
      ai_proposal_id: "proposal-knowledge",
      status: "linked",
      metadata: {},
      created_at: now,
      updated_at: now,
    } satisfies ChapterSummaryProposalRow,
    {
      ...proposalBase,
      id: "proposal-knowledge",
      proposal_type: AI_PROPOSAL_TYPES.character_knowledge_update,
      title: "Knowledge Nadira",
      payload: knowledgeDraft.payload,
    },
  );
  assert.equal(linked.payloadExcerpt.characterId, "char-pov");
  assert.equal(linked.payloadExcerpt.factId, "fact-known");
  assert.equal(linked.payloadExcerpt.knowledgeStatus, CHARACTER_KNOWLEDGE_STATUSES.knows);
}

{
  const reviewPanel = readFileSync(
    "../../apps/web/src/components/summary/SummaryProposalReviewPanel.tsx",
    "utf8",
  );
  assert.match(reviewPanel, /character_state_update/);
  assert.match(reviewPanel, /character_knowledge_update/);
  assert.match(reviewPanel, /State Tokoh|Perubahan State/i);
  assert.match(reviewPanel, /Knowledge POV|Pengetahuan POV/i);

  const writeHook = readFileSync("../../apps/web/src/hooks/useWriteRoomData.ts", "utf8");
  const writePage = readFileSync("../../apps/web/src/pages/WritePage.tsx", "utf8");
  const writerAssistant = readFileSync(
    "../../apps/web/src/components/writer/WriterAssistantPanel.tsx",
    "utf8",
  );
  assert.match(writeHook, /creatorMode/);
  assert.match(writeHook, /showPovKnowledgeSummary/);
  assert.match(writePage, /showPovKnowledgeSummary/);
  assert.match(writerAssistant, /showPovKnowledgeSummary/);
}

console.log("PASS Sprint 16 character continuity contracts");
