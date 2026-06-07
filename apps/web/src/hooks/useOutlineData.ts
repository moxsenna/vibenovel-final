import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import {
  formatOutlineWorkflowError,
  mapApiChapterToUi,
  mapOpenLoopsToUi,
  mapOutlineBundleToUi,
  mapRevealsToUi,
  type UiOpenLoop,
  type UiPlannedReveal,
} from "@/lib/api-mappers";
import { shouldUseMocks } from "@/lib/env";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import type { OutlineChapterDraft } from "@/components/outline";
import { mockOutline } from "@/mocks/outline";
import type { ChapterOutline } from "@vibenovel/shared";
import {
  approveOutline,
  fetchOutlineBundle,
  generateOutline,
  lockOutline,
  patchChapterOutline,
} from "@/services/outline";
import type { StoryOutline } from "@/types";

export type OutlineDataSource = "mock" | "api" | "api-fallback";

function chapterNumberMap(chapters: ChapterOutline[]): Map<string, number> {
  return new Map(chapters.map((ch) => [ch.id, ch.chapterNumber]));
}

function draftFromChapter(chapter: ChapterOutline): OutlineChapterDraft {
  return {
    title: chapter.title,
    summary: chapter.summary,
    endingHook: chapter.endingHook ?? chapter.hook ?? "",
    miniVictory: chapter.miniVictory ?? "",
  };
}

export interface OutlineData {
  outline: StoryOutline;
  openLoops: UiOpenLoop[];
  reveals: UiPlannedReveal[];
  source: OutlineDataSource;
  loading: boolean;
  generating: boolean;
  approving: boolean;
  locking: boolean;
  savingChapterId: string | null;
  notice: string | null;
  workflowNotice: string | null;
  apiMode: boolean;
  hasApiOutline: boolean;
  needsGenerate: boolean;
  isLocked: boolean;
  projectId: string | null;
  apiChapters: ChapterOutline[];
  getChapterDraft: (chapterId: string) => OutlineChapterDraft | null;
  updateChapterDraft: (chapterId: string, field: keyof OutlineChapterDraft, value: string) => void;
  generateOutlinePlan: () => Promise<void>;
  approveOutlinePlan: () => Promise<void>;
  lockOutlinePlan: () => Promise<void>;
  saveChapterEdits: (chapterId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOutlineData(): OutlineData {
  const { id: routeProjectId } = useParams();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [outline, setOutline] = useState<StoryOutline>(mockOutline);
  const [apiChapters, setApiChapters] = useState<ChapterOutline[]>([]);
  const [openLoops, setOpenLoops] = useState<UiOpenLoop[]>([]);
  const [reveals, setReveals] = useState<UiPlannedReveal[]>([]);
  const [source, setSource] = useState<OutlineDataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [savingChapterId, setSavingChapterId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OutlineChapterDraft>>({});

  const applyBundle = useCallback(
    (resolvedId: string, bundle: Awaited<ReturnType<typeof fetchOutlineBundle>>) => {
      setApiChapters(bundle.chapterOutlines);
      setOutline(mapOutlineBundleToUi(resolvedId, bundle));
      const chMap = chapterNumberMap(bundle.chapterOutlines);
      setOpenLoops(mapOpenLoopsToUi(bundle.openLoops, chMap));
      setReveals(mapRevealsToUi(bundle.plannedReveals, chMap));
      setDrafts({});
    },
    [],
  );

  const loadOutline = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        setOutline(mockOutline);
        setApiChapters([]);
        setOpenLoops([]);
        setReveals([]);
        setSource("api-fallback");
        setNotice("Proyek tidak ditemukan. Menampilkan mock outline.");
        return;
      }

      setProjectId(resolvedId);
      const bundle = await fetchOutlineBundle(resolvedId, token);
      applyBundle(resolvedId, bundle);
      setSource("api");
    } catch (error) {
      setOutline(mockOutline);
      setApiChapters([]);
      setOpenLoops([]);
      setReveals([]);
      setSource("api-fallback");
      setNotice(
        error instanceof ApiClientError
          ? `API tidak tersedia (${error.message}). Menampilkan mock Sprint 1.`
          : "API tidak tersedia. Menampilkan mock Sprint 1.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiMode, applyBundle, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setOutline(mockOutline);
      setApiChapters([]);
      setOpenLoops([]);
      setReveals([]);
      setSource("mock");
      setNotice(
        useMocks
          ? null
          : "Masuk ke akun untuk membaca outline dari API. Menampilkan mock Sprint 1.",
      );
      return;
    }

    void loadOutline();
  }, [authLoading, apiMode, loadOutline, useMocks]);

