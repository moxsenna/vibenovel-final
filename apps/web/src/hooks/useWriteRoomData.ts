import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChapterBeat, ChapterOutline } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { shouldUseMocks } from "@/lib/env";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { ROUTES } from "@/routes/paths";
import { mockChapterDraft } from "@/mocks/chapter";
import { fetchOutlineBundle } from "@/services/outline";
import {
  buildContextPacket,
  fetchBeatProseVersions,
  fetchSessionBeats,
  fetchWritingSession,
  generateSessionBeats,
  markSessionReadyForSummary,
  patchWritingSession,
  saveBeatProse,
  startWritingSession,
  type BuildContextPacketResponse,
} from "@/services/write";
import type { Beat, BeatStatus, ChapterDraft } from "@/types";

export type WriteDataSource = "mock" | "api" | "api-fallback";

export interface SafeContextPreview {
  chapterTitle: string;
  chapterNumber: number;
  mustIncludeCount: number;
  mustNotIncludeCount: number;
  storyCheckLabels: string[];
  packetHashShort: string | null;
  direction: string | null;
  emotionalTarget: string | null;
}

const PROSE_SAFETY_ERROR =
  "Teks ini terlihat berisi data teknis internal. Hapus bagian teknis lalu simpan lagi.";

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
  };
}

function isOutlineLocked(bundle: Awaited<ReturnType<typeof fetchOutlineBundle>>): boolean {
  return bundle.outlinePlan?.status === "locked";
}

function pickDefaultChapter(chapters: ChapterOutline[]): ChapterOutline | null {
  if (chapters.length === 0) return null;
  return chapters.find((ch) => ch.chapterNumber === 1) ?? chapters[0] ?? null;
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
  finishChapter: () => Promise<void>;
}

export function useWriteRoomData(): UseWriteRoomDataResult {
  const { id: routeProjectId } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [draft, setDraft] = useState<ChapterDraft>(mockChapterDraft);
  const [source, setSource] = useState<WriteDataSource>("mock");
  const [loading, setLoading] = useState(false);
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
  const [proseText, setProseText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [needsGenerateBeats, setNeedsGenerateBeats] = useState(false);
  const [packetLogId, setPacketLogId] = useState<string | null>(null);
  const [contextPreview, setContextPreview] = useState<SafeContextPreview | null>(null);

  const applyMock = useCallback((message: string | null) => {
    setDraft(mockChapterDraft);
    setApiBeats([]);
    setActiveBeatId(mockChapterDraft.beats[0]?.id ?? "");
    setProseByBeatId({});
    setProseText(mockChapterDraft.beats[0]?.prose ?? "");
    setSource("api-fallback");
    setNotice(message);
    setNeedsGenerateBeats(false);
    setContextPreview(null);
    setPacketLogId(null);
  }, []);

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
      setProseByBeatId((prev) => ({ ...prev, [beatId]: text }));
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
        applyMock("Proyek tidak ditemukan. Menampilkan mock ruang tulis.");
        return;
      }

      setProjectId(resolvedId);
      const bundle = await fetchOutlineBundle(resolvedId, token);
      if (!isOutlineLocked(bundle)) {
        applyMock("Outline perlu dikunci dulu sebelum menulis. Menampilkan mock Sprint 1.");
        return;
      }

      const chapter = pickDefaultChapter(bundle.chapterOutlines);
      if (!chapter) {
        applyMock("Belum ada bab di outline. Menampilkan mock ruang tulis.");
        return;
      }

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
      applyMock(
        error instanceof ApiClientError
          ? `API tidak tersedia (${error.message}). Menampilkan mock Sprint 1.`
          : "API tidak tersedia. Menampilkan mock Sprint 1.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiMode, applyMock, loadProseForBeat, rebuildDraft, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setDraft(mockChapterDraft);
      setSource("mock");
      setActiveBeatId(mockChapterDraft.beats[0]?.id ?? "");
      setProseText(mockChapterDraft.beats[0]?.prose ?? "");
      setNotice(
        useMocks
          ? null
          : "Masuk ke akun untuk menulis dengan API. Menampilkan mock Sprint 1.",
      );
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
      setProseText(text);
      if (source === "api" && activeBeatId) {
        setProseByBeatId((prev) => ({ ...prev, [activeBeatId]: text }));
      }
    },
    [activeBeatId, source],
  );

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

  const finishChapter = useCallback(async () => {
    if (source === "api" && projectId && sessionId && token) {
      setMarkingReady(true);
      setWorkflowNotice(null);
      try {
        await markSessionReadyForSummary(projectId, sessionId, token);
        setWorkflowNotice(
          "Bab ditandai siap ringkasan. Halaman ringkasan Sprint 6 belum production — menampilkan mock.",
        );
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
      finishChapter,
    }),
    [
      activeBeatId,
      apiMode,
      buildSafeContext,
      buildingContext,
      contextPreview,
      draft,
      editable,
      errorNotice,
      finishChapter,
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