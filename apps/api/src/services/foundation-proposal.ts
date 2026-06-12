import {
  AI_PROPOSAL_RISK_LEVELS,
  AI_PROPOSAL_SOURCES,
  AI_PROPOSAL_STATUSES,
  AI_PROPOSAL_TYPES,
  GENERATION_TYPES,
  STORY_CONCEPT_STATUSES,
  WRITER_QUALITY_MODES,
  type AiProposalRiskLevel,
  type AiProposalType,
  type JsonObject,
} from "@vibenovel/shared";
import { isAiGenerationEnabled, isAiProviderMock, type AppBindings } from "../env.js";
import {
  mapAiProposalResponse,
  type AiProposalResponse,
  type AiProposalRow,
  type DetectedSignalRow,
  type FoundationRow,
  type ProjectRow,
  type StoryConceptRow,
} from "../lib/mappers.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { AppError } from "../errors.js";
import { getOwnedProjectRow } from "./project.js";
import { generateWithModelRouter } from "./model-router.js";
import {
  CREDIT_LEDGER_REASONS,
  debitCreditsForAttempt,
  refundCreditsForAttempt,
} from "./credit-ledger.js";
import {
  createGenerationAttempt,
  markGenerationAttemptFailed,
  markGenerationAttemptRunning,
  markGenerationAttemptSucceeded,
} from "./generation-attempt.js";
import { generateCorrelationId } from "./audit-snapshot.js";
import { computePromptHashFromMessages } from "./prose-generation-prompt.js";
import { listIntakeMessagesForOwner } from "./intake.js";

const PROPOSAL_SELECT =
  "id, project_id, proposal_type, status, risk_level, source, title, payload, review_note, reviewed_at, reviewed_by, merged_into_id, result_fact_id, result_character_id, created_at, updated_at";

const CONCEPT_SELECT =
  "id, project_id, title, short_pitch, reader_promise, core_conflict, genre, tone, target_reader, status, source, score, payload, created_at, updated_at";

const SIGNAL_SELECT =
  "id, project_id, session_id, type, label, value, confidence, status, source_message_id, metadata, created_at, updated_at";

const FOUNDATION_SELECT =
  "id, project_id, premise, main_conflict, reader_promise, tone, genre, target_reader, story_secrets_preview, style_tags, readiness_percent, readiness_status, status, is_locked, locked_at, created_at, updated_at";

export const FOUNDATION_FLOW_PROPOSAL_TYPES: readonly AiProposalType[] = [
  AI_PROPOSAL_TYPES.foundation,
  AI_PROPOSAL_TYPES.character,
  AI_PROPOSAL_TYPES.fact,
  AI_PROPOSAL_TYPES.relationship_speech_rule,
  AI_PROPOSAL_TYPES.secret,
  AI_PROPOSAL_TYPES.style,
];

const GENERATOR_MARKER = "foundation_stub_batch";
const GENERATOR_MARKER_AI = "foundation_ai_batch";
/** Both stub and AI batches belong to the foundation flow (dedup/list/regenerate). */
const FOUNDATION_GENERATOR_MARKERS = new Set<string>([GENERATOR_MARKER, GENERATOR_MARKER_AI]);
const FOUNDATION_AI_CREDIT_COST = 3;

interface ProposalDraft {
  proposalType: AiProposalType;
  title: string;
  riskLevel: AiProposalRiskLevel;
  payload: JsonObject;
}

interface GenerationContext {
  project: ProjectRow;
  concept: StoryConceptRow;
  foundation: FoundationRow | null;
  hasFamilyConflict: boolean;
  hasSecret: boolean;
  batchId: string;
}