  const generateOutlinePlan = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setGenerating(true);
    setWorkflowNotice(null);
    try {
      const result = await generateOutline(projectId, token, {});
      applyBundle(projectId, result);
      setWorkflowNotice("Rencana 10 bab berhasil dibuat.");
    } catch (error) {
      setWorkflowNotice(
        error instanceof ApiClientError
          ? formatOutlineWorkflowError(error.message, error.details)
          : "Gagal membuat rencana outline.",
      );
    } finally {
      setGenerating(false);
    }
  }, [apiMode, applyBundle, projectId, token]);

  const approveOutlinePlan = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setApproving(true);
    setWorkflowNotice(null);
    try {
      const result = await approveOutline(projectId, token);
      setApiChapters(result.chapters);
      setOutline((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          statusLabel: "Sedang ditinjau",
          statusDescription: "Outline disetujui untuk peninjauan akhir.",
        },
        chapters: result.chapters.map(mapApiChapterToUi),
        pageCopy: { ...prev.pageCopy, planBadge: "Sedang Ditinjau" },
      }));
      setWorkflowNotice(
        result.canLock
          ? "Outline disetujui. Siap dikunci jika semua syarat terpenuhi."
          : "Outline disetujui. Masih ada syarat kunci yang belum terpenuhi.",
      );
    } catch (error) {
      setWorkflowNotice(
        error instanceof ApiClientError
          ? formatOutlineWorkflowError(error.message, error.details)
          : "Gagal menyetujui outline.",
      );
    } finally {
      setApproving(false);
    }
  }, [apiMode, projectId, token]);

  const lockOutlinePlan = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setLocking(true);
    setWorkflowNotice(null);
    try {
      const result = await lockOutline(projectId, token);
      setApiChapters(result.chapters);
      setOutline((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          statusLabel: "Outline terkunci",
          statusDescription: "Outline terkunci — siap lanjut ke ruang tulis.",
        },
        chapters: result.chapters.map(mapApiChapterToUi),
        pageCopy: {
          ...prev.pageCopy,
          planBadge: "Outline Terkunci",
          reviewNote: "Outline sudah dikunci. Edit rencana bab tidak tersedia.",
        },
      }));
      setWorkflowNotice("Outline berhasil dikunci.");
    } catch (error) {
      setWorkflowNotice(
        error instanceof ApiClientError
          ? formatOutlineWorkflowError(error.message, error.details)
          : "Gagal mengunci outline.",
      );
    } finally {
      setLocking(false);
    }
  }, [apiMode, projectId, token]);

  const getChapterDraft = useCallback(
    (chapterId: string): OutlineChapterDraft | null => {
      if (drafts[chapterId]) return drafts[chapterId];
      const chapter = apiChapters.find((ch) => ch.id === chapterId);
      if (!chapter) return null;
      return draftFromChapter(chapter);
    },
    [apiChapters, drafts],
  );

  const updateChapterDraft = useCallback(
    (chapterId: string, field: keyof OutlineChapterDraft, value: string) => {
      setDrafts((prev) => {
        const base =
          prev[chapterId] ??
          (() => {
            const chapter = apiChapters.find((ch) => ch.id === chapterId);
            return chapter ? draftFromChapter(chapter) : null;
          })();
        if (!base) return prev;
        return { ...prev, [chapterId]: { ...base, [field]: value } };
      });
    },
    [apiChapters],
  );

  const saveChapterEdits = useCallback(
    async (chapterId: string) => {
      if (!apiMode || !token || !projectId) return;
      if (outline.pageCopy.planBadge === "Outline Terkunci") return;

      const draft = getChapterDraft(chapterId);
      if (!draft) return;

      setSavingChapterId(chapterId);
      setWorkflowNotice(null);
      try {
        const updated = await patchChapterOutline(projectId, chapterId, token, {
          title: draft.title.trim(),
          summary: draft.summary.trim(),
          endingHook: draft.endingHook.trim(),
          miniVictory: draft.miniVictory.trim() || null,
        });
        setApiChapters((prev) => prev.map((ch) => (ch.id === chapterId ? updated : ch)));
        setOutline((prev) => ({
          ...prev,
          chapters: prev.chapters.map((ch) =>
            ch.id === chapterId ? mapApiChapterToUi(updated) : ch,
          ),
        }));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[chapterId];
          return next;
        });
        setWorkflowNotice("Perubahan bab disimpan.");
      } catch (error) {
        setWorkflowNotice(
          error instanceof ApiClientError
            ? `Gagal menyimpan bab (${error.message}).`
            : "Gagal menyimpan perubahan bab.",
        );
      } finally {
        setSavingChapterId(null);
      }
    },
    [apiMode, getChapterDraft, outline.pageCopy.planBadge, projectId, token],
  );

  const hasApiOutline = source === "api" && apiChapters.length > 0;
  const needsGenerate = apiMode && source === "api" && apiChapters.length === 0;
  const isLocked = outline.pageCopy.planBadge === "Outline Terkunci";

  return useMemo(
    () => ({
      outline,
      openLoops,
      reveals,
      source,
      loading,
      generating,
      approving,
      locking,
      savingChapterId,
      notice,
      workflowNotice,
      apiMode,
      hasApiOutline,
      needsGenerate,
      isLocked,
      projectId,
      apiChapters,
      getChapterDraft,
      updateChapterDraft,
      generateOutlinePlan,
      approveOutlinePlan,
      lockOutlinePlan,
      saveChapterEdits,
      refresh: loadOutline,
    }),
    [
      outline,
      openLoops,
      reveals,
      source,
      loading,
      generating,
      approving,
      locking,
      savingChapterId,
      notice,
      workflowNotice,
      apiMode,
      hasApiOutline,
      needsGenerate,
      isLocked,
      projectId,
      apiChapters,
      getChapterDraft,
      updateChapterDraft,
      generateOutlinePlan,
      approveOutlinePlan,
      lockOutlinePlan,
      saveChapterEdits,
      loadOutline,
    ],
  );
}