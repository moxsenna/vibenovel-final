import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  ChapterBeat,
  ChapterOutline,
  ChapterProseVersion,
  CreditBalance,
  CreatorMode,
  WriterQualityMode,
} from "@vibenovel/shared";
import { WRITER_QUALITY_MODES } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { createEmptyChapterDraft } from "@/lib/empty-states";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { ROUTES } from "@/routes/paths";
import { mockChapterDraft } from "@/mocks/chapter";
import {
  buildBeatProseIdempotencyKey,
  buildRewriteProseIdempotencyKey,
  formatProseBeatActionCostLabel,
  formatProseBeatCreditCostLabel,
  formatProseRewriteActionCostLabel,
  formatQualityModeLabel,
  generateBeatProse,
  getProseBeatCreditCost,
  getProseRewriteCreditCost,
  mapAiGenerationErrorCode,
  mapAiRewriteErrorCode,
  normalizeQualityMode,
  PROSE_REWRITE_MODES,
  rewriteBeatProse,
  type ProseRewriteMode,
} from "@/services/ai";
import {
  fetchApiHealthFlags,
  fetchCreditBalance,
  fetchCreditEstimate,
} from "@/services/credits";
import { fetchOutlineBundle } from "@/services/outline";
import { fetchProjectSettings } from "@/services/settings";
import {
  buildContextPacket,
  fetchBeatProseVersions,
  fetchSessionBeats,
  fetchWritingSession,
  generateSessionBeats,
  makeProseVersionCurrent,
  markSessionReadyForSummary,
  patchWritingSession,
  saveBeatProse,
  startWritingSession,
  type BuildContextPacketResponse,
} from "@/services/write";
import type { Beat, BeatStatus, ChapterDraft } from "@/types";

export type WriteDataSource = "mock" | "api" | "locked" | "error";

export interface SafeContextPreview {
  chapterTitle: string;
  chapterNumber: number;
  mustIncludeCount: number;
  mustNotIncludeCount: number;
  storyCheckLabels: string[];
  packetHashShort: string | null;
  direction: string | null;
  emotionalTarget: string | null;
  povKnowledgeSummary: string | null;
}

const PROSE_SAFETY_ERROR =
  "Teks ini terlihat berisi data teknis internal. Hapus bagian teknis lalu simpan lagi.";
const MAX_LOCAL_EDIT_HISTORY = 50;

interface BeatEditHistory {
  past: string[];
  future: string[];
}

interface PendingAiProseReview {
  versionId: string;
  previousVersionId: string | null;
}

function formatLastSaved(iso: string | null | undefined): string {
  if (!iso) return "Belum disimpan";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Baru disimpan";
  return `Tersimpan ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}

function mapApiBeatToUi(beat: ChapterBeat, prose: string): Beat {
  return {
    id: beat.id,
    number: beat.beatNumber,
    title: beat.title,
    summary: beat.summary,
    status: beat.status as BeatStatus,
    direction: beat.direction ?? beat.summary,
    prose,
  };
}

function sortProseVersions(versions: ChapterProseVersion[]): ChapterProseVersion[] {
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
}

function withCurrentVersion(
  versions: ChapterProseVersion[],
  currentVersion: ChapterProseVersion,
): ChapterProseVersion[] {
  const withoutCurrent = versions.filter((version) => version.id !== currentVersion.id);
  return sortProseVersions([
    { ...currentVersion, isCurrent: true },
    ...withoutCurrent.map((version) => ({ ...version, isCurrent: false })),
  ]);
}

function buildSafeContextPreview(result: BuildContextPacketResponse): SafeContextPreview {
  const { preview, safety } = result;
  return {
    chapterTitle: preview.chapterTitle,
    chapterNumber: preview.chapterNumber,
    mustIncludeCount: preview.mustInclude.length,
    mustNotIncludeCount: preview.mustNotInclude.length,
    storyCheckLabels: preview.storyCheckLabels,
    packetHashShort: safety.packetHash.slice(0, 8),
    direction: preview.direction,
    emotionalTarget: preview.emotionalTarget,
    povKnowledgeSummary: preview.povKnowledgeSummary,
  };
}

function isOutlineLocked(bundle: Awaited<ReturnType<typeof fetchOutlineBundle>>): boolean {
  return bundle.outlinePlan?.status === "locked";
}

function pickDefaultChapter(chapters: ChapterOutline[]): ChapterOutline | null {
  if (chapters.length === 0) return null;
  return chapters.find((ch) => ch.chapterNumber === 1) ?? chapters[0] ?? null;
}

function missingGateList(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }
  const missing = (details as { missing?: unknown }).missing;
  if (!Array.isArray(missing)) return [];
  return missing.filter((item): item is string => typeof item === "string");
}

function writeRoomGateCopy(missing: string[]): { title: string; description: string } | null {
  const set = new Set(missing);

  if (set.has("foundation_locked")) {
    return {
      title: "Fondasi belum dikunci",
      description:
        "Kunci fondasi cerita terlebih dahulu agar ruang tulis memakai premis, konflik, dan janji pembaca yang stabil.",
    };
  }

  if (
    set.has("outline_locked") ||
    set.has("outline_plan_locked") ||
    set.has("outline_plan")
  ) {
    return {
      title: "Outline belum dikunci",
      description:
        "Kunci outline di halaman Outline sebelum membuka ruang tulis dan membuat sesi menulis.",
    };
  }

  if (
    set.has("chapter_outline") ||
    set.has("chapter_outline_required") ||
    set.has("chapter_outlines")
  ) {
    return {
      title: "Belum ada bab di outline",
      description: "Buat rencana bab di halaman Outline sebelum membuka ruang tulis.",
    };
  }

  return null;
}

function writeRoomErrorCopy(error: ApiClientError): { title: string; description: string } {
  const gateCopy = writeRoomGateCopy(missingGateList(error.details));
  if (gateCopy) return gateCopy;

  if (error.code === "INSUFFICIENT_CREDIT" || error.status === 402) {
    return {
      title: "Kredit tidak cukup",
      description:
        "Saldo kredit belum cukup untuk aksi AI di ruang tulis. Top up kredit atau gunakan mode hemat.",
    };
  }

  if (error.code === "AI_DISABLED" || error.code === "AI_NOT_CONFIGURED") {
    return {
      title: "AI belum aktif",
      description:
        "Generator AI belum aktif di lingkungan ini. Ruang tulis tetap aman, tetapi generasi prose belum bisa dipakai.",
    };
  }

  if (
    error.code === "AI_PROVIDER_ERROR" ||
    error.code === "AI_PROVIDER_TIMEOUT" ||
    error.code === "AI_PROVIDER_RATE_LIMITED"
  ) {
    return {
      title: "AI provider tidak tersedia",
      description:
        "Layanan AI sedang tidak tersedia. Coba lagi setelah provider pulih; kredit dikembalikan jika sudah terpotong.",
    };
  }

  return {
    title: "Ruang tulis tidak bisa dimuat",
    description: `API tidak tersedia (${error.message}). Coba muat ulang.`,
  };
}

export interface UseWriteRoomDataResult {
  draft: ChapterDraft;
  source: WriteDataSource;
  apiMode: boolean;
  loading: boolean;
  saving: boolean;
  buildingContext: boolean;
  generatingBeats: boolean;
  markingReady: boolean;
  notice: string | null;
  workflowNotice: string | null;
  errorNotice: string | null;
  activeBeatId: string;
  onSelectBeat: (beatId: string) => void;
  proseText: string;
  onProseChange: (text: string) => void;
  editable: boolean;
  needsGenerateBeats: boolean;
  generateBeats: () => Promise<void>;
  saveProse: () => Promise<void>;
  buildSafeContext: () => Promise<void>;
  contextPreview: SafeContextPreview | null;
  showPovKnowledgeSummary: boolean;
  finishChapter: () => Promise<void>;
  aiGenerating: boolean;
  aiError: string | null;
  aiNotice: string | null;
  creditCostLabel: string;
  creditActionCostLabel: string;
  creditRewriteCostLabel: string;
  qualityModeLabel: string;
  creditBalance: number | null;
  creditLoading: boolean;
  creditError: string | null;
  proseBeatCreditCost: number;
  insufficientCredit: boolean;
  remainingAfterGenerate: number | null;
  showCreditUi: boolean;
  creditTopupEnabled: boolean | null;
  isMockMode: boolean;
  onGenerateAi?: () => Promise<void>;
  aiUnavailableReason: string | null;
  rewriteGenerating: boolean;
  rewriteError: string | null;
  rewriteNotice: string | null;
  rewriteMode: ProseRewriteMode;
  rewriteInstruction: string;
  setRewriteMode: (mode: ProseRewriteMode) => void;
  setRewriteInstruction: (text: string) => void;
  proseRewriteCreditCost: number;
  insufficientCreditRewrite: boolean;
  remainingAfterRewrite: number | null;
  onRewriteProse?: () => Promise<void>;
  rewriteUnavailableReason: string | null;
  hasProseForRewrite: boolean;
  lockedTitle: string | null;
  lockedDescription: string | null;
  proseVersions: ChapterProseVersion[];
  currentProseVersionId: string | null;
  selectedProseVersionId: string | null;
  onSelectProseVersion: (versionId: string) => void;
  onUseSelectedProseVersion: () => Promise<void>;
  versionApplying: boolean;
  pendingAiVersionId: string | null;
  onAcceptPendingAiVersion: () => void;
  onRejectPendingAiVersion: () => Promise<void>;
  canUndoProse: boolean;
  canRedoProse: boolean;
  undoProse: () => void;
  redoProse: () => void;
}

export function useWriteRoomData(): UseWriteRoomDataResult {
  const { id: routeProjectId } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [draft, setDraft] = useState<ChapterDraft>(() => {
    if (useMocks) return mockChapterDraft;
    return createEmptyChapterDraft(routeProjectId ?? "unknown");
  });
  const [source, setSource] = useState<WriteDataSource>(useMocks ? "mock" : "api");
  const [loading, setLoading] = useState(apiMode);
  const [saving, setSaving] = useState(false);
  const [buildingContext, setBuildingContext] = useState(false);
  const [generatingBeats, setGeneratingBeats] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chapterOutlineId, setChapterOutlineId] = useState<string | null>(null);
  const [apiBeats, setApiBeats] = useState<ChapterBeat[]>([]);
  const [activeBeatId, setActiveBeatId] = useState("");
  const [proseByBeatId, setProseByBeatId] = useState<Record<string, string>>({});
  const [proseVersionIdByBeatId, setProseVersionIdByBeatId] = useState<
    Record<string, string | null>
  >({});
  const [proseVersionsByBeatId, setProseVersionsByBeatId] = useState<
    Record<string, ChapterProseVersion[]>
  >({});
  const [selectedProseVersionIdByBeatId, setSelectedProseVersionIdByBeatId] =
    useState<Record<string, string | null>>({});
  const [pendingAiReviewByBeatId, setPendingAiReviewByBeatId] = useState<
    Record<string, PendingAiProseReview | null>
  >({});
  const [editHistoryByBeatId, setEditHistoryByBeatId] = useState<
    Record<string, BeatEditHistory>
  >({});
  const [proseText, setProseText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [needsGenerateBeats, setNeedsGenerateBeats] = useState(false);
  const [packetLogId, setPacketLogId] = useState<string | null>(null);
  const [contextPreview, setContextPreview] = useState<SafeContextPreview | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [qualityMode, setQualityMode] = useState<WriterQualityMode>(WRITER_QUALITY_MODES.seimbang);
  const [serverCreditCosts, setServerCreditCosts] = useState<{
    proseBeat: number | null;
    proseRewrite: number | null;
  }>({ proseBeat: null, proseRewrite: null });
  const [creatorMode, setCreatorMode] = useState<CreatorMode>("simple");
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [creditTopupEnabled, setCreditTopupEnabled] = useState<boolean | null>(null);
  const [aiGenerationEnabled, setAiGenerationEnabled] = useState<boolean | null>(null);
  const [rewriteGenerating, setRewriteGenerating] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteNotice, setRewriteNotice] = useState<string | null>(null);
  const [rewriteMode, setRewriteMode] = useState<ProseRewriteMode>(
    PROSE_REWRITE_MODES.improve_emotion,
  );
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [versionApplying, setVersionApplying] = useState(false);
  const [lockedTitle, setLockedTitle] = useState<string | null>(null);
  const [lockedDescription, setLockedDescription] = useState<string | null>(null);

  const applyBlocked = useCallback(
    (kind: "locked" | "error", title: string, description: string) => {
      const empty = createEmptyChapterDraft(routeProjectId ?? "unknown");
      setDraft(empty);
      setApiBeats([]);
      setActiveBeatId("");
      setProseByBeatId({});
      setProseVersionIdByBeatId({});
      setProseVersionsByBeatId({});
      setSelectedProseVersionIdByBeatId({});
      setPendingAiReviewByBeatId({});
      setEditHistoryByBeatId({});
      setProseText("");
      setSource(kind);
      setLockedTitle(title);
      setLockedDescription(description);
      setNotice(null);
      setNeedsGenerateBeats(false);
      setContextPreview(null);
      setCreatorMode("simple");
      setPacketLogId(null);
      setAiGenerating(false);
      setAiError(null);
      setAiNotice(null);
      setCreditBalance(null);
      setCreditLoading(false);
      setCreditError(null);
      setCreditTopupEnabled(null);
      setRewriteGenerating(false);
      setRewriteError(null);
      setRewriteNotice(null);
      setRewriteMode(PROSE_REWRITE_MODES.improve_emotion);
      setRewriteInstruction("");
      setVersionApplying(false);
    },
    [routeProjectId],
  );

  const applyMockFallback = useCallback((message: string | null) => {
    setDraft(mockChapterDraft);
    setApiBeats([]);
    setActiveBeatId(mockChapterDraft.beats[0]?.id ?? "");
    setProseByBeatId({});
    setProseVersionIdByBeatId({});
    setProseVersionsByBeatId({});
    setSelectedProseVersionIdByBeatId({});
    setPendingAiReviewByBeatId({});
    setEditHistoryByBeatId({});
    setProseText(mockChapterDraft.beats[0]?.prose ?? "");
    setSource("mock");
    setLockedTitle(null);
    setLockedDescription(null);
    setNotice(message);
    setNeedsGenerateBeats(false);
    setContextPreview(null);
    setCreatorMode("simple");
    setPacketLogId(null);
    setVersionApplying(false);
  }, []);

  const refreshCreditBalance = useCallback(async () => {
    if (!apiMode || !token) return;
    setCreditLoading(true);
    setCreditError(null);
    try {
      const balance = await fetchCreditBalance(token);
      setCreditBalance(balance);
    } catch {
      setCreditBalance(null);
      setCreditError("Saldo kredit belum bisa dimuat.");
    } finally {
      setCreditLoading(false);
    }
  }, [apiMode, token]);

  useEffect(() => {
    if (!apiMode || !token) {
      setServerCreditCosts({ proseBeat: null, proseRewrite: null });
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetchCreditEstimate("prose_beat", qualityMode, token),
      fetchCreditEstimate("prose_rewrite", qualityMode, token),
    ])
      .then(([proseBeat, proseRewrite]) => {
        if (!cancelled) {
          setServerCreditCosts({
            proseBeat: proseBeat.creditCost,
            proseRewrite: proseRewrite.creditCost,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerCreditCosts({ proseBeat: null, proseRewrite: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiMode, qualityMode, token]);

  useEffect(() => {
    if (!apiMode) {
      setCreditTopupEnabled(null);
      setAiGenerationEnabled(null);
      return;
    }
    let cancelled = false;
    void fetchApiHealthFlags().then((flags) => {
      if (!cancelled) {
        setCreditTopupEnabled(flags.creditTopupEnabled);
        setAiGenerationEnabled(flags.aiGenerationEnabled);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiMode]);

  const rebuildDraft = useCallback(
    (
      resolvedProjectId: string,
      chapterNumber: number,
      chapterTitle: string,
      beats: Beat[],
      wc: number,
      savedAt: string | null,
    ) => {
      setDraft({
        ...mockChapterDraft,
        projectId: routeProjectId ?? resolvedProjectId,
        chapterNumber,
        chapterTitle,
        wordCount: wc,
        lastSavedLabel: formatLastSaved(savedAt),
        beats,
        summaryRoute: ROUTES.project.summary(routeProjectId ?? resolvedProjectId),
      });
    },
    [routeProjectId],
  );

  const loadProseForBeat = useCallback(
    async (resolvedProjectId: string, beatId: string) => {
      if (!token) return "";
      const result = await fetchBeatProseVersions(resolvedProjectId, beatId, token);
      const text = result.currentVersion?.proseText ?? "";
      const versionId = result.currentVersion?.id ?? null;
      const sortedVersions = sortProseVersions(result.versions);
      setProseByBeatId((prev) => ({ ...prev, [beatId]: text }));
      setProseVersionIdByBeatId((prev) => ({ ...prev, [beatId]: versionId }));
      setProseVersionsByBeatId((prev) => ({ ...prev, [beatId]: sortedVersions }));
      setSelectedProseVersionIdByBeatId((prev) => ({
        ...prev,
        [beatId]: versionId ?? sortedVersions[0]?.id ?? null,
      }));
      setPendingAiReviewByBeatId((prev) => ({ ...prev, [beatId]: null }));
      return text;
    },
    [token],
  );

  const loadWriteRoom = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);
    setErrorNotice(null);
    setWorkflowNotice(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        if (allowMockFallback()) {
          applyMockFallback("Proyek tidak ditemukan. Menampilkan demo Sprint 1.");
        } else {
          applyBlocked(
            "error",
            "Proyek tidak ditemukan",
            "Proyek ini tidak ada atau Anda tidak memiliki akses.",
          );
        }
        return;
      }

      setProjectId(resolvedId);

      try {
        const settings = await fetchProjectSettings(resolvedId, token);
        setQualityMode(normalizeQualityMode(settings.qualityMode));
        setCreatorMode(settings.creatorMode ?? "simple");
      } catch {
        setQualityMode(WRITER_QUALITY_MODES.seimbang);
        setCreatorMode("simple");
      }

      await refreshCreditBalance();

      const bundle = await fetchOutlineBundle(resolvedId, token);
      if (!isOutlineLocked(bundle)) {
        const copy = writeRoomGateCopy(
          bundle.outlinePlan ? ["outline_plan_locked"] : ["outline_plan"],
        ) ?? {
          title: "Outline belum dikunci",
          description:
            "Kunci outline di halaman Outline sebelum membuka ruang tulis dan membuat sesi menulis.",
        };
        applyBlocked(
          "locked",
          copy.title,
          copy.description,
        );
        return;
      }

      const chapter = pickDefaultChapter(bundle.chapterOutlines);
      if (!chapter) {
        const copy = writeRoomGateCopy(["chapter_outline"]) ?? {
          title: "Belum ada bab di outline",
          description: "Buat rencana bab di halaman Outline sebelum membuka ruang tulis.",
        };
        applyBlocked(
          "locked",
          copy.title,
          copy.description,
        );
        return;
      }

      setLockedTitle(null);
      setLockedDescription(null);

      setChapterOutlineId(chapter.id);

      const started = await startWritingSession(resolvedId, token, {
        chapterOutlineId: chapter.id,
      });
      const sid = started.session.id;
      setSessionId(sid);
      setWordCount(started.writingState.wordCount);
      setLastSavedAt(started.writingState.lastSavedAt);

      const detail = await fetchWritingSession(resolvedId, sid, token);
      const beatsRes = await fetchSessionBeats(resolvedId, sid, token);
      const beats = beatsRes.beats;
      setApiBeats(beats);
      setNeedsGenerateBeats(beats.length === 0);

      const initialBeatId =
        detail.session.activeBeatId ?? detail.activeBeat?.id ?? beats[0]?.id ?? "";
      const proseMap: Record<string, string> = {};

      if (beats.length > 0 && initialBeatId) {
        const text = await loadProseForBeat(resolvedId, initialBeatId);
        proseMap[initialBeatId] = text;
        setProseByBeatId((prev) => ({ ...prev, [initialBeatId]: text }));
        setProseText(text);
      }

      const uiBeats = beats.map((beat) =>
        mapApiBeatToUi(beat, proseMap[beat.id] ?? ""),
      );
      rebuildDraft(
        resolvedId,
        detail.chapterOutline.chapterNumber,
        detail.chapterOutline.title,
        uiBeats,
        detail.writingState.wordCount,
        detail.writingState.lastSavedAt,
      );
      setActiveBeatId(initialBeatId);
      setSource("api");
      setNotice(null);
    } catch (error) {
      if (allowMockFallback()) {
        applyMockFallback(
          error instanceof ApiClientError
            ? `API tidak tersedia (${error.message}). Menampilkan demo Sprint 1.`
            : "API tidak tersedia. Menampilkan demo Sprint 1.",
        );
      } else {
        const missing =
          error instanceof ApiClientError ? missingGateList(error.details) : [];
        const gateCopy = writeRoomGateCopy(missing);
        const copy =
          error instanceof ApiClientError
            ? writeRoomErrorCopy(error)
            : {
                title: "Ruang tulis tidak bisa dimuat",
                description: "API tidak tersedia. Coba muat ulang.",
              };
        applyBlocked(
          gateCopy ? "locked" : "error",
          copy.title,
          copy.description,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    apiMode,
    applyBlocked,
    applyMockFallback,
    loadProseForBeat,
    rebuildDraft,
    refreshCreditBalance,
    routeProjectId,
    token,
  ]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setDraft(mockChapterDraft);
      setSource("mock");
      setActiveBeatId(mockChapterDraft.beats[0]?.id ?? "");
      setProseText(mockChapterDraft.beats[0]?.prose ?? "");
      setProseByBeatId({});
      setProseVersionIdByBeatId({});
      setProseVersionsByBeatId({});
      setSelectedProseVersionIdByBeatId({});
      setPendingAiReviewByBeatId({});
      setEditHistoryByBeatId({});
      setLockedTitle(null);
      setLockedDescription(null);
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk menulis dengan API.");
      return;
    }

    void loadWriteRoom();
  }, [apiMode, authLoading, loadWriteRoom, useMocks]);

  useEffect(() => {
    if (source !== "api") return;
    const beat = apiBeats.find((b) => b.id === activeBeatId);
    if (!beat || !projectId) return;

    const uiBeats = apiBeats.map((b) => mapApiBeatToUi(b, proseByBeatId[b.id] ?? ""));
    rebuildDraft(
      projectId,
      draft.chapterNumber,
      draft.chapterTitle,
      uiBeats,
      wordCount,
      lastSavedAt,
    );
  }, [
    activeBeatId,
    apiBeats,
    draft.chapterNumber,
    draft.chapterTitle,
    lastSavedAt,
    projectId,
    proseByBeatId,
    rebuildDraft,
    source,
    wordCount,
  ]);

  const onSelectBeat = useCallback(
    async (beatId: string) => {
      setActiveBeatId(beatId);
      setErrorNotice(null);
      setAiError(null);
      setAiNotice(null);
      setRewriteError(null);
      setRewriteNotice(null);

      if (source !== "api" || !projectId || !sessionId || !token) {
        const beat = draft.beats.find((b) => b.id === beatId);
        setProseText(beat?.prose ?? "");
        return;
      }

      try {
        await patchWritingSession(projectId, sessionId, token, { activeBeatId: beatId });
        let text = proseByBeatId[beatId];
        if (text === undefined) {
          text = await loadProseForBeat(projectId, beatId);
        }
        setProseText(text);
        setPacketLogId(null);
        setContextPreview(null);
      } catch (error) {
        setWorkflowNotice(
          error instanceof ApiClientError
            ? `Gagal memilih adegan (${error.message}).`
            : "Gagal memilih adegan.",
        );
      }
    },
    [
      draft.beats,
      loadProseForBeat,
      projectId,
      proseByBeatId,
      sessionId,
      source,
      token,
    ],
  );

  const onProseChange = useCallback(
    (text: string) => {
      if (source === "api" && activeBeatId && text !== proseText) {
        const previousText = proseText;
        setEditHistoryByBeatId((prev) => {
          const history = prev[activeBeatId] ?? { past: [], future: [] };
          return {
            ...prev,
            [activeBeatId]: {
              past: [...history.past, previousText].slice(-MAX_LOCAL_EDIT_HISTORY),
              future: [],
            },
          };
        });
      }
      setProseText(text);
      if (source === "api" && activeBeatId) {
        setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: text }));
      }
    },
    [activeBeatId, proseText, source],
  );

  const undoProse = useCallback(() => {
    if (source !== "api" || !activeBeatId) return;
    const history = editHistoryByBeatId[activeBeatId];
    if (!history || history.past.length === 0) return;

    const previousText = history.past[history.past.length - 1] ?? "";
    const nextPast = history.past.slice(0, -1);
    const currentText = proseText;

    setEditHistoryByBeatId((prev) => ({
      ...prev,
      [activeBeatId]: {
        past: nextPast,
        future: [currentText, ...history.future].slice(0, MAX_LOCAL_EDIT_HISTORY),
      },
    }));
    setProseText(previousText);
    setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: previousText }));
  }, [activeBeatId, editHistoryByBeatId, proseText, source]);

  const redoProse = useCallback(() => {
    if (source !== "api" || !activeBeatId) return;
    const history = editHistoryByBeatId[activeBeatId];
    if (!history || history.future.length === 0) return;

    const nextText = history.future[0] ?? "";
    const nextFuture = history.future.slice(1);
    const currentText = proseText;

    setEditHistoryByBeatId((prev) => ({
      ...prev,
      [activeBeatId]: {
        past: [...history.past, currentText].slice(-MAX_LOCAL_EDIT_HISTORY),
        future: nextFuture,
      },
    }));
    setProseText(nextText);
    setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: nextText }));
  }, [activeBeatId, editHistoryByBeatId, proseText, source]);

  const selectProseVersion = useCallback(
    (versionId: string) => {
      if (!activeBeatId) return;
      setSelectedProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: versionId,
      }));
    },
    [activeBeatId],
  );

  const useSelectedProseVersion = useCallback(async () => {
    if (!apiMode || !token || !projectId || !activeBeatId || versionApplying) return;

    const selectedVersionId = selectedProseVersionIdByBeatId[activeBeatId];
    const currentVersionId = proseVersionIdByBeatId[activeBeatId];
    if (!selectedVersionId || selectedVersionId === currentVersionId) return;

    setVersionApplying(true);
    setWorkflowNotice(null);
    setErrorNotice(null);

    try {
      const result = await makeProseVersionCurrent(projectId, selectedVersionId, token);
      const nextVersion = result.version;
      const nextText = nextVersion.proseText;

      setProseText(nextText);
      setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: nextText }));
      setProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: nextVersion.id,
      }));
      setSelectedProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: nextVersion.id,
      }));
      setProseVersionsByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: withCurrentVersion(prev[activeBeatId] ?? [nextVersion], nextVersion),
      }));
      setPendingAiReviewByBeatId((prev) => ({ ...prev, [activeBeatId]: null }));
      setWordCount(result.chapterWordCount);
      setLastSavedAt(nextVersion.createdAt ?? new Date().toISOString());
      setEditHistoryByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: { past: [], future: [] },
      }));
      setWorkflowNotice(`Versi v${nextVersion.versionNumber} dipakai untuk adegan ini.`);
    } catch (error) {
      setErrorNotice(
        error instanceof ApiClientError
          ? `Gagal memakai versi (${error.message}).`
          : "Gagal memakai versi prose.",
      );
    } finally {
      setVersionApplying(false);
    }
  }, [
    activeBeatId,
    apiMode,
    projectId,
    proseVersionIdByBeatId,
    selectedProseVersionIdByBeatId,
    token,
    versionApplying,
  ]);

  const acceptPendingAiVersion = useCallback(() => {
    if (!activeBeatId) return;
    setPendingAiReviewByBeatId((prev) => ({ ...prev, [activeBeatId]: null }));
    setWorkflowNotice("Versi AI diterima untuk adegan ini.");
  }, [activeBeatId]);

  const rejectPendingAiVersion = useCallback(async () => {
    if (!apiMode || !token || !projectId || !activeBeatId || versionApplying) return;

    const pendingReview = pendingAiReviewByBeatId[activeBeatId];
    if (!pendingReview) return;

    if (!pendingReview.previousVersionId) {
      setPendingAiReviewByBeatId((prev) => ({ ...prev, [activeBeatId]: null }));
      setWorkflowNotice("Versi AI ditutup. Belum ada versi sebelumnya untuk dikembalikan.");
      return;
    }

    setVersionApplying(true);
    setWorkflowNotice(null);
    setErrorNotice(null);

    try {
      const result = await makeProseVersionCurrent(
        projectId,
        pendingReview.previousVersionId,
        token,
      );
      const nextVersion = result.version;
      const nextText = nextVersion.proseText;

      setProseText(nextText);
      setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: nextText }));
      setProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: nextVersion.id,
      }));
      setSelectedProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: nextVersion.id,
      }));
      setProseVersionsByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: withCurrentVersion(prev[activeBeatId] ?? [nextVersion], nextVersion),
      }));
      setPendingAiReviewByBeatId((prev) => ({ ...prev, [activeBeatId]: null }));
      setWordCount(result.chapterWordCount);
      setLastSavedAt(nextVersion.createdAt ?? new Date().toISOString());
      setEditHistoryByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: { past: [], future: [] },
      }));
      setWorkflowNotice(`Versi AI ditolak. Kembali ke v${nextVersion.versionNumber}.`);
    } catch (error) {
      setErrorNotice(
        error instanceof ApiClientError
          ? `Gagal menolak versi AI (${error.message}).`
          : "Gagal menolak versi AI.",
      );
    } finally {
      setVersionApplying(false);
    }
  }, [
    activeBeatId,
    apiMode,
    pendingAiReviewByBeatId,
    projectId,
    token,
    versionApplying,
  ]);

  const generateBeats = useCallback(async () => {
    if (!apiMode || !token || !projectId || !sessionId || !chapterOutlineId) return;

    setGeneratingBeats(true);
    setWorkflowNotice(null);
    try {
      const result = await generateSessionBeats(projectId, sessionId, token, {});
      setApiBeats(result.beats);
      setNeedsGenerateBeats(false);

      const firstBeatId = result.beats[0]?.id ?? "";
      if (firstBeatId) {
        await patchWritingSession(projectId, sessionId, token, { activeBeatId: firstBeatId });
        const text = await loadProseForBeat(projectId, firstBeatId);
        setActiveBeatId(firstBeatId);
        setProseText(text);
      }

      const detail = await fetchWritingSession(projectId, sessionId, token);
      const uiBeats = result.beats.map((beat) =>
        mapApiBeatToUi(beat, proseByBeatId[beat.id] ?? ""),
      );
      rebuildDraft(
        projectId,
        detail.chapterOutline.chapterNumber,
        detail.chapterOutline.title,
        uiBeats,
        detail.writingState.wordCount,
        detail.writingState.lastSavedAt,
      );
      setWorkflowNotice("Adegan bab berhasil dibuat.");
    } catch (error) {
      setWorkflowNotice(
        error instanceof ApiClientError
          ? `Gagal membuat adegan (${error.message}).`
          : "Gagal membuat adegan.",
      );
    } finally {
      setGeneratingBeats(false);
    }
  }, [
    apiMode,
    chapterOutlineId,
    loadProseForBeat,
    projectId,
    proseByBeatId,
    rebuildDraft,
    sessionId,
    token,
  ]);

  const saveProse = useCallback(async () => {
    if (!apiMode || !token || !projectId || !activeBeatId) return;

    const trimmed = proseText.trim();
    if (!trimmed) {
      setErrorNotice("Tulis sedikit narasi sebelum menyimpan.");
      return;
    }

    setSaving(true);
    setErrorNotice(null);
    setWorkflowNotice(null);

    try {
      const result = await saveBeatProse(projectId, activeBeatId, token, {
        proseText: trimmed,
        source: "user_edited",
        ...(packetLogId ? { contextPacketLogId: packetLogId } : {}),
      });

      setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: trimmed }));
      setProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: result.version.id,
      }));
      setSelectedProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: result.version.id,
      }));
      setProseVersionsByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: withCurrentVersion(prev[activeBeatId] ?? [], result.version),
      }));
      setPendingAiReviewByBeatId((prev) => ({ ...prev, [activeBeatId]: null }));
      setEditHistoryByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: { past: [], future: [] },
      }));
      setWordCount(result.chapterWordCount);
      setLastSavedAt(new Date().toISOString());

      setApiBeats((prev) =>
        prev.map((beat) =>
          beat.id === activeBeatId
            ? {
                ...beat,
                status: beat.status === "empty" ? "draft" : beat.status,
              }
            : beat,
        ),
      );

      setWorkflowNotice(`Tersimpan · ${result.version.wordCount} kata · v${result.version.versionNumber}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("internal metadata") ||
          msg.includes("context packet dump") ||
          msg.includes("disallowed")
        ) {
          setErrorNotice(PROSE_SAFETY_ERROR);
        } else {
          setErrorNotice(`Gagal menyimpan (${error.message}).`);
        }
      } else {
        setErrorNotice("Gagal menyimpan narasi.");
      }
    } finally {
      setSaving(false);
    }
  }, [activeBeatId, apiMode, packetLogId, proseText, projectId, token]);

  const buildSafeContext = useCallback(async () => {
    if (!apiMode || !token || !projectId || !chapterOutlineId) return;

    setBuildingContext(true);
    setWorkflowNotice(null);
    setErrorNotice(null);

    try {
      const result = await buildContextPacket(projectId, token, {
        chapterOutlineId,
        ...(activeBeatId ? { beatId: activeBeatId } : {}),
      });
      setPacketLogId(result.packetLogId);
      setContextPreview(buildSafeContextPreview(result));
      setWorkflowNotice("Konteks aman siap dipakai saat menyimpan narasi.");
    } catch (error) {
      setWorkflowNotice(
        error instanceof ApiClientError
          ? `Gagal menyiapkan konteks (${error.message}).`
          : "Gagal menyiapkan konteks aman.",
      );
    } finally {
      setBuildingContext(false);
    }
  }, [activeBeatId, apiMode, chapterOutlineId, projectId, token]);

  const generateAiForActiveBeat = useCallback(async () => {
    if (
      aiGenerating ||
      source !== "api" ||
      !apiMode ||
      !token ||
      !projectId ||
      !sessionId ||
      !chapterOutlineId ||
      !activeBeatId ||
      needsGenerateBeats
    ) {
      return;
    }

    const beatCost = getProseBeatCreditCost(
      qualityMode,
      serverCreditCosts.proseBeat,
    );
    if (creditBalance != null && creditBalance.balance < beatCost) {
      setAiError("Kredit tidak cukup.");
      return;
    }

    setAiGenerating(true);
    setAiError(null);
    setAiNotice(null);

    const idempotencyKey = buildBeatProseIdempotencyKey(activeBeatId);
    const previousVersionId = proseVersionIdByBeatId[activeBeatId] ?? null;

    try {
      const result = await generateBeatProse(projectId, token, {
        chapterOutlineId,
        beatId: activeBeatId,
        writingSessionId: sessionId,
        qualityMode,
        idempotencyKey,
      });

      const text = result.version.proseText;
      setProseText(text);
      setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: text }));
      setProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: result.version.id,
      }));
      setSelectedProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: result.version.id,
      }));
      setProseVersionsByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: withCurrentVersion(prev[activeBeatId] ?? [], result.version),
      }));
      setPendingAiReviewByBeatId((prev) => ({
        ...prev,
        [activeBeatId]:
          result.version.id === previousVersionId
            ? null
            : { versionId: result.version.id, previousVersionId },
      }));
      setEditHistoryByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: { past: [], future: [] },
      }));
      setWordCount(result.version.wordCount);
      setLastSavedAt(result.version.createdAt ?? new Date().toISOString());

      if (result.creditBalance) {
        setCreditBalance(result.creditBalance);
      } else {
        await refreshCreditBalance();
      }

      setApiBeats((prev) =>
        prev.map((beat) =>
          beat.id === activeBeatId
            ? {
                ...beat,
                status: beat.status === "empty" ? "draft" : beat.status,
              }
            : beat,
        ),
      );

      const cost = result.creditCost ?? result.generationAttempt.creditCost;
      const remaining =
        result.creditBalance?.balance ??
        (creditBalance != null ? Math.max(0, creditBalance.balance - cost) : null);
      const balanceNote =
        remaining != null ? ` Sisa: ${remaining}.` : "";
      const replayNote = result.idempotentReplay ? " (hasil permintaan sebelumnya)" : "";
      setAiNotice(`Narasi AI berhasil dibuat. Terpotong ${cost} kredit.${balanceNote}${replayNote}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setAiError(mapAiGenerationErrorCode(error.code, error.details));
      } else {
        setAiError("Gagal menghasilkan narasi AI.");
      }
    } finally {
      setAiGenerating(false);
    }
  }, [
    activeBeatId,
    aiGenerating,
    apiMode,
    chapterOutlineId,
    creditBalance,
    needsGenerateBeats,
    projectId,
    proseVersionIdByBeatId,
    qualityMode,
    refreshCreditBalance,
    serverCreditCosts.proseBeat,
    sessionId,
    source,
    token,
  ]);

  const rewriteActiveBeatProse = useCallback(async () => {
    if (
      rewriteGenerating ||
      source !== "api" ||
      !apiMode ||
      !token ||
      !projectId ||
      !sessionId ||
      !activeBeatId ||
      needsGenerateBeats
    ) {
      return;
    }

    const proseVersionId = proseVersionIdByBeatId[activeBeatId] ?? undefined;
    const previousVersionId = proseVersionId ?? null;
    const hasLocalProse = proseText.trim().length > 0;
    if (!proseVersionId && !hasLocalProse) {
      setRewriteError("Belum ada teks untuk diperbaiki.");
      return;
    }

    if (rewriteMode === PROSE_REWRITE_MODES.custom && !rewriteInstruction.trim()) {
      setRewriteError("Isi instruksi untuk mode instruksi khusus.");
      return;
    }

    const rewriteCost = getProseRewriteCreditCost(
      qualityMode,
      serverCreditCosts.proseRewrite,
    );
    if (creditBalance != null && creditBalance.balance < rewriteCost) {
      setRewriteError("Kredit tidak cukup.");
      return;
    }

    setRewriteGenerating(true);
    setRewriteError(null);
    setRewriteNotice(null);

    const idempotencyKey = buildRewriteProseIdempotencyKey(activeBeatId);
    const instruction =
      rewriteMode === PROSE_REWRITE_MODES.custom
        ? rewriteInstruction.trim()
        : undefined;

    try {
      const result = await rewriteBeatProse(projectId, token, {
        ...(proseVersionId ? { proseVersionId } : { beatId: activeBeatId }),
        writingSessionId: sessionId,
        rewriteMode,
        qualityMode,
        idempotencyKey,
        ...(instruction ? { instruction } : {}),
      });

      const text = result.proseVersion.proseText;
      setProseText(text);
      setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: text }));
      setProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: result.proseVersion.id,
      }));
      setSelectedProseVersionIdByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: result.proseVersion.id,
      }));
      setProseVersionsByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: withCurrentVersion(prev[activeBeatId] ?? [], result.proseVersion),
      }));
      setPendingAiReviewByBeatId((prev) => ({
        ...prev,
        [activeBeatId]:
          result.proseVersion.id === previousVersionId
            ? null
            : { versionId: result.proseVersion.id, previousVersionId },
      }));
      setEditHistoryByBeatId((prev) => ({
        ...prev,
        [activeBeatId]: { past: [], future: [] },
      }));
      setWordCount(result.proseVersion.wordCount);
      setLastSavedAt(result.proseVersion.createdAt ?? new Date().toISOString());

      if (result.creditBalance) {
        setCreditBalance(result.creditBalance);
      } else {
        await refreshCreditBalance();
      }

      const cost = result.generationAttempt.creditCost;
      const remaining =
        result.creditBalance?.balance ??
        (creditBalance != null ? Math.max(0, creditBalance.balance - cost) : null);
      const balanceNote = remaining != null ? ` Sisa: ${remaining}.` : "";
      const replayNote = result.idempotentReplay ? " (hasil permintaan sebelumnya)" : "";
      setRewriteNotice(
        `Teks berhasil diperbaiki. Terpotong ${cost} kredit.${balanceNote}${replayNote}`,
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        setRewriteError(mapAiRewriteErrorCode(error.code, error.message, error.details));
      } else {
        setRewriteError("Gagal memperbaiki teks.");
      }
    } finally {
      setRewriteGenerating(false);
    }
  }, [
    activeBeatId,
    apiMode,
    creditBalance,
    needsGenerateBeats,
    projectId,
    proseText,
    proseVersionIdByBeatId,
    qualityMode,
    refreshCreditBalance,
    serverCreditCosts.proseRewrite,
    rewriteGenerating,
    rewriteInstruction,
    rewriteMode,
    sessionId,
    source,
    token,
  ]);

  const finishChapter = useCallback(async () => {
    if (source === "api" && projectId && sessionId && token) {
      setMarkingReady(true);
      setWorkflowNotice(null);
      try {
        await markSessionReadyForSummary(projectId, sessionId, token);
        setWorkflowNotice("Bab ditandai siap ringkasan. Lanjut ke halaman Ringkasan Bab.");
      } catch (error) {
        setWorkflowNotice(
          error instanceof ApiClientError
            ? `Gagal menandai siap ringkasan (${error.message}).`
            : "Gagal menandai siap ringkasan.",
        );
        setMarkingReady(false);
        return;
      }
      setMarkingReady(false);
    }

    navigate(draft.summaryRoute);
  }, [draft.summaryRoute, navigate, projectId, sessionId, source, token]);

  const activeBeat =
    draft.beats.find((beat) => beat.id === activeBeatId) ?? draft.beats[0];

  const editable = source === "api" && Boolean(activeBeat);
  const proseBeatCreditCost = getProseBeatCreditCost(
    qualityMode,
    serverCreditCosts.proseBeat,
  );
  const proseRewriteCreditCost = getProseRewriteCreditCost(
    qualityMode,
    serverCreditCosts.proseRewrite,
  );
  const creditCostLabel = formatProseBeatCreditCostLabel(
    qualityMode,
    serverCreditCosts.proseBeat,
  );
  const creditActionCostLabel = formatProseBeatActionCostLabel(
    qualityMode,
    serverCreditCosts.proseBeat,
  );
  const creditRewriteCostLabel = formatProseRewriteActionCostLabel(
    qualityMode,
    serverCreditCosts.proseRewrite,
  );
  const qualityModeLabel = formatQualityModeLabel(qualityMode);
  const showCreditUi = source === "api";
  const showPovKnowledgeSummary = creatorMode === "advanced";
  const knownBalance = creditBalance?.balance ?? null;
  const insufficientCredit =
    knownBalance != null && knownBalance < proseBeatCreditCost;
  const insufficientCreditRewrite =
    knownBalance != null && knownBalance < proseRewriteCreditCost;
  const remainingAfterGenerate =
    knownBalance != null ? Math.max(0, knownBalance - proseBeatCreditCost) : null;
  const remainingAfterRewrite =
    knownBalance != null ? Math.max(0, knownBalance - proseRewriteCreditCost) : null;
  const activeProseVersionId = proseVersionIdByBeatId[activeBeatId] ?? null;
  const activeProseVersions = useMemo(
    () => proseVersionsByBeatId[activeBeatId] ?? [],
    [activeBeatId, proseVersionsByBeatId],
  );
  const selectedProseVersionId =
    selectedProseVersionIdByBeatId[activeBeatId] ?? activeProseVersionId;
  const pendingAiReview = pendingAiReviewByBeatId[activeBeatId] ?? null;
  const activeEditHistory = editHistoryByBeatId[activeBeatId] ?? { past: [], future: [] };
  const canUndoProse = activeEditHistory.past.length > 0;
  const canRedoProse = activeEditHistory.future.length > 0;
  const hasProseForRewrite =
    Boolean(activeProseVersionId) || proseText.trim().length > 0;
  const customInstructionOk =
    rewriteMode !== PROSE_REWRITE_MODES.custom || rewriteInstruction.trim().length > 0;
  const aiEnabledForUi = aiGenerationEnabled !== false;
  const aiCanGenerate =
    source === "api" &&
    aiEnabledForUi &&
    Boolean(activeBeatId) &&
    Boolean(sessionId) &&
    Boolean(chapterOutlineId) &&
    !needsGenerateBeats &&
    !insufficientCredit;
  const rewriteCanRun =
    source === "api" &&
    aiEnabledForUi &&
    Boolean(activeBeatId) &&
    Boolean(sessionId) &&
    !needsGenerateBeats &&
    hasProseForRewrite &&
    !insufficientCreditRewrite &&
    customInstructionOk &&
    !rewriteGenerating;
  const aiUnavailableReason =
    source === "mock"
      ? "Generasi AI hanya tersedia dalam mode API (bukan demo)."
      : source === "locked"
        ? "Ruang tulis terkunci — selesaikan outline terlebih dahulu."
        : source === "error"
          ? "Generasi AI tidak tersedia saat data ruang tulis gagal dimuat."
          : aiGenerationEnabled === false
          ? "AI generation belum aktif di lingkungan ini."
          : needsGenerateBeats
            ? "Buat daftar adegan terlebih dahulu."
            : insufficientCredit
              ? "Kredit tidak cukup untuk aksi ini."
              : null;
  const rewriteUnavailableReason =
    source === "mock"
      ? "Perbaiki teks dengan AI hanya tersedia dalam mode API (bukan demo)."
      : source === "locked"
        ? "Ruang tulis terkunci — selesaikan outline terlebih dahulu."
        : source === "error"
          ? "Perbaiki teks tidak tersedia saat data ruang tulis gagal dimuat."
          : aiGenerationEnabled === false
          ? "AI generation belum aktif di lingkungan ini."
          : needsGenerateBeats
          ? "Buat daftar adegan terlebih dahulu."
          : !hasProseForRewrite
            ? "Belum ada teks untuk diperbaiki."
            : insufficientCreditRewrite
              ? "Kredit tidak cukup untuk perbaikan teks."
              : rewriteMode === PROSE_REWRITE_MODES.custom && !customInstructionOk
                ? "Isi instruksi untuk mode instruksi khusus."
                : null;

  return useMemo(
    () => ({
      draft: {
        ...draft,
        beats: draft.beats.map((beat) =>
          beat.id === activeBeatId ? { ...beat, prose: proseText } : beat,
        ),
      },
      source,
      apiMode,
      loading,
      saving,
      buildingContext,
      generatingBeats,
      markingReady,
      notice,
      workflowNotice,
      errorNotice,
      activeBeatId,
      onSelectBeat,
      proseText,
      onProseChange,
      editable,
      needsGenerateBeats: source === "api" && needsGenerateBeats,
      generateBeats,
      saveProse,
      buildSafeContext,
      contextPreview,
      showPovKnowledgeSummary,
      finishChapter,
      aiGenerating,
      aiError,
      aiNotice,
      creditCostLabel,
      creditActionCostLabel,
      creditRewriteCostLabel,
      qualityModeLabel,
      creditBalance: knownBalance,
      creditLoading,
      creditError,
      proseBeatCreditCost,
      insufficientCredit,
      remainingAfterGenerate,
      showCreditUi,
      creditTopupEnabled,
      isMockMode: useMocks,
      onGenerateAi: aiCanGenerate ? generateAiForActiveBeat : undefined,
      aiUnavailableReason,
      rewriteGenerating,
      rewriteError,
      rewriteNotice,
      rewriteMode,
      rewriteInstruction,
      setRewriteMode,
      setRewriteInstruction,
      proseRewriteCreditCost,
      insufficientCreditRewrite,
      remainingAfterRewrite,
      onRewriteProse: rewriteCanRun ? rewriteActiveBeatProse : undefined,
      rewriteUnavailableReason,
      hasProseForRewrite,
      lockedTitle,
      lockedDescription,
      proseVersions: activeProseVersions,
      currentProseVersionId: activeProseVersionId,
      selectedProseVersionId,
      onSelectProseVersion: selectProseVersion,
      onUseSelectedProseVersion: useSelectedProseVersion,
      versionApplying,
      pendingAiVersionId: pendingAiReview?.versionId ?? null,
      onAcceptPendingAiVersion: acceptPendingAiVersion,
      onRejectPendingAiVersion: rejectPendingAiVersion,
      canUndoProse,
      canRedoProse,
      undoProse,
      redoProse,
    }),
    [
      activeBeatId,
      activeProseVersionId,
      activeProseVersions,
      acceptPendingAiVersion,
      aiCanGenerate,
      aiError,
      aiGenerating,
      aiNotice,
      aiUnavailableReason,
      apiMode,
      buildSafeContext,
      buildingContext,
      contextPreview,
      canRedoProse,
      canUndoProse,
      creditActionCostLabel,
      creditCostLabel,
      creditError,
      creditTopupEnabled,
      creditLoading,
      creditRewriteCostLabel,
      draft,
      hasProseForRewrite,
      insufficientCredit,
      lockedDescription,
      lockedTitle,
      insufficientCreditRewrite,
      knownBalance,
      proseBeatCreditCost,
      proseRewriteCreditCost,
      pendingAiReview,
      qualityModeLabel,
      remainingAfterGenerate,
      remainingAfterRewrite,
      rewriteActiveBeatProse,
      rewriteCanRun,
      rewriteError,
      rewriteGenerating,
      rewriteInstruction,
      rewriteMode,
      rewriteNotice,
      rewriteUnavailableReason,
      rejectPendingAiVersion,
      redoProse,
      selectProseVersion,
      selectedProseVersionId,
      showCreditUi,
      showPovKnowledgeSummary,
      undoProse,
      useMocks,
      useSelectedProseVersion,
      versionApplying,
      editable,
      errorNotice,
      finishChapter,
      generateAiForActiveBeat,
      generateBeats,
      generatingBeats,
      loading,
      markingReady,
      needsGenerateBeats,
      notice,
      onProseChange,
      onSelectBeat,
      proseText,
      saveProse,
      saving,
      source,
      workflowNotice,
    ],
  );
}