function parsePayload(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function isFoundationStubBatch(row: AiProposalRow): boolean {
  const payload = parsePayload(row.payload);
  return FOUNDATION_GENERATOR_MARKERS.has(payload.generator as string);
}

async function loadSelectedConcept(
  bindings: AppBindings,
  projectRow: ProjectRow,
): Promise<StoryConceptRow> {
  if (!projectRow.selected_concept_id) {
    throw AppError.badRequest("Select a story concept before generating foundation proposals");
  }

  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_concepts")
    .select(CONCEPT_SELECT)
    .eq("id", projectRow.selected_concept_id)
    .eq("project_id", projectRow.id)
    .maybeSingle();

  if (error) {
    console.error("story_concepts select for proposal gen failed");
    throw AppError.internal("Failed to load selected concept");
  }
  if (!data) {
    throw AppError.badRequest("Selected concept not found for this project");
  }

  const concept = data as StoryConceptRow;
  if (concept.status !== STORY_CONCEPT_STATUSES.selected) {
    throw AppError.badRequest("Selected concept must have status selected");
  }

  return concept;
}

async function loadSignalsContext(
  bindings: AppBindings,
  projectId: string,
): Promise<{ hasFamilyConflict: boolean; hasSecret: boolean }> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("detected_signals")
    .select(SIGNAL_SELECT)
    .eq("project_id", projectId)
    .neq("status", "dismissed");

  if (error) {
    console.error("detected_signals select for proposal gen failed");
    throw AppError.internal("Failed to load signals");
  }

  let hasFamilyConflict = false;
  let hasSecret = false;

  for (const row of (data ?? []) as DetectedSignalRow[]) {
    if (row.type === "relationship_dynamic" || row.type === "genre") {
      if (/rumah tangga|keluarga|istri|mertua/i.test(row.label + row.value)) {
        hasFamilyConflict = true;
      }
    }
    if (row.type === "secret_candidate") hasSecret = true;
  }

  return { hasFamilyConflict, hasSecret };
}

async function fetchFoundationRow(
  bindings: AppBindings,
  projectId: string,
): Promise<FoundationRow | null> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("story_foundations")
    .select(FOUNDATION_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("story_foundations select for proposal gen failed");
    throw AppError.internal("Failed to load foundation");
  }
  return (data as FoundationRow | null) ?? null;
}

