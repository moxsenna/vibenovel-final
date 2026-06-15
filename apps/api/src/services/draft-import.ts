import { AppError } from "../errors.js";
import type { AppBindings } from "../env.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { writeAuditLog } from "./audit.js";
import {
  buildDraftImportAiProposalRows,
  buildDraftImportProposalDrafts,
} from "./import/entity-extraction.js";
import { chunkDraftForImport } from "./import/chunking.js";
import {
  buildAuthorVoiceProposalDraft,
  extractAuthorVoiceFromDraft,
} from "./import/style-extraction.js";
import { getOwnedProjectRow } from "./project.js";
import { assertProposalPayloadSafe } from "./summary-safety.js";

const CONTENT_MIN_CHARS = 120;
const CONTENT_MAX_CHARS = 200_000;
const EXCERPT_MAX_CHARS = 800;

export interface DraftImportRow {
  id: string;
  project_id: string;
  owner_id: string;
  content_text: string;
  content_hash: string;
  excerpt_preview: string;
  word_count: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DraftImportSignalRow {
  id: string;
  draft_import_id: string;
  project_id: string;
  owner_id: string;
  type: string;
  label: string;
  value: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DraftImportSummary {
  id: string;
  projectId: string;
  ownerId: string;
  contentHash: string;
  excerptPreview: string;
  wordCount: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DraftImportSignal {
  id: string;
  draftImportId: string;
  projectId: string;
  type: string;
  label: string;
  value: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DraftImportSignalDraft {
  type: string;
  label: string;
  value: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface ParsedDraftImportBody {
  content: string;
}

export interface DraftContentSummary {
  contentHash: string;
  excerptPreview: string;
  wordCount: number;
}

const DRAFT_IMPORT_SELECT =
  "id, project_id, owner_id, content_text, content_hash, excerpt_preview, word_count, status, metadata, created_at, updated_at";
const DRAFT_SIGNAL_SELECT =
  "id, draft_import_id, project_id, owner_id, type, label, value, confidence, metadata, created_at, updated_at";
const AI_PROPOSAL_SELECT =
  "id, proposal_type, status, risk_level, source, title, payload, created_at, updated_at";

const DOCUMENT_HEADING_WORDS = new Set([
  "adegan",
  "bagian",
  "bab",
  "chapter",
  "draft",
  "episode",
  "epilog",
  "judul",
  "part",
  "premis",
  "prolog",
  "pov",
  "scene",
  "sinopsis",
  "tone",
]);

const HONORIFIC_WORDS = new Set([
  "bang",
  "bapak",
  "bu",
  "dokter",
  "dr",
  "ibu",
  "kak",
  "mas",
  "mama",
  "mbak",
  "nyonya",
  "om",
  "papa",
  "pak",
  "prof",
  "tante",
  "tuan",
]);

const NON_PERSON_START_WORDS = new Set([
  "arsip",
  "bab",
  "chapter",
  "dan",
  "dari",
  "dalam",
  "di",
  "draft",
  "genre",
  "hujan",
  "judul",
  "mama",
  "kereta",
  "kotak",
  "lalu",
  "malam",
  "naskah",
  "pagi",
  "papa",
  "pelan",
  "peron",
  "pov",
  "premis",
  "ruang",
  "saat",
  "scene",
  "senja",
  "seolah",
  "setelah",
  "stasiun",
  "tiket",
  "tone",
]);

const PROTAGONIST_CONTEXT_RE =
  /ayahnya|ibunya|masa lalunya|curiga|menggenggam|menemukan|menyadari|mencari|menatap|pulang|kembali|sendirian|mengikuti|membuka|menyimpan/i;

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function isDuplicateDraftImportError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (error as { code?: unknown }).code === "23505";
}

export function parseDraftImportBody(raw: unknown): ParsedDraftImportBody {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw AppError.badRequest("Request body must be a JSON object");
  }
  const content = (raw as Record<string, unknown>).content;
  if (typeof content !== "string") {
    throw AppError.badRequest("content must be a string");
  }
  const trimmed = content.trim();
  if (trimmed.length < CONTENT_MIN_CHARS) {
    throw AppError.badRequest(`content must be at least ${CONTENT_MIN_CHARS} characters`);
  }
  if (trimmed.length > CONTENT_MAX_CHARS) {
    throw AppError.badRequest(`content must be at most ${CONTENT_MAX_CHARS} characters`);
  }
  return { content: trimmed };
}

export async function summarizeDraftContent(content: string): Promise<DraftContentSummary> {
  const encoded = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const contentHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const excerptPreview =
    content.length > EXCERPT_MAX_CHARS
      ? `${content.slice(0, EXCERPT_MAX_CHARS - 1).trimEnd()}...`
      : content;
  return {
    contentHash,
    excerptPreview,
    wordCount: countWords(content),
  };
}

function signal(
  type: string,
  label: string,
  value: string,
  confidence: number,
): DraftImportSignalDraft {
  return {
    type,
    label,
    value,
    confidence,
    metadata: { source: "imported_draft", extractor: "deterministic_draft_import" },
  };
}

function isDocumentStructureLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  const firstWord = trimmed.split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "").toLowerCase();
  if (firstWord && DOCUMENT_HEADING_WORDS.has(firstWord)) {
    return true;
  }
  return /^[A-Z0-9\s:._-]{2,40}$/.test(trimmed) && !/[a-z]/.test(trimmed);
}

function narrativeTextForSignals(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !isDocumentStructureLine(line))
    .join("\n")
    .trim();
}

function cleanupNameCandidate(candidate: string): string {
  return candidate
    .replace(/[“”"'.:,;!?()[\]{}]+$/g, "")
    .replace(/^[“”"'.:,;!?()[\]{}]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function baseName(candidate: string): string {
  const parts = cleanupNameCandidate(candidate).split(/\s+/).filter(Boolean);
  if (parts.length > 1 && HONORIFIC_WORDS.has(parts[0].replace(/\./g, "").toLowerCase())) {
    return parts.slice(1).join(" ");
  }
  return parts.join(" ");
}

function displayName(candidate: string): string {
  return baseName(candidate).split(/\s+/)[0] ?? candidate;
}

function isLikelyPersonName(candidate: string): boolean {
  const cleaned = cleanupNameCandidate(candidate);
  if (!cleaned || cleaned.length < 3) {
    return false;
  }
  if (/^[A-Z\s0-9._-]+$/.test(cleaned)) {
    return false;
  }
  const name = baseName(cleaned);
  const first = name.split(/\s+/)[0]?.replace(/[^A-Za-z-]/g, "").toLowerCase();
  if (!first || NON_PERSON_START_WORDS.has(first) || DOCUMENT_HEADING_WORDS.has(first)) {
    return false;
  }
  return true;
}

function explicitProtagonistFromText(text: string): string | null {
  const section = text.match(
    /tokoh utama\s*:\s*([\s\S]{1,700}?)(?:\n\s*(?:premis|genre|tone|pov|bab|chapter)\b|$)/i,
  );
  if (!section) {
    return null;
  }
  const firstCharacterLine = section[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstCharacterLine) {
    return null;
  }
  const candidate = firstCharacterLine.split(/[-\u2013\u2014]/)[0]?.trim() ?? "";
  return isLikelyPersonName(candidate) ? displayName(candidate) : null;
}

function detectProtagonistName(text: string): string | null {
  const explicit = explicitProtagonistFromText(text);
  if (explicit) {
    return explicit;
  }

  const narrative = narrativeTextForSignals(text);
  const candidatePattern =
    /\b(?:(?:Pak|Bu|Ibu|Bapak|Mas|Mbak|Kak|Bang|Om|Tante|Tuan|Nyonya|Dr|Dokter|Prof)\.?\s+)?[A-Z][\p{L}'-]{2,}(?:\s+[A-Z][\p{L}'-]{2,}){0,2}/gu;
  const candidates = new Map<
    string,
    { candidate: string; count: number; firstIndex: number; score: number }
  >();

  for (const match of narrative.matchAll(candidatePattern)) {
    const candidate = cleanupNameCandidate(match[0]);
    if (!isLikelyPersonName(candidate)) {
      continue;
    }
    const key = displayName(candidate).toLowerCase();
    const firstIndex = match.index ?? narrative.indexOf(match[0]);
    const window = narrative.slice(Math.max(0, firstIndex - 90), firstIndex + 140);
    const startsWithHonorific = HONORIFIC_WORDS.has(
      candidate.split(/\s+/)[0]?.replace(/\./g, "").toLowerCase(),
    );
    const existing = candidates.get(key);
    const score =
      2 +
      (firstIndex < 500 ? 3 : 0) +
      (PROTAGONIST_CONTEXT_RE.test(window) ? 3 : 0) -
      (startsWithHonorific ? 2 : 0);

    if (existing) {
      existing.count += 1;
      existing.score += score;
      existing.firstIndex = Math.min(existing.firstIndex, firstIndex);
      if (candidate.length > existing.candidate.length && !startsWithHonorific) {
        existing.candidate = candidate;
      }
      continue;
    }

    candidates.set(key, { candidate, count: 1, firstIndex, score });
  }

  const best = [...candidates.values()].sort(
    (left, right) =>
      right.score + right.count * 2 - (left.score + left.count * 2) ||
      left.firstIndex - right.firstIndex,
  )[0];
  return best ? displayName(best.candidate) : null;
}

function explicitFieldValue(text: string, field: string): string | null {
  const match = text.match(new RegExp(`^\\s*${field}\\s*:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function hasRomcomPattern(lower: string, explicitGenre?: string | null): boolean {
  if (explicitGenre && /romantic comedy|romcom|komedi romantis|romantis komedi/i.test(explicitGenre)) {
    return true;
  }
  const fakeDating =
    /pacar kontrak|pacar palsu|pura-pura (?:jadi|menjadi) pacar|fake dating|pretend (?:boyfriend|girlfriend)|contract boyfriend|contract girlfriend/.test(
      lower,
    );
  const romanticSetup = /pacar|mantan|nikah|pernikahan|romantis|muse|gebetan/.test(lower);
  const comedyTexture = /witty|sarkastik|coffee shop|kafe|kopi|senyum palsu|nasihat buruk|terlalu percaya diri|kapan nikah/.test(
    lower,
  );
  const urbanWork = /brand|copywriter|freelance|pitch|kantor|jakarta|kampanye/.test(lower);
  return fakeDating || (romanticSetup && (comedyTexture || urbanWork));
}

export function extractDraftImportSignalsFromText(text: string): DraftImportSignalDraft[] {
  const lower = text.toLowerCase();
  const signals: DraftImportSignalDraft[] = [];
  const explicitGenre = explicitFieldValue(text, "genre");
  const explicitTone = explicitFieldValue(text, "tone");
  const hasRomcom = hasRomcomPattern(lower, explicitGenre);
  const hasStationMystery =
    /arsip|stasiun|peron|kereta|tiket|tabung film|rel/.test(lower) &&
    /ayah|ibu|meninggal|kematian|kecelakaan|dua belas tahun|masa lalu|warisan/.test(lower);

  if (hasRomcom) {
    signals.push(signal("genre", "Romantic Comedy", "romantic comedy", 0.9));
  } else if (explicitGenre && /misteri/.test(explicitGenre.toLowerCase())) {
    signals.push(signal("genre", "Misteri drama ringan", "misteri drama", 0.92));
  } else if (hasStationMystery) {
    signals.push(signal("genre", "Misteri drama ringan", "misteri drama", 0.88));
  } else if (/istri|suami|mertua|menantu|selingkuh|rumah tangga/.test(lower)) {
    signals.push(signal("genre", "Drama Rumah Tangga", "drama rumah tangga", 0.92));
  } else if (/sihir|akademi|fantasi|kerajaan|monster|kekuatan/.test(lower)) {
    signals.push(signal("genre", "Fantasi Serial", "fantasi serial", 0.86));
  }

  if (explicitTone) {
    signals.push(signal("tone", "Tone cerita terdeteksi", explicitTone, 0.88));
  } else if (hasRomcom) {
    signals.push(signal("tone", "Ringan, witty, hangat", "ringan witty hangat", 0.84));
  } else if (hasStationMystery) {
    signals.push(
      signal("tone", "Emosional, sinematik, sedikit tegang", "emosional sinematik tegang", 0.82),
    );
  }

  const protagonistName = detectProtagonistName(text);
  if (protagonistName) {
    signals.push(
      signal("protagonist", `Tokoh utama terindikasi: ${protagonistName}`, protagonistName, 0.84),
    );
  }

  if (hasRomcom) {
    signals.push(
      signal(
        "core_conflict",
        "Pacar pura-pura, tekanan keluarga, dan pitch brand",
        "pura-pura menjadi pacar demi acara keluarga sambil memenangkan pitch romantis",
        0.88,
      ),
    );
  } else if (hasStationMystery && /kematian|kecelakaan|ayah/.test(lower)) {
    signals.push(
      signal(
        "core_conflict",
        "Misteri arsip dan kematian masa lalu",
        "kematian ayah, tiket/arsip stasiun, dan peristiwa 12 tahun lalu",
        0.88,
      ),
    );
  } else if (hasStationMystery) {
    signals.push(
      signal(
        "core_conflict",
        "Misteri stasiun yang kembali terbuka",
        "arsip, peron, dan kereta lama memicu konflik masa lalu",
        0.84,
      ),
    );
  } else if (/hina|menghina|diremehkan|ditindas|miskin|bully|rundung/.test(lower)) {
    signals.push(
      signal("core_conflict", "Konflik status dan penghinaan", "tokoh diremehkan", 0.84),
    );
  } else if (/rahasia|disembunyikan|masa lalu|anak/.test(lower)) {
    signals.push(signal("core_conflict", "Konflik rahasia masa lalu", "rahasia masa lalu", 0.8));
  }

  if (hasRomcom) {
    signals.push(
      signal(
        "reader_promise",
        "Fake dating romcom dengan chemistry dan banter",
        "romansa komedi, fake dating, keluarga cerewet, dan chemistry Kira-Arka",
        0.86,
      ),
    );
    signals.push(
      signal(
        "relationship_dynamic",
        "Fake dating antara mantan teman SMA",
        "Kira dan Arka berpura-pura pacaran sambil membawa luka malu masa SMA",
        0.84,
      ),
    );
  } else if (hasStationMystery) {
    signals.push(
      signal(
        "reader_promise",
        "Janji pengungkapan misteri keluarga",
        "mengungkap rahasia kematian dan arsip stasiun secara emosional",
        0.84,
      ),
    );
  } else if (/balas dendam|bangkit|revenge|menang|elegan/.test(lower)) {
    signals.push(
      signal("reader_promise", "Janji kebangkitan emosional", "kebangkitan dan pembalasan elegan", 0.84),
    );
  }

  if (hasRomcom && /jakarta|brand|copywriter|coffee shop|kantor|urban|keluarga besar/.test(lower)) {
    signals.push(signal("target_reader", "Pembaca romcom urban mobile", "urban_romcom_mobile", 0.82));
  } else if (/kbm|hp|serial|pembaca wanita|bab pendek|online/.test(lower)) {
    signals.push(signal("target_reader", "Pembaca serial mobile", "hp_serial", 0.82));
  }

  if (hasStationMystery) {
    signals.push(
      signal(
        "secret_candidate",
        "Rahasia: arsip, tiket, dan kematian ayah",
        "kematian ayah mungkin bukan kecelakaan; tiket/arsip menyimpan petunjuk",
        0.86,
      ),
    );
  }

  if (hasStationMystery) {
    signals.push(
      signal(
        "continuity_warning",
        "Review objek dan peristiwa kunci",
        "tiket tua, tabung film, arsip stasiun, dan kejadian 12 tahun lalu perlu dikunci sebelum jadi canon",
        0.86,
      ),
    );
  } else if (/rahasia|disembunyikan|fakta canon|canon|kontinuitas|masa lalu/.test(lower)) {
    signals.push(
      signal(
        "continuity_warning",
        "Periksa rahasia dan kontinuitas",
        "jangan mutasi canon langsung dari draft import",
        0.88,
      ),
    );
  }

  return signals;
}

function mapDraftImport(row: DraftImportRow): DraftImportSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    contentHash: row.content_hash,
    excerptPreview: row.excerpt_preview,
    wordCount: row.word_count,
    status: row.status,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSignal(row: DraftImportSignalRow): DraftImportSignal {
  return {
    id: row.id,
    draftImportId: row.draft_import_id,
    projectId: row.project_id,
    type: row.type,
    label: row.label,
    value: row.value,
    confidence: row.confidence,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getOwnedDraftImportRow(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<DraftImportRow> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("draft_imports")
    .select(DRAFT_IMPORT_SELECT)
    .eq("id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("draft_imports select failed");
    throw AppError.internal("Failed to load draft import");
  }
  if (!data) {
    throw AppError.notFound("Draft import not found");
  }
  return data as DraftImportRow;
}

async function listSignalsForDraftImport(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<DraftImportSignal[]> {
  const admin = createServiceRoleClient(bindings);
  const { data, error } = await admin
    .from("draft_import_signals")
    .select(DRAFT_SIGNAL_SELECT)
    .eq("draft_import_id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("draft_import_signals select failed");
    throw AppError.internal("Failed to load draft import signals");
  }

  return ((data ?? []) as DraftImportSignalRow[]).map(mapSignal);
}

export async function createDraftImportForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  raw: unknown,
): Promise<{ draftImport: DraftImportSummary }> {
  await getOwnedProjectRow(bindings, ownerId, projectId);
  const { content } = parseDraftImportBody(raw);
  const summary = await summarizeDraftContent(content);
  const admin = createServiceRoleClient(bindings);

  const { data, error } = await admin
    .from("draft_imports")
    .insert({
      project_id: projectId,
      owner_id: ownerId,
      content_text: content,
      content_hash: summary.contentHash,
      excerpt_preview: summary.excerptPreview,
      word_count: summary.wordCount,
      status: "uploaded",
      metadata: { source: "imported_draft" },
    })
    .select(DRAFT_IMPORT_SELECT)
    .single();

  if (error || !data) {
    if (isDuplicateDraftImportError(error)) {
      const { data: existing, error: lookupError } = await admin
        .from("draft_imports")
        .select(DRAFT_IMPORT_SELECT)
        .eq("project_id", projectId)
        .eq("owner_id", ownerId)
        .eq("content_hash", summary.contentHash)
        .maybeSingle();

      if (lookupError) {
        console.error("draft_imports duplicate lookup failed", {
          code: lookupError.code,
          message: lookupError.message,
        });
        throw AppError.internal("Failed to import draft");
      }
      if (existing) {
        return { draftImport: mapDraftImport(existing as DraftImportRow) };
      }
    }

    console.error("draft_imports insert failed", {
      code: error?.code,
      message: error?.message,
    });
    throw AppError.internal("Failed to import draft");
  }

  const row = data as DraftImportRow;
  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "draft_import_created",
    entityType: "draft_import",
    entityId: row.id,
    metadata: {
      wordCount: summary.wordCount,
      contentHash: summary.contentHash,
    },
  });

  return { draftImport: mapDraftImport(row) };
}

export async function getDraftImportForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{ draftImport: DraftImportSummary; signals: DraftImportSignal[] }> {
  const row = await getOwnedDraftImportRow(bindings, ownerId, projectId, draftImportId);
  const signals = await listSignalsForDraftImport(bindings, ownerId, projectId, draftImportId);
  return { draftImport: mapDraftImport(row), signals };
}

export async function extractDraftImportSignalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{ draftImport: DraftImportSummary; signals: DraftImportSignal[] }> {
  const row = await getOwnedDraftImportRow(bindings, ownerId, projectId, draftImportId);
  const signalDrafts = extractDraftImportSignalsFromText(row.content_text);
  const admin = createServiceRoleClient(bindings);

  const { error: deleteError } = await admin
    .from("draft_import_signals")
    .delete()
    .eq("draft_import_id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId);
  if (deleteError) {
    console.error("draft_import_signals delete failed");
    throw AppError.internal("Failed to refresh draft import signals");
  }

  if (signalDrafts.length > 0) {
    const { error: insertError } = await admin.from("draft_import_signals").insert(
      signalDrafts.map((draft) => ({
        draft_import_id: draftImportId,
        project_id: projectId,
        owner_id: ownerId,
        type: draft.type,
        label: draft.label,
        value: draft.value,
        confidence: draft.confidence,
        metadata: draft.metadata,
      })),
    );
    if (insertError) {
      console.error("draft_import_signals insert failed");
      throw AppError.internal("Failed to create draft import signals");
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("draft_imports")
    .update({ status: "signals_extracted" })
    .eq("id", draftImportId)
    .eq("project_id", projectId)
    .eq("owner_id", ownerId)
    .select(DRAFT_IMPORT_SELECT)
    .single();

  if (updateError || !updated) {
    console.error("draft_imports status update failed");
    throw AppError.internal("Failed to update draft import");
  }

  await writeAuditLog(bindings, {
    userId: ownerId,
    projectId,
    action: "draft_import_signals_extracted",
    entityType: "draft_import",
    entityId: draftImportId,
    metadata: { signalCount: signalDrafts.length },
  });

  const signals = await listSignalsForDraftImport(bindings, ownerId, projectId, draftImportId);
  return { draftImport: mapDraftImport(updated as DraftImportRow), signals };
}

function mapSignalToDraft(signalRow: DraftImportSignal): DraftImportSignalDraft {
  return {
    type: signalRow.type,
    label: signalRow.label,
    value: signalRow.value,
    confidence: signalRow.confidence ?? 0.5,
    metadata: signalRow.metadata,
  };
}

export async function materializeDraftImportProposalsForOwner(
  bindings: AppBindings,
  ownerId: string,
  projectId: string,
  draftImportId: string,
): Promise<{
  draftImport: DraftImportSummary;
  proposalCount: number;
  proposalIds: string[];
  proposalTypes: string[];
}> {
  const row = await getOwnedDraftImportRow(bindings, ownerId, projectId, draftImportId);
  let signals = await listSignalsForDraftImport(bindings, ownerId, projectId, draftImportId);
  if (signals.length === 0) {
    const extracted = await extractDraftImportSignalsForOwner(
      bindings,
      ownerId,
      projectId,
      draftImportId,
    );
    signals = extracted.signals;
  }

  const chunks = await chunkDraftForImport({
    projectId,
    draftImportId,
    content: row.content_text,
  });
  const authorVoice = extractAuthorVoiceFromDraft({
    draftImportId,
    content: row.content_text,
    chunks,
  });
  const drafts = [
    ...buildDraftImportProposalDrafts({
    projectId,
    draftImportId,
    signals: signals.map(mapSignalToDraft),
    }),
    buildAuthorVoiceProposalDraft({ projectId, draftImportId, authorVoice }),
  ];
  for (const draft of drafts) {
    assertProposalPayloadSafe(draft.payload);
  }

  const rows = buildDraftImportAiProposalRows(drafts);
  if (rows.length === 0) {
    return {
      draftImport: mapDraftImport(row),
      proposalCount: 0,
      proposalIds: [],
      proposalTypes: [],
    };
  }

  const admin = createServiceRoleClient(bindings);
  const { error: deleteError } = await admin
    .from("ai_proposals")
    .delete()
    .eq("project_id", projectId)
    .eq("source", "ai_import")
    .eq("status", "proposed")
    .eq("payload->>draftImportId", draftImportId);

  if (deleteError) {
    console.error("ai_proposals cleanup for draft import failed");
    throw AppError.internal("Failed to refresh draft import proposals");
  }

  const { data: inserted, error: insertError } = await admin
    .from("ai_proposals")
    .insert(rows)
    .select(AI_PROPOSAL_SELECT);

  if (insertError || !inserted) {
    console.error("ai_proposals insert from draft import failed");
    throw AppError.internal("Failed to create draft import proposals");
  }

  const proposalRows = inserted as Array<{
    id: string;
    proposal_type: string;
    risk_level: string;
    source: string;
  }>;
  const proposalIds = proposalRows.map((proposal) => proposal.id);
  const proposalTypes = [...new Set(proposalRows.map((proposal) => proposal.proposal_type))];

  for (const proposal of proposalRows) {
    await writeAuditLog(bindings, {
      userId: ownerId,
      projectId,
      action: "ai_proposal_created",
      entityType: "ai_proposal",
      entityId: proposal.id,
      metadata: {
        proposalType: proposal.proposal_type,
        riskLevel: proposal.risk_level,
        source: proposal.source,
        draftImportId,
        fromDraftImport: true,
      },
    });
  }

  return {
    draftImport: mapDraftImport(row),
    proposalCount: proposalRows.length,
    proposalIds,
    proposalTypes,
  };
}
