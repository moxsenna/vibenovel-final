import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import {
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  IMPORT_JOB_PHASES,
  IMPORT_JOB_STATUSES,
  PROSE_EMBEDDING_SOURCES,
} from "@vibenovel/shared";
import { chunkDraftForImport, countDraftWords } from "../src/services/import/chunking.ts";
import {
  buildDraftImportAiProposalRows,
  buildDraftImportProposalDrafts,
} from "../src/services/import/entity-extraction.ts";
import { buildDraftImportFoundationSeed } from "../src/services/import/foundation-seed.ts";
import { isFoundationReviewProposal } from "../src/services/foundation-proposal.ts";
import {
  buildAuthorVoiceProposalDraft,
  extractAuthorVoiceFromDraft,
} from "../src/services/import/style-extraction.ts";
import {
  buildOpenRouterEmbeddingsRequest,
  buildProseEmbeddingInsertRows,
  parseOpenRouterEmbeddingsResponse,
  resolveEmbeddingModel,
} from "../src/services/import/embedding.ts";
import {
  buildImportJobFailurePatch,
  buildImportJobPhasePatch,
  buildImportJobResumePatch,
} from "../src/services/import/job-progress.ts";
import {
  attachReadOnlyRetrievalMemoryToPacket,
  buildReadOnlyRetrievalSnippets,
} from "../src/services/import/retrieval-memory.ts";
import { computeFoundationReadiness } from "../src/services/foundation-readiness.ts";

const migrationSql = readFileSync(
  "../../supabase/migrations/00017_sprint18_import_rag.sql",
  "utf8",
);

for (const required of [
  "create extension if not exists vector",
  "import_job_status",
  "import_job_phase",
  "prose_embeddings",
  "import_jobs",
  "embedding vector(1536)",
  "using hnsw",
  "draft_import_id",
  "owner_id",
]) {
  assert.match(
    migrationSql.toLowerCase(),
    new RegExp(required.replace(/[()]/g, "\\$&")),
    `${required} must exist in Sprint 18 migration`,
  );
}

assert.doesNotMatch(
  migrationSql.toLowerCase(),
  /insert\s+into\s+public\.facts/,
  "Sprint 18 import/RAG migration must not write canon facts",
);

assert.equal(IMPORT_JOB_STATUSES.pending, "pending");
assert.equal(IMPORT_JOB_STATUSES.running, "running");
assert.equal(IMPORT_JOB_STATUSES.succeeded, "succeeded");
assert.equal(IMPORT_JOB_STATUSES.failed, "failed");
assert.equal(IMPORT_JOB_PHASES.chunking, "chunking");
assert.equal(IMPORT_JOB_PHASES.embedding, "embedding");
assert.equal(IMPORT_JOB_PHASES.entity_extraction, "entity_extraction");
assert.equal(PROSE_EMBEDDING_SOURCES.imported_draft, "imported_draft");

const chunkingJobPatch = buildImportJobPhasePatch(IMPORT_JOB_PHASES.chunking, {
  chunkCount: 3,
});
assert.equal(chunkingJobPatch.status, IMPORT_JOB_STATUSES.running);
assert.equal(chunkingJobPatch.current_phase, IMPORT_JOB_PHASES.chunking);
assert.equal(chunkingJobPatch.progress_percent > 0, true);
assert.equal(chunkingJobPatch.phase_state.chunkCount, 3);

const failedJobPatch = buildImportJobFailurePatch({
  phase: IMPORT_JOB_PHASES.embedding,
  errorCode: "AI_PROVIDER_ERROR",
  errorMessage: "OpenRouter token sk-live-secret failed",
});
assert.equal(failedJobPatch.status, IMPORT_JOB_STATUSES.failed);
assert.equal(failedJobPatch.current_phase, IMPORT_JOB_PHASES.embedding);
assert.doesNotMatch(failedJobPatch.error_message_safe, /openrouter|token|sk-live/i);

const resumedJobPatch = buildImportJobResumePatch({
  id: "job-18",
  status: IMPORT_JOB_STATUSES.failed,
  current_phase: IMPORT_JOB_PHASES.embedding,
  progress_percent: 45,
  phase_state: { chunkCount: 3 },
  metadata: { resumeCount: 1 },
});
assert.equal(resumedJobPatch.status, IMPORT_JOB_STATUSES.running);
assert.equal(resumedJobPatch.current_phase, IMPORT_JOB_PHASES.embedding);
assert.equal(resumedJobPatch.progress_percent, 45);
assert.equal(resumedJobPatch.error_code, null);
assert.equal(resumedJobPatch.error_message_safe, null);
assert.equal(resumedJobPatch.phase_state.chunkCount, 3);

assert.equal(countDraftWords("Nadira bangkit elegan"), 3);
assert.equal(countDraftWords("彼女は秘密を守る") >= 7, true);

const draftText = `
Nadira menatap dapur mertuanya yang sempit. Suaminya pulang bersama perempuan lain,
sementara ibu mertua terus menghina Nadira sebagai menantu miskin yang tak pantas.

Draft ini ditulis untuk pembaca wanita KBM di HP: bab pendek, konflik keluarga tajam,
rahasia lama tentang anak yang disembunyikan, dan janji balas dendam elegan.

彼女は秘密を守る。家族の嘘はまだ明かされない。Pembaca hanya perlu potongan memori ini sebagai konteks,
bukan sebagai sumber kebenaran canon.
`.trim();

const chunks = await chunkDraftForImport({
  projectId: "project-18",
  draftImportId: "draft-18",
  content: draftText,
  maxChunkChars: 190,
});
assert.equal(chunks.length >= 2, true, "short maxChunkChars should create multiple chunks");
assert.equal(chunks[0].sourceRef, "draft_import:draft-18:chunk:1");
assert.equal(chunks.every((chunk) => chunk.chunkText.length <= 190), true);
assert.equal(chunks.every((chunk) => chunk.wordCount > 0), true);
assert.equal(chunks.every((chunk) => chunk.chunkHash.length === 64), true);

const embeddingConfig = resolveEmbeddingModel();
assert.equal(embeddingConfig.provider, "openrouter");
assert.equal(embeddingConfig.logicalModel, "openai_embedding_small");
assert.equal(embeddingConfig.model, "openai/text-embedding-3-small");
assert.equal(embeddingConfig.dimensions, 1536);

const embeddingRequest = buildOpenRouterEmbeddingsRequest(
  embeddingConfig,
  chunks.map((chunk) => chunk.chunkText),
);
assert.equal(embeddingRequest.model, "openai/text-embedding-3-small");
assert.equal(Array.isArray(embeddingRequest.input), true);
assert.equal(embeddingRequest.encoding_format, "float");

const vector1536 = Array.from({ length: 1536 }, (_, index) => index / 1536);
const parsedEmbeddings = parseOpenRouterEmbeddingsResponse(
  {
    data: chunks.map((_, index) => ({
      object: "embedding",
      index,
      embedding: vector1536,
    })),
    model: embeddingConfig.model,
    usage: { prompt_tokens: 10, total_tokens: 10 },
  },
  embeddingConfig,
  chunks.length,
);
assert.equal(parsedEmbeddings.embeddings.length, chunks.length);
assert.equal(parsedEmbeddings.model, embeddingConfig.model);
assert.equal(parsedEmbeddings.dimensions, 1536);

const embeddingRows = buildProseEmbeddingInsertRows({
  ownerId: "owner-18",
  importJobId: "job-18",
  chunks,
  embeddingResult: parsedEmbeddings,
});
assert.equal(embeddingRows.length, chunks.length);
assert.equal(embeddingRows[0].project_id, "project-18");
assert.equal(embeddingRows[0].owner_id, "owner-18");
assert.equal(embeddingRows[0].source, PROSE_EMBEDDING_SOURCES.imported_draft);
assert.equal(embeddingRows[0].embedding_provider, "openrouter");
assert.equal(embeddingRows[0].embedding_model, "openai/text-embedding-3-small");
assert.equal(embeddingRows[0].embedding.length, 1536);

const snippets = buildReadOnlyRetrievalSnippets(
  [
    {
      sourceRef: "draft_import:draft-18:chunk:1",
      chunkText: "Nadira dihina keluarga suami, tetapi belum ada fakta canon baru.",
      similarity: 0.92,
      metadata: { draftImportId: "draft-18" },
    },
    {
      sourceRef: "draft_import:draft-18:chunk:2",
      chunkText: "Potongan ini hanya referensi gaya dan memori masa lalu.",
      similarity: 0.8,
      metadata: {},
    },
  ],
  { topK: 1, maxSnippetChars: 48 },
);
assert.equal(snippets.length, 1);
assert.equal(snippets[0].sourceRef, "draft_import:draft-18:chunk:1");
assert.equal(snippets[0].readOnly, true);
assert.equal(snippets[0].usage, "context_only");
assert.equal(snippets[0].text.length <= 48, true);
assert.equal(Object.hasOwn(snippets[0], "factId"), false);

const packetWithRetrievalMemory = attachReadOnlyRetrievalMemoryToPacket(
  {
    meta: {
      projectId: "project-18",
      chapterOutlineId: "chapter-1",
      chapterNumber: 1,
      builderVersion: "context_packet_v1_stub",
      packetHash: "pending",
      generatedAt: "2026-06-15T00:00:00.000Z",
    },
    foundation: {
      premiseSummary: "Premise",
      mainConflictSummary: "Conflict",
      readerPromise: "Promise",
      tone: "emotional",
      storySecretsPreview: null,
    },
    concept: {
      title: "Title",
      shortPitch: "Pitch",
      readerPromise: null,
    },
    canon: {
      characters: [],
      facts: [],
      speechRules: [],
    },
    currentChapter: {
      title: "Chapter 1",
      summary: "Current chapter only",
      purpose: null,
      chapterFunction: "setup",
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
        characterId: null,
        knownFacts: [],
        suspectedFacts: [],
        partialFacts: [],
        falseBeliefs: [],
        unknownFactCount: 0,
      },
      retrievalMemory: [],
    },
    revealGate: {
      allowedBreadcrumbs: [],
      allowedReveals: [],
      forbiddenReveals: [],
      forbiddenConcepts: [],
    },
    emotionalTarget: {
      chapterEmotion: null,
      beatEmotionalShift: null,
    },
    hookTarget: {
      chapterEndingHook: null,
      beatStopCondition: null,
    },
    constraints: {
      mustInclude: [],
      mustNotInclude: [],
      wordTarget: null,
      mobileFormatRules: [],
    },
  },
  snippets,
);
assert.equal(packetWithRetrievalMemory.continuity.retrievalMemory.length, 1);
assert.equal(packetWithRetrievalMemory.continuity.retrievalMemory[0].readOnly, true);
assert.equal(packetWithRetrievalMemory.continuity.retrievalMemory[0].usage, "context_only");
assert.equal(
  Object.hasOwn(packetWithRetrievalMemory.continuity.retrievalMemory[0], "factId"),
  false,
);

const proposalDrafts = buildDraftImportProposalDrafts({
  projectId: "project-18",
  draftImportId: "draft-18",
  signals: [
    {
      type: "protagonist",
      label: "Tokoh utama: Nadira",
      value: "Nadira",
      confidence: 0.78,
      metadata: { source: "imported_draft" },
    },
    {
      type: "continuity_warning",
      label: "Periksa rahasia dan kontinuitas",
      value: "anak disembunyikan",
      confidence: 0.88,
      metadata: { source: "imported_draft" },
    },
    {
      type: "reader_promise",
      label: "Janji kebangkitan emosional",
      value: "kebangkitan dan pembalasan elegan",
      confidence: 0.84,
      metadata: { source: "imported_draft" },
    },
  ],
});

const proposalTypes = new Set(proposalDrafts.map((draft) => draft.proposalType));
assert.equal(proposalTypes.has(AI_PROPOSAL_TYPES.character), true);
assert.equal(proposalTypes.has(AI_PROPOSAL_TYPES.fact), true);
assert.equal(proposalTypes.has(AI_PROPOSAL_TYPES.style), true);
assert.equal(
  proposalDrafts.every((draft) => draft.source === AI_PROPOSAL_SOURCES.ai_import),
  true,
);
assert.equal(
  proposalDrafts.every((draft) => draft.status === AI_PROPOSAL_STATUSES.proposed),
  true,
);
assert.equal(
  proposalDrafts.every((draft) => draft.payload.draftImportId === "draft-18"),
  true,
);

const importFoundationSeed = buildDraftImportFoundationSeed({
  projectId: "project-18",
  draftImportId: "draft-seed-18",
  projectTitle: "Draft Saya",
  signals: [
    {
      type: "genre",
      label: "Sci-Fi Psychological Horror",
      value:
        "Kombinasi eksplorasi ruang angkasa, misteri koloni kosong, dan horor psikologis berbasis manipulasi memori.",
      confidence: 0.99,
      metadata: { source: "ai_draft_import" },
    },
    {
      type: "protagonist",
      label: "Lira Sembadra",
      value:
        "Teknisi komunikasi yang dihantui trauma masa lalu dan menjadi pusat cerita.",
      confidence: 0.99,
      metadata: { source: "ai_draft_import" },
    },
    {
      type: "core_conflict",
      label: "Man vs. Alien Intelligence",
      value:
        "Perjuangan melawan Noctilite yang membaca memori, meniru suara orang terkasih, dan menjebak kesadaran manusia.",
      confidence: 0.95,
      metadata: { source: "ai_draft_import" },
    },
    {
      type: "reader_promise",
      label: "Mystery Unraveling & Psychological Stakes",
      value:
        "Janji pengungkapan misteri koloni Kharon-7 dan konfrontasi Lira dengan rasa bersalahnya.",
      confidence: 0.85,
      metadata: { source: "ai_draft_import" },
    },
    {
      type: "setting",
      label: "Kharon-7",
      value: "Bulan mati dengan koloni berkubah dan laboratorium rahasia.",
      confidence: 0.99,
      metadata: { source: "ai_draft_import" },
    },
    {
      type: "tone",
      label: "Sinematik, tegang, psikologis",
      value: "sinematik tegang psikologis",
      confidence: 0.88,
      metadata: { source: "ai_draft_import" },
    },
  ],
});
assert.match(importFoundationSeed.concept.title, /Lira|Sci-Fi/i);
assert.match(importFoundationSeed.concept.shortPitch, /Lira|Noctilite|Kharon-7/i);
assert.equal(importFoundationSeed.concept.genre, "Sci-Fi Psychological Horror");
assert.equal(importFoundationSeed.concept.status, "selected");
assert.equal(importFoundationSeed.foundationProposal.proposalType, AI_PROPOSAL_TYPES.foundation);
assert.equal(importFoundationSeed.foundationProposal.source, AI_PROPOSAL_SOURCES.ai_import);
assert.equal(importFoundationSeed.foundationProposal.status, AI_PROPOSAL_STATUSES.proposed);
assert.equal(importFoundationSeed.foundationProposal.payload.draftImportId, "draft-seed-18");
assert.match(String(importFoundationSeed.foundationProposal.payload.mainConflict), /Noctilite/i);
assert.equal(importFoundationSeed.safeFactProposals.length >= 2, true);
assert.equal(
  importFoundationSeed.safeFactProposals.every(
    (draft) =>
      draft.proposalType === AI_PROPOSAL_TYPES.fact &&
      draft.source === AI_PROPOSAL_SOURCES.ai_import &&
      draft.payload.category !== "secret",
  ),
  true,
);

const selectedConceptForReadiness = {
  id: "concept-import-seed",
  project_id: "project-18",
  title: importFoundationSeed.concept.title,
  short_pitch: importFoundationSeed.concept.shortPitch,
  reader_promise: importFoundationSeed.concept.readerPromise,
  core_conflict: importFoundationSeed.concept.coreConflict,
  genre: importFoundationSeed.concept.genre,
  tone: importFoundationSeed.concept.tone,
  target_reader: importFoundationSeed.concept.targetReader,
  status: "selected",
  source: "system",
  score: 92,
  payload: importFoundationSeed.concept.payload,
  created_at: "2026-06-16T00:00:00.000Z",
  updated_at: "2026-06-16T00:00:00.000Z",
} as Parameters<typeof computeFoundationReadiness>[1];

const importSeedProposalRows = [
  importFoundationSeed.foundationProposal,
  ...importFoundationSeed.safeFactProposals,
  ...buildDraftImportProposalDrafts({
    projectId: "project-18",
    draftImportId: "draft-ai-protagonist",
    signals: [
      {
        type: "protagonist",
        label: "Lira Sembadra",
        value:
          "Teknisi komunikasi yang dihantui trauma masa lalu dan menjadi pusat cerita.",
        confidence: 0.84,
        metadata: { source: "ai_draft_import" },
      },
    ],
  }),
].map((draft, index) => ({
  id: `proposal-${index}`,
  project_id: "project-18",
  proposal_type: draft.proposalType,
  status: draft.status,
  risk_level: draft.riskLevel,
  source: draft.source,
  title: draft.title,
  payload: draft.payload,
  review_note: draft.reviewNote,
  reviewed_at: null,
  reviewed_by: null,
  merged_into_id: null,
  result_fact_id: null,
  result_character_id: null,
  created_at: "2026-06-16T00:00:00.000Z",
  updated_at: "2026-06-16T00:00:00.000Z",
})) as Parameters<typeof computeFoundationReadiness>[2];

const proposedSeedReadiness = computeFoundationReadiness(
  null,
  selectedConceptForReadiness,
  importSeedProposalRows,
  [],
  [],
  [],
  false,
  {
    activeStatuses: new Set(["accepted"]),
    acceptedCountsAsReady: true,
    persist: false,
  },
);
assert.equal(
  proposedSeedReadiness.canLock,
  false,
  "proposed import seed proposals must not make foundation lock-ready before review",
);

const acceptedSeedReadiness = computeFoundationReadiness(
  null,
  selectedConceptForReadiness,
  importSeedProposalRows.map((row) => ({ ...row, status: "accepted" })),
  [],
  [],
  [],
  false,
  {
    activeStatuses: new Set(["accepted"]),
    acceptedCountsAsReady: true,
    persist: false,
  },
);
assert.equal(acceptedSeedReadiness.readinessScore >= 75, true);
assert.equal(acceptedSeedReadiness.readinessScore < 85, true);
assert.equal(acceptedSeedReadiness.canRefine, true);
assert.equal(acceptedSeedReadiness.canLock, false);

const aiProtagonistProposalDrafts = buildDraftImportProposalDrafts({
  projectId: "project-18",
  draftImportId: "draft-ai-protagonist",
  signals: [
    {
      type: "protagonist",
      label: "Lira Sembadra",
      value:
        "Teknisi komunikasi yang dihantui trauma masa lalu dan menjadi pusat cerita.",
      confidence: 0.84,
      metadata: { source: "ai_draft_import" },
    },
  ],
});
const aiProtagonistCharacterProposal = aiProtagonistProposalDrafts.find(
  (draft) => draft.proposalType === AI_PROPOSAL_TYPES.character,
);
assert.equal(aiProtagonistCharacterProposal?.payload.name, "Lira Sembadra");
assert.match(
  String(aiProtagonistCharacterProposal?.payload.description ?? ""),
  /Teknisi komunikasi/,
);

assert.equal(
  isFoundationReviewProposal({
    source: AI_PROPOSAL_SOURCES.ai_import,
    payload: { draftImportId: "draft-18", extractionMode: "proposal_only" },
  }),
  true,
  "draft-import proposals must be visible in the foundation review panel",
);
assert.equal(
  isFoundationReviewProposal({
    source: AI_PROPOSAL_SOURCES.system_seed,
    payload: { generator: "foundation_ai_batch", batchId: "batch-18" },
  }),
  true,
  "foundation AI generator proposals must remain visible in the foundation panel",
);
assert.equal(
  isFoundationReviewProposal({
    source: AI_PROPOSAL_SOURCES.summary_stub,
    payload: { generator: "chapter_delta_stub" },
  }),
  false,
  "unrelated proposal batches must stay out of the foundation panel",
);

const authorVoice = extractAuthorVoiceFromDraft({
  draftImportId: "draft-18",
  content: draftText,
  chunks,
});
assert.equal(authorVoice.draftImportId, "draft-18");
assert.equal(authorVoice.source, "imported_draft");
assert.equal(authorVoice.sampleCount >= 2, true);
assert.equal(authorVoice.authorVoice.length > 0, true);
assert.equal(authorVoice.styleTags.includes("hp_serial"), true);

const authorVoiceProposal = buildAuthorVoiceProposalDraft({
  projectId: "project-18",
  draftImportId: "draft-18",
  authorVoice,
});
assert.equal(authorVoiceProposal.proposalType, AI_PROPOSAL_TYPES.style);
assert.equal(authorVoiceProposal.status, AI_PROPOSAL_STATUSES.proposed);
assert.equal(authorVoiceProposal.source, AI_PROPOSAL_SOURCES.ai_import);
assert.equal(authorVoiceProposal.payload.authorVoice, authorVoice.authorVoice);
assert.equal(authorVoiceProposal.payload.extractionMode, "proposal_only");

const aiProposalRows = buildDraftImportAiProposalRows(proposalDrafts);
assert.equal(aiProposalRows.length, proposalDrafts.length);
assert.equal(
  aiProposalRows.every((row) => row.status === AI_PROPOSAL_STATUSES.proposed),
  true,
);
assert.equal(
  aiProposalRows.every((row) => row.source === AI_PROPOSAL_SOURCES.ai_import),
  true,
);
assert.equal(
  aiProposalRows.every((row) => row.project_id === "project-18"),
  true,
);

const draftImportServiceSql = readFileSync("src/services/draft-import.ts", "utf8");
assert.match(draftImportServiceSql, /materializeDraftImportProposalsForOwner/);
assert.match(draftImportServiceSql, /materializeDraftImportFoundationSeedForOwner/);
assert.match(draftImportServiceSql, /\.from\("ai_proposals"\)/);
assert.match(draftImportServiceSql, /extractAuthorVoiceFromDraft/);
assert.match(draftImportServiceSql, /buildAuthorVoiceProposalDraft/);
assert.doesNotMatch(
  draftImportServiceSql,
  /\.from\("facts"\)\s*[\s\S]*\.insert/,
  "draft import materialization must not insert canon facts directly",
);

const foundationReadinessSql = readFileSync("src/services/foundation-readiness.ts", "utf8");
assert.doesNotMatch(
  foundationReadinessSql,
  /activeStatuses:\s*new Set\(\["proposed",\s*"accepted"\]\)/,
  "display readiness must not report lock-ready from proposed-only proposals",
);

const draftImportRoutesSql = readFileSync("src/routes/draft-import.ts", "utf8");
assert.match(draftImportRoutesSql, /materialize-proposals/);
assert.match(draftImportRoutesSql, /import-jobs\/resume/);

const foundationAcceptServicePath = "src/services/foundation-proposal-acceptance.ts";
assert.equal(
  existsSync(foundationAcceptServicePath),
  true,
  "Foundation review needs a dedicated accept service that promotes accepted proposals into draft foundation data",
);
const foundationAcceptServiceSql = readFileSync(foundationAcceptServicePath, "utf8");
assert.match(foundationAcceptServiceSql, /acceptFoundationProposalForOwner/);
assert.match(foundationAcceptServiceSql, /\.from\("story_foundations"\)/);
assert.match(foundationAcceptServiceSql, /\.from\("characters"\)/);
assert.match(foundationAcceptServiceSql, /\.from\("facts"\)/);
assert.match(
  foundationAcceptServiceSql,
  /high-risk|high risk|risk_level/,
  "Foundation accept service must keep high-risk secret/fact proposals out of direct promotion",
);
assert.match(
  foundationAcceptServiceSql,
  /Diturunkan dari draft import/,
  "Accepted style proposals should be allowed to replace generic import-derived tone placeholders",
);
assert.match(
  foundationAcceptServiceSql,
  /foundation_ai_batch/,
  "Accepted foundation-AI style proposals should replace stale import-derived style tags",
);

const foundationRoutesSql = readFileSync("src/routes/foundation.ts", "utf8");
assert.match(
  foundationRoutesSql,
  /\/api\/projects\/:id\/foundation\/proposals\/:proposalId\/accept/,
  "Foundation proposal accept must use a foundation-specific endpoint",
);

const webFoundationFlowSql = readFileSync("../web/src/services/foundation-flow.ts", "utf8");
assert.match(
  webFoundationFlowSql,
  /\/api\/projects\/\$\{projectId\}\/foundation\/proposals\/\$\{proposalId\}\/accept/,
  "Foundation UI must accept proposals through the foundation endpoint so accepted cards immediately update the draft foundation",
);
assert.doesNotMatch(
  webFoundationFlowSql,
  /\/api\/projects\/\$\{projectId\}\/proposals\/\$\{proposalId\}\/accept/,
  "Foundation UI must not use the generic status-only proposal accept endpoint",
);

const contextPacketBuilderSql = readFileSync("src/services/context-packet-builder.ts", "utf8");
assert.match(contextPacketBuilderSql, /loadRetrievalMemorySnippetsForPacket/);
assert.match(contextPacketBuilderSql, /retrievalMemory/);
assert.match(contextPacketBuilderSql, /retrieveRelevantDraftMemory/);
assert.doesNotMatch(
  contextPacketBuilderSql,
  /\.from\("prose_embeddings"\)[\s\S]*\.order\("created_at"/,
  "Writer context must use semantic retrieval, not latest-chunk selection",
);

const importJobServiceSql = readFileSync("src/services/import/job-progress.ts", "utf8");
assert.match(importJobServiceSql, /\.from\("import_jobs"\)/);
assert.match(importJobServiceSql, /progress_percent/);
assert.match(importJobServiceSql, /error_message_safe/);

const pipelineRunnerSql = readFileSync("src/services/import/pipeline-runner.ts", "utf8");
assert.match(pipelineRunnerSql, /runDraftImportPrepForOwner/);
assert.match(pipelineRunnerSql, /embedTextsWithOpenRouter/);
assert.match(pipelineRunnerSql, /buildProseEmbeddingInsertRows/);
assert.match(pipelineRunnerSql, /\.from\("prose_embeddings"\)[\s\S]*\.delete/);
assert.match(pipelineRunnerSql, /\.from\("prose_embeddings"\)[\s\S]*\.insert/);
assert.match(pipelineRunnerSql, /materializeDraftImportProposalsForOwner/);
assert.match(pipelineRunnerSql, /IMPORT_JOB_PHASES\.ready_for_review/);
assert.match(pipelineRunnerSql, /buildImportJobFailurePatch/);
assert.doesNotMatch(
  pipelineRunnerSql,
  /\.from\("facts"\)\s*[\s\S]*\.insert/,
  "draft import prep runner must not insert canon facts directly",
);

assert.match(draftImportRoutesSql, /runDraftImportPrepForOwner/);

console.log("PASS Sprint 18 import/RAG foundation contracts");