function buildProposalDrafts(ctx: GenerationContext): ProposalDraft[] {
  const { concept, project, batchId, hasFamilyConflict, hasSecret } = ctx;
  const genre = concept.genre ?? project.genre ?? "Drama Rumah Tangga";
  const tone = concept.tone ?? "Emosional";
  const targetReader = concept.target_reader ?? "hp_serial";
  const premise =
    concept.short_pitch ||
    `Cerita ${genre} tentang perjalanan harga diri dan keadilan emosional.`;
  const mainConflict =
    concept.core_conflict ||
    "Tokoh utama terjepit antara bertahan demi keluarga atau menuntut keadilan.";
  const readerPromise =
    concept.reader_promise ||
    "Perjalanan bangkit yang memuaskan dibaca bab demi bab di HP.";

  const baseMeta: JsonObject = {
    generator: GENERATOR_MARKER,
    batchId,
    conceptId: concept.id,
    conceptTitle: concept.title,
  };

  const drafts: ProposalDraft[] = [
    {
      proposalType: AI_PROPOSAL_TYPES.foundation,
      title: `Fondasi: ${concept.title}`,
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...baseMeta,
        premise,
        mainConflict,
        readerPromise,
        genre,
        targetReader,
        tone,
      },
    },
    {
      proposalType: AI_PROPOSAL_TYPES.character,
      title: "Tokoh Utama — Nadira",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...baseMeta,
        name: "Nadira",
        role: "protagonist",
        description:
          "Perempuan yang diremehkan namun perlahan mengambil kendali atas hidupnya.",
        motivation: "Membuktikan harga diri tanpa kehilangan moral sebagai ibu.",
      },
    },
    {
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: "Fakta: Nadira adalah tokoh utama",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...baseMeta,
        content: "Nadira adalah tokoh utama cerita ini.",
        category: "identity",
        importance: "core",
        reason: "Identitas pusat untuk serial.",
      },
    },
    {
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: "Fakta: Konflik keluarga menjadi pemicu",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
      payload: {
        ...baseMeta,
        content: mainConflict.slice(0, 300),
        category: "event",
        importance: "major",
        reason: "Membingkai konflik utama dari concept terpilih.",
      },
    },
    {
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: "Fakta: Janji pembaca",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...baseMeta,
        content: readerPromise.slice(0, 300),
        category: "promise",
        importance: "major",
        reason: "Menjaga arah emosional serial.",
      },
    },
    {
      proposalType: AI_PROPOSAL_TYPES.style,
      title: `Gaya: ${tone}`,
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...baseMeta,
        tone,
        styleTags: ["Drama Rumah Tangga", "POV Perempuan", "Serial Bab Pendek"],
        outputStyle: "warm_emotional",
        reason: "Selaras concept dan target pembaca HP.",
      },
    },
  ];

  if (hasFamilyConflict) {
    drafts.push(
      {
        proposalType: AI_PROPOSAL_TYPES.character,
        title: "Tokoh Pendukung — Arman",
        riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
        payload: {
          ...baseMeta,
          name: "Arman",
          role: "supporting",
          description: "Suami yang tidak membela Nadira dan menyimpan rahasia.",
          motivation: "Menghindari konfrontasi dengan keluarganya.",
        },
      },
      {
        proposalType: AI_PROPOSAL_TYPES.character,
        title: "Tokoh Pendukung — Bu Siti",
        riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
        payload: {
          ...baseMeta,
          name: "Bu Siti",
          role: "supporting",
          description: "Ibu mertua yang kerap merendahkan Nadira.",
          motivation: "Mempertahankan hierarki keluarga.",
        },
      },
      {
        proposalType: AI_PROPOSAL_TYPES.relationship_speech_rule,
        title: "Aturan bicara: Nadira ↔ Bu Siti",
        riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
        payload: {
          ...baseMeta,
          relationshipLabel: "Nadira ↔ Bu Siti",
          characterAName: "Nadira",
          characterBName: "Bu Siti",
          ruleText:
            "Bu Siti memanggil Nadira dengan nada merendahkan; Nadira tetap sopan tetapi menjawab singkat dan dingin.",
          examples: [
            "Bu Siti: Kau masih belajar jadi istri yang baik, Nak.",
            "Nadira: Iya, Bu.",
          ],
          reason: "Dinamika keluarga dari sinyal intake.",
        },
      },
    );
  }

  if (hasSecret) {
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.secret,
      title: "Rahasia: masa lalu yang disembunyikan",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.high,
      payload: {
        ...baseMeta,
        summary: "Ada rahasia besar dari masa lalu yang belum terungkap ke Nadira.",
        category: "secret",
        highRiskCategory: "rahasia_besar",
        reason: "Sinyal secret_candidate terdeteksi — tetap di proposal queue.",
      },
    });
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: "Fakta kandidat rahasia (proposal only)",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.high,
      payload: {
        ...baseMeta,
        content:
          "Ada hubungan atau kejadian masa lalu yang sengaja disembunyikan dari Nadira.",
        category: "secret",
        importance: "major",
        highRiskCategory: "rahasia_besar",
        reason: "High-risk — harus di-accept eksplisit, bukan auto-canon.",
      },
    });
  }

  return drafts;
}

async function listExistingStubBatch(
  bindings: AppBindings,
  projectId: string,
  statusFilter?: string,
): Promise<AiProposalRow[]> {
  const admin = createServiceRoleClient(bindings);
  let query = admin
    .from("ai_proposals")
    .select(PROPOSAL_SELECT)
    .eq("project_id", projectId)
    .in("proposal_type", [...FOUNDATION_FLOW_PROPOSAL_TYPES])
    .order("created_at", { ascending: true });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("ai_proposals list foundation flow failed");
    throw AppError.internal("Failed to list foundation proposals");
  }

  return ((data ?? []) as AiProposalRow[]).filter(isFoundationStubBatch);
}

async function insertProposalDrafts(
  bindings: AppBindings,
  projectId: string,
  drafts: ProposalDraft[],
): Promise<AiProposalResponse[]> {
  const admin = createServiceRoleClient(bindings);
  const rows = drafts.map((draft) => ({
    project_id: projectId,
    proposal_type: draft.proposalType,
    status: AI_PROPOSAL_STATUSES.proposed,
    risk_level: draft.riskLevel,
    source: AI_PROPOSAL_SOURCES.system_seed,
    title: draft.title,
    payload: draft.payload,
  }));

  const { data, error } = await admin.from("ai_proposals").insert(rows).select(PROPOSAL_SELECT);

  if (error || !data) {
    console.error("ai_proposals batch insert foundation failed");
    throw AppError.internal("Failed to create foundation proposals");
  }

  return (data as AiProposalRow[]).map(mapAiProposalResponse);
}

// --- Sprint 13.1: real AI foundation proposal generation ---

const FACT_CATEGORY_SET = new Set([
  "identity",
  "relationship",
  "family",
  "event",
  "secret",
  "motive",
  "location",
]);
const FACT_IMPORTANCE_SET = new Set(["minor", "major", "core"]);

function s(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  else if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  return t.trim();
}

/**
 * Maps the AI JSON object to the SAME proposal payload shapes the stub emits, so
 * the canon-promotion path (proposal accept → facts/characters/foundation) is
 * unchanged. Marked `generator: foundation_ai_batch` so dedup/list/regenerate
 * still recognise the batch.
 */
function buildProposalDraftsFromAi(
  parsed: Record<string, unknown>,
  batchId: string,
  conceptTitle: string,
): ProposalDraft[] {
  const baseMeta = { batchId, generator: GENERATOR_MARKER_AI, conceptTitle };
  const drafts: ProposalDraft[] = [];

  const premise = s(parsed.premise);
  const mainConflict = s(parsed.mainConflict);
  const readerPromise = s(parsed.readerPromise);
  const genre = s(parsed.genre);
  const tone = s(parsed.tone);
  const targetReader = s(parsed.targetReader, "hp_serial");

  drafts.push({
    proposalType: AI_PROPOSAL_TYPES.foundation,
    title: `Fondasi: ${conceptTitle}`,
    riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
    payload: { ...baseMeta, premise, mainConflict, readerPromise, genre, targetReader, tone },
  });

  const protagonist =
    parsed.protagonist && typeof parsed.protagonist === "object"
      ? (parsed.protagonist as Record<string, unknown>)
      : {};
  const protagonistName = s(protagonist.name, "Tokoh Utama");
  drafts.push({
    proposalType: AI_PROPOSAL_TYPES.character,
    title: `Tokoh Utama — ${protagonistName}`,
    riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
    payload: {
      ...baseMeta,
      name: protagonistName,
      role: "protagonist",
      description: s(protagonist.description),
      motivation: s(protagonist.motivation),
    },
  });

  // protagonist identity fact (core)
  drafts.push({
    proposalType: AI_PROPOSAL_TYPES.fact,
    title: `Fakta: ${protagonistName} adalah tokoh utama`,
    riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
    payload: {
      ...baseMeta,
      content: `${protagonistName} adalah tokoh utama cerita ini.`,
      category: "identity",
      importance: "core",
      reason: "Identitas pusat untuk serial.",
    },
  });

  const supporting = Array.isArray(parsed.supportingCharacters)
    ? parsed.supportingCharacters.slice(0, 4)
    : [];
  for (const raw of supporting) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const name = s(c.name);
    if (!name) continue;
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.character,
      title: `Tokoh Pendukung — ${name}`,
      riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
      payload: {
        ...baseMeta,
        name,
        role: "supporting",
        description: s(c.description),
        motivation: s(c.motivation),
      },
    });
  }

  const facts = Array.isArray(parsed.facts) ? parsed.facts.slice(0, 6) : [];
  let factCount = 0;
  for (const raw of facts) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    const content = s(f.content);
    if (!content) continue;
    const category = FACT_CATEGORY_SET.has(s(f.category)) ? s(f.category) : "event";
    if (category === "secret") continue; // high-risk secrets handled separately below
    const importance = FACT_IMPORTANCE_SET.has(s(f.importance)) ? s(f.importance) : "major";
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: `Fakta: ${content.slice(0, 60)}`,
      riskLevel:
        importance === "core"
          ? AI_PROPOSAL_RISK_LEVELS.low
          : AI_PROPOSAL_RISK_LEVELS.medium,
      payload: { ...baseMeta, content: content.slice(0, 300), category, importance, reason: "Fakta canon dari konsep & intake." },
    });
    factCount += 1;
  }

  // guarantee >= 2 confirmed-able facts for readiness (protagonist identity + conflict)
  if (factCount === 0 && mainConflict) {
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.fact,
      title: "Fakta: konflik utama",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.medium,
      payload: { ...baseMeta, content: mainConflict.slice(0, 300), category: "event", importance: "major", reason: "Membingkai konflik utama." },
    });
  }

  const styleTags: string[] = Array.isArray(parsed.styleTags)
    ? parsed.styleTags.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];
  drafts.push({
    proposalType: AI_PROPOSAL_TYPES.style,
    title: `Gaya: ${tone || "Serial HP"}`,
    riskLevel: AI_PROPOSAL_RISK_LEVELS.low,
    payload: { ...baseMeta, tone, styleTags, outputStyle: "warm_emotional", reason: "Selaras konsep & target pembaca HP." },
  });

  const secret =
    parsed.secret && typeof parsed.secret === "object"
      ? (parsed.secret as Record<string, unknown>)
      : null;
  const secretSummary = secret ? s(secret.summary) : "";
  if (secretSummary) {
    drafts.push({
      proposalType: AI_PROPOSAL_TYPES.secret,
      title: "Rahasia: masa lalu yang disembunyikan",
      riskLevel: AI_PROPOSAL_RISK_LEVELS.high,
      payload: {
        ...baseMeta,
        summary: secretSummary,
        category: "secret",
        highRiskCategory: "rahasia_besar",
        reason: "Rahasia high-risk — tetap di proposal queue / Reveal Gate.",
      },
    });
  }

  return drafts;
}

const FOUNDATION_AI_SYSTEM_PROMPT =
  "Kamu adalah arsitek fondasi cerita serial. Berdasarkan konsep terpilih dan chat intake penulis, " +
  "hasilkan fondasi cerita sebagai SATU object JSON valid dengan struktur:\n" +
  "{\n" +
  '  "premise": "2-3 kalimat inti cerita",\n' +
  '  "mainConflict": "konflik utama",\n' +
  '  "readerPromise": "janji emosional ke pembaca",\n' +
  '  "targetReader": "mis. hp_serial",\n' +
  '  "genre": "genre",\n' +
  '  "tone": "nada emosional",\n' +
  '  "protagonist": { "name": "nama", "description": "1-2 kalimat", "motivation": "motivasi" },\n' +
  '  "supportingCharacters": [ { "name": "nama", "description": "...", "motivation": "..." } ],\n' +
  '  "facts": [ { "content": "fakta", "category": "identity|relationship|family|event|motive|location", "importance": "minor|major|core" } ],\n' +
  '  "styleTags": ["tag1", "tag2"],\n' +
  '  "secret": { "summary": "rahasia besar yang ditahan" }\n' +
  "}\n\n" +
  "Aturan: spesifik ke ide penulis (bukan template); JANGAN pakai nama klise (Nadira/Arman/Siska); " +
  "minimal 2 supporting characters dan 3 facts; `secret` boleh null jika tidak relevan; " +
  "jangan kembalikan teks apa pun selain JSON valid.";

async function generateFoundationDraftsWithAi(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  ctx: GenerationContext,
): Promise<ProposalDraft[]> {
  const { messages } = await listIntakeMessagesForOwner(bindings, ownerId, projectId);
  const intakeText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const c = ctx.concept;
  const conceptText = [
    `Judul: ${c.title}`,
    `Pitch: ${c.short_pitch}`,
    `Konflik: ${c.core_conflict ?? ""}`,
    `Janji pembaca: ${c.reader_promise ?? ""}`,
    `Genre: ${c.genre ?? ""}`,
    `Tone: ${c.tone ?? ""}`,
    `Target: ${c.target_reader ?? ""}`,
  ].join("\n");

  const promptMessages = [
    { role: "system" as const, content: FOUNDATION_AI_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Konsep terpilih:\n${conceptText}\n\nChat intake penulis:\n${intakeText || "(tidak ada)"}`,
    },
  ];

  const promptHash = await computePromptHashFromMessages(promptMessages);
  const idempotencyKey = `foundation-generation-${projectId}-${crypto.randomUUID()}`;
  const correlationId = generateCorrelationId();

  let attempt = await createGenerationAttempt(bindings, {
    projectId,
    userId: ownerId,
    generationType: GENERATION_TYPES.publish_copy,
    idempotencyKey,
    creditCost: FOUNDATION_AI_CREDIT_COST,
    promptHash,
    correlationId,
    qualityMode: WRITER_QUALITY_MODES.hemat,
    metadata: {
      actualGenerationType: "foundation_proposal",
      billingAlias: "publish_copy",
      task: "13.1",
    },
  });

  let debited = false;
  try {
    await debitCreditsForAttempt(bindings, {
      userId: ownerId,
      projectId,
      attemptId: attempt.id,
      amount: FOUNDATION_AI_CREDIT_COST,
      reason: CREDIT_LEDGER_REASONS.generationDebit,
      generationType: GENERATION_TYPES.publish_copy,
      idempotencyKey,
      correlationId,
    });
    debited = true;
  } catch (err) {
    await markGenerationAttemptFailed(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      errorCode: err instanceof AppError ? err.code : "DEBIT_FAILED",
      errorMessage: err instanceof Error ? err.message : "Credit debit failed",
      correlationId,
    });
    throw err;
  }

  attempt = await markGenerationAttemptRunning(bindings, attempt.id);

  try {
    const routerResult = await generateWithModelRouter(bindings, {
      generationType: GENERATION_TYPES.publish_copy,
      qualityMode: WRITER_QUALITY_MODES.hemat,
      promptHash,
      promptMessages,
      maxOutputTokensOverride: 3000,
      temperature: 0.4,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(routerResult.text));
    } catch {
      throw new AppError(
        "GENERATION_FAILED",
        "AI mengembalikan format fondasi yang tidak valid. Coba lagi.",
        502,
      );
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AppError("GENERATION_FAILED", "AI tidak mengembalikan fondasi yang valid. Coba lagi.", 502);
    }

    const drafts = buildProposalDraftsFromAi(
      parsed as Record<string, unknown>,
      ctx.batchId,
      ctx.concept.title,
    );

    await markGenerationAttemptSucceeded(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      provider: routerResult.provider,
      model: routerResult.model,
      inputTokens: routerResult.inputTokens,
      outputTokens: routerResult.outputTokens,
      outputEntityId: "00000000-0000-0000-0000-000000000000",
      outputEntityType: "ai_proposal",
      correlationId,
    });

    return drafts;
  } catch (err) {
    if (debited) {
      try {
        await refundCreditsForAttempt(bindings, {
          userId: ownerId,
          projectId,
          attemptId: attempt.id,
          amount: FOUNDATION_AI_CREDIT_COST,
          reason: CREDIT_LEDGER_REASONS.generationRefund,
          generationType: GENERATION_TYPES.publish_copy,
          idempotencyKey,
          correlationId,
        });
      } catch (refundErr) {
        console.error("credit refund failed:", refundErr);
      }
    }
    await markGenerationAttemptFailed(bindings, {
      attemptId: attempt.id,
      userId: ownerId,
      projectId,
      errorCode: err instanceof AppError ? err.code : "AI_FAILED",
      errorMessage: err instanceof Error ? err.message : "AI foundation generation failed",
      correlationId,
    });
    throw err;
  }
}

export async function generateFoundationProposalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ proposals: AiProposalResponse[]; created: boolean; batchId: string | null }> {
  const regenerate =
    body.regenerate === true ||
    (typeof body.regenerate === "string" && body.regenerate === "true");

  const projectRow = await getOwnedProjectRow(bindings, ownerId, projectId);
  const concept = await loadSelectedConcept(bindings, projectRow);

  const existingProposed = await listExistingStubBatch(
    bindings,
    projectId,
    AI_PROPOSAL_STATUSES.proposed,
  );

  if (!regenerate && existingProposed.length > 0) {
    const batchId =
      (parsePayload(existingProposed[0].payload).batchId as string | undefined) ?? null;
    return {
      proposals: existingProposed.map(mapAiProposalResponse),
      created: false,
      batchId,
    };
  }

  const admin = createServiceRoleClient(bindings);
  const now = new Date().toISOString();

  if (regenerate && existingProposed.length > 0) {
    const ids = existingProposed.map((r) => r.id);
    const { error: rejectError } = await admin
      .from("ai_proposals")
      .update({
        status: AI_PROPOSAL_STATUSES.rejected,
        review_note: "regenerated",
        reviewed_at: now,
        reviewed_by: ownerId,
      })
      .in("id", ids)
      .eq("project_id", projectId)
      .eq("status", AI_PROPOSAL_STATUSES.proposed);

    if (rejectError) {
      console.error("ai_proposals reject for regenerate failed");
      throw AppError.internal("Failed to regenerate foundation proposals");
    }
  }

  const signalCtx = await loadSignalsContext(bindings, projectId);
  const foundation = await fetchFoundationRow(bindings, projectId);
  const batchId = crypto.randomUUID();

  if (!concept) {
    throw AppError.badRequest("Pilih konsep cerita terlebih dahulu sebelum membuat usulan fondasi.");
  }

  const genCtx: GenerationContext = {
    project: projectRow,
    concept,
    foundation,
    hasFamilyConflict: signalCtx.hasFamilyConflict,
    hasSecret: signalCtx.hasSecret,
    batchId,
  };

  // Real AI when generation is enabled and not in provider-mock mode; otherwise
  // the deterministic stub (offline/dev/AI-off) remains the honest fallback.
  const useAi = isAiGenerationEnabled(bindings) && !isAiProviderMock(bindings);
  const drafts = useAi
    ? await generateFoundationDraftsWithAi(bindings, ownerId, projectId, genCtx)
    : buildProposalDrafts(genCtx);

  const proposals = await insertProposalDrafts(bindings, projectId, drafts);

  return { proposals, created: true, batchId };
}

export async function listFoundationProposalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  query: { status?: string; includeResolved?: string },
): Promise<AiProposalResponse[]> {
  await getOwnedProjectRow(bindings, ownerId, projectId);

  const includeResolved = query.includeResolved === "true";
  const statusFilter = query.status
    ? query.status
    : includeResolved
      ? undefined
      : AI_PROPOSAL_STATUSES.proposed;

  const rows = await listExistingStubBatch(bindings, projectId, statusFilter);
  return rows.map(mapAiProposalResponse);
}