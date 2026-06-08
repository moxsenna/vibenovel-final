import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ChapterOutline, PublishPackage as ApiPublishPackage } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { shouldUseMocks } from "@/lib/env";
import {
  mapApiPublishPackageToUi,
  type PublishEditableFieldKey,
  uiFieldToApiPatch,
} from "@/lib/publish-mappers";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { mockPublishPackage } from "@/mocks/publishPackage";
import { fetchOutlineBundle } from "@/services/outline";
import {
  generatePublishPackage,
  getPublishPackageByChapter,
  markPublishPackageExported,
  updatePublishChecklist,
  updatePublishPackageFields,
} from "@/services/publish";
import { getSummaryByChapter } from "@/services/summary";
import type { PublishPackage } from "@/types";

export type PublishDataSource = "mock" | "api" | "api-fallback";

const OVERCLAIM_MESSAGE =
  "Copy ini terlalu menjanjikan hasil. Gunakan kalimat yang lebih aman.";

function pickDefaultChapter(chapters: ChapterOutline[]): ChapterOutline | null {
  if (chapters.length === 0) return null;
  return chapters.find((ch) => ch.chapterNumber === 1) ?? chapters[0] ?? null;
}

function userFacingError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.message.toLowerCase().includes("overclaim")) return OVERCLAIM_MESSAGE;
    if (error.status === 409) {
      const missing = Array.isArray((error.details as { missing?: string[] })?.missing)
        ? (error.details as { missing: string[] }).missing
        : [];
      if (missing.includes("summary_approved") || missing.includes("current_summary_required")) {
        return "Ringkasan bab perlu disetujui dulu sebelum membuat paket publish.";
      }
      if (missing.includes("chapter_summarized")) {
        return "Bab perlu diselesaikan dan diringkas terlebih dahulu.";
      }
      if (missing.includes("exported_package_locked")) {
        return "Paket sudah ditandai diekspor dan tidak dapat diedit.";
      }
      return error.message;
    }
    if (error.status === 400) {
      if (error.message.toLowerCase().includes("overclaim")) return OVERCLAIM_MESSAGE;
      return error.message;
    }
    if (error.status === 404) return "Paket publish tidak ditemukan.";
    if (error.status === 0) return "API tidak tersedia. Menampilkan mock Sprint 1.";
    return "Terjadi kesalahan saat memuat paket publish.";
  }
  return "API tidak tersedia. Menampilkan mock Sprint 1.";
}

function emptyPublishShell(
  routeProjectId: string,
  chapter: ChapterOutline,
): PublishPackage {
  return {
    ...mockPublishPackage,
    projectId: routeProjectId,
    chapterNumber: chapter.chapterNumber,
    chapterTitle: chapter.title,
    title: "",
    blurb: "",
    teaser: "",
    caption: "",
    commentBait: "",
    nextChapterTeaser: "",
    tags: [],
    checklist: mockPublishPackage.checklist.map((item) => ({ ...item, checked: false })),
    mobilePreview: {
      ...mockPublishPackage.mobilePreview,
      chapterLabel: `Bab ${chapter.chapterNumber} · ${chapter.title}`,
      excerpt: "",
    },
    pageCopy: {
      ...mockPublishPackage.pageCopy,
      title: `Aset Publikasi: Bab ${chapter.chapterNumber}`,
      subtitle: "Belum ada paket publish. Buat paket setelah ringkasan bab disetujui.",
      badgeLabel: "Paket Publish",
    },
  };
}

export interface UsePublishDataResult {
  pkg: PublishPackage;
  source: PublishDataSource;
  apiMode: boolean;
  loading: boolean;
  generating: boolean;
  savingField: string | null;
  savingChecklist: boolean;
  markingExported: boolean;
  notice: string | null;
  workflowNotice: string | null;
  actionError: string | null;
  hasPackage: boolean;
  isExported: boolean;
  isReadonly: boolean;
  summaryApproved: boolean;
  genre: string | null;
  generatePackageAction: () => Promise<void>;
  saveFieldAction: (field: PublishEditableFieldKey, value: string) => Promise<void>;
  toggleChecklistItem: (itemId: string) => Promise<void>;
  markExportedAction: () => Promise<void>;
}

export function usePublishData(): UsePublishDataResult {
  const { id: routeProjectId } = useParams();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [pkg, setPkg] = useState<PublishPackage>(mockPublishPackage);
  const [source, setSource] = useState<PublishDataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [markingExported, setMarkingExported] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [chapterOutlineId, setChapterOutlineId] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [apiPkg, setApiPkg] = useState<ApiPublishPackage | null>(null);
  const [summaryApproved, setSummaryApproved] = useState(false);
  const [summaryId, setSummaryId] = useState<string | null>(null);

  const isExported = apiPkg?.status === "exported";
  const isReadonly = !apiMode || source !== "api" || isExported;
  const hasPackage = Boolean(packageId);
  const genre = apiPkg?.genre ?? null;

  const applyMock = useCallback((message: string | null) => {
    setPkg(mockPublishPackage);
    setSource("api-fallback");
    setNotice(message);
    setApiPkg(null);
    setPackageId(null);
    setSummaryApproved(false);
    setSummaryId(null);
  }, []);

  const applyApiPackage = useCallback(
    (row: ApiPublishPackage) => {
      const ui = mapApiPublishPackageToUi(row, routeProjectId ?? row.projectId);
      setPkg(ui);
      setApiPkg(row);
      setPackageId(row.id);
      setSource("api");
      setNotice(null);
    },
    [routeProjectId],
  );

  const loadPublishRoom = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);
    setWorkflowNotice(null);
    setActionError(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        applyMock("Proyek tidak ditemukan. Menampilkan mock paket publish.");
        return;
      }

      setProjectId(resolvedId);
      const bundle = await fetchOutlineBundle(resolvedId, token);
      const chapter = pickDefaultChapter(bundle.chapterOutlines);
      if (!chapter) {
        applyMock("Belum ada bab di outline. Menampilkan mock paket publish.");
        return;
      }

      setChapterOutlineId(chapter.id);

      const summaryResult = await getSummaryByChapter(resolvedId, chapter.id, token);
      const approved = summaryResult.summary?.status === "approved";
      setSummaryApproved(approved);
      setSummaryId(summaryResult.summary?.id ?? null);

      if (!approved) {
        setWorkflowNotice("Ringkasan bab perlu disetujui dulu sebelum membuat paket publish.");
      }

      const byChapter = await getPublishPackageByChapter(resolvedId, chapter.id, token);
      if (byChapter.publishPackage) {
        applyApiPackage(byChapter.publishPackage);
      } else {
        setPkg(emptyPublishShell(routeProjectId ?? resolvedId, chapter));
        setSource("api");
        setApiPkg(null);
        setPackageId(null);
      }
    } catch (error) {
      applyMock(userFacingError(error));
    } finally {
      setLoading(false);
    }
  }, [apiMode, applyApiPackage, applyMock, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setPkg(mockPublishPackage);
      setSource("mock");
      setNotice(
        useMocks
          ? null
          : "Masuk ke akun untuk paket publish dengan API. Menampilkan mock Sprint 1.",
      );
      return;
    }

    void loadPublishRoom();
  }, [apiMode, authLoading, loadPublishRoom, useMocks]);

  const generatePackageAction = useCallback(async () => {
    if (!apiMode || !token || !projectId || !chapterOutlineId) return;
    if (!summaryApproved) {
      setActionError("Ringkasan bab perlu disetujui dulu sebelum membuat paket publish.");
      return;
    }

    setGenerating(true);
    setActionError(null);
    try {
      const result = await generatePublishPackage(projectId, chapterOutlineId, token, {
        chapterSummaryId: summaryId ?? undefined,
      });
      applyApiPackage(result.publishPackage);
      setWorkflowNotice(null);
    } catch (error) {
      setActionError(userFacingError(error));
    } finally {
      setGenerating(false);
    }
  }, [
    apiMode,
    applyApiPackage,
    chapterOutlineId,
    projectId,
    summaryApproved,
    summaryId,
    token,
  ]);

  const saveFieldAction = useCallback(
    async (field: PublishEditableFieldKey, value: string) => {
      if (!apiMode || !token || !projectId || !packageId || isExported) return;

      setSavingField(field);
      setActionError(null);
      try {
        const patch = uiFieldToApiPatch(field, value);
        const result = await updatePublishPackageFields(projectId, packageId, patch, token);
        applyApiPackage(result.publishPackage);
      } catch (error) {
        setActionError(userFacingError(error));
      } finally {
        setSavingField(null);
      }
    },
    [apiMode, applyApiPackage, isExported, packageId, projectId, token],
  );

  const toggleChecklistItem = useCallback(
    async (itemId: string) => {
      if (!apiMode || !token || !projectId || !packageId || !apiPkg || isExported) return;

      const nextItems = apiPkg.checklist.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      );

      setSavingChecklist(true);
      setActionError(null);
      try {
        const result = await updatePublishChecklist(projectId, packageId, nextItems, token);
        applyApiPackage(result.publishPackage);
      } catch (error) {
        setActionError(userFacingError(error));
      } finally {
        setSavingChecklist(false);
      }
    },
    [apiMode, apiPkg, applyApiPackage, isExported, packageId, projectId, token],
  );

  const markExportedAction = useCallback(async () => {
    if (!apiMode || !token || !projectId || !packageId) return;

    setMarkingExported(true);
    setActionError(null);
    try {
      const result = await markPublishPackageExported(projectId, packageId, token);
      applyApiPackage(result.publishPackage);
      if (result.warnings.includes("checklist_incomplete")) {
        setWorkflowNotice(
          "Paket ditandai sudah disalin. Beberapa item checklist belum dicentang.",
        );
      }
    } catch (error) {
      setActionError(userFacingError(error));
    } finally {
      setMarkingExported(false);
    }
  }, [apiMode, applyApiPackage, packageId, projectId, token]);

  return {
    pkg,
    source,
    apiMode,
    loading,
    generating,
    savingField,
    savingChecklist,
    markingExported,
    notice,
    workflowNotice,
    actionError,
    hasPackage,
    isExported,
    isReadonly,
    summaryApproved,
    genre,
    generatePackageAction,
    saveFieldAction,
    toggleChecklistItem,
    markExportedAction,
  };
}