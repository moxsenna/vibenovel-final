import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  ChapterOutline,
  CreditBalance,
  PublishPackage as ApiPublishPackage,
  WriterQualityMode,
} from "@vibenovel/shared";
import { WRITER_QUALITY_MODES } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import {
  mapApiPublishPackageToUi,
  type PublishEditableFieldKey,
  uiFieldToApiPatch,
} from "@/lib/publish-mappers";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { mockPublishPackage } from "@/mocks/publishPackage";
import {
  buildPublishCopyIdempotencyKey,
  formatPublishCopyCreditCostLabel,
  formatQualityModeLabel,
  getPublishCopyCreditCost,
  improvePublishCopy,
  mapAiPublishCopyErrorCode,
  normalizeQualityMode,
  PUBLISH_COPY_AI_FIELDS,
  type PublishCopyAiField,
  type PublishCopySuggestions,
} from "@/services/ai";
import { fetchCreditBalance } from "@/services/credits";
import { fetchOutlineBundle } from "@/services/outline";
import {
  generatePublishPackage,
  getPublishPackageByChapter,
  markPublishPackageExported,
  updatePublishChecklist,
  updatePublishPackageFields,
  type PublishFieldPatch,
} from "@/services/publish";
import { fetchProjectSettings } from "@/services/settings";
import { getSummaryByChapter } from "@/services/summary";
import type { PublishPackage } from "@/types";

export type PublishDataSource = "mock" | "api" | "locked" | "error";

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
    if (error.status === 0) return "API tidak tersedia. Coba muat ulang.";
    return "Terjadi kesalahan saat memuat paket publish.";
  }
  return "API tidak tersedia. Coba muat ulang.";
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

const DEFAULT_AI_FIELDS: PublishCopyAiField[] = [
  PUBLISH_COPY_AI_FIELDS.teaser,
  PUBLISH_COPY_AI_FIELDS.caption,
];

function aiFieldToEditableKey(field: PublishCopyAiField): PublishEditableFieldKey {
  return field;
}

function mapPublishCopyAiError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      const missing = Array.isArray((error.details as { missing?: string[] })?.missing)
        ? (error.details as { missing: string[] }).missing
        : [];
      if (missing.includes("exported_package_locked")) {
        return "Paket sudah ditandai exported dan tidak bisa diperbaiki.";
      }
    }
    return mapAiPublishCopyErrorCode(error.code, error.message);
  }
  return "Gagal membuat saran copy AI.";
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
  publishCopyAiLoading: boolean;
  publishCopyAiError: string | null;
  publishCopyAiNotice: string | null;
  publishCopySuggestions: PublishCopySuggestions | null;
  selectedAiFields: PublishCopyAiField[];
  publishCopyInstruction: string;
  applyingSuggestionField: PublishCopyAiField | null;
  applyingAllSuggestions: boolean;
  publishCopyCreditCostLabel: string | null;
  publishCopyQualityModeLabel: string | null;
  publishCopyCreditBalance: number | null;
  publishCopyCreditLoading: boolean;
  publishCopyCreditError: string | null;
  publishCopyInsufficientCredit: boolean;
  publishCopyRemainingAfterImprove: number | null;
  publishCopyAiUnavailableReason: string | null;
  setSelectedAiFields: (fields: PublishCopyAiField[]) => void;
  setPublishCopyInstruction: (text: string) => void;
  generatePackageAction: () => Promise<void>;
  saveFieldAction: (field: PublishEditableFieldKey, value: string) => Promise<void>;
  toggleChecklistItem: (itemId: string) => Promise<void>;
  markExportedAction: () => Promise<void>;
  improvePublishCopyWithAi: () => Promise<void>;
  publishCopyAiCanRun: boolean;
  applyPublishCopySuggestion: (field: PublishCopyAiField) => Promise<void>;
  applyAllPublishCopySuggestions: () => Promise<void>;
  dismissPublishCopySuggestion: (field: PublishCopyAiField) => void;
  lockedTitle: string | null;
  lockedDescription: string | null;
}

export function usePublishData(): UsePublishDataResult {
  const { id: routeProjectId } = useParams();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [pkg, setPkg] = useState<PublishPackage>(() => {
    if (useMocks) return mockPublishPackage;
    return {
      ...mockPublishPackage,
      projectId: routeProjectId ?? "unknown",
      chapterNumber: 0,
      chapterTitle: "",
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
        chapterLabel: "Bab 0",
        excerpt: "",
      },
      pageCopy: {
        ...mockPublishPackage.pageCopy,
        title: "Aset Publikasi",
        subtitle: "Memuat paket publish...",
        badgeLabel: "Memuat...",
      },
    };
  });
  const [source, setSource] = useState<PublishDataSource>(useMocks ? "mock" : "api");
  const [loading, setLoading] = useState(apiMode);
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
  const [qualityMode, setQualityMode] = useState<WriterQualityMode>(WRITER_QUALITY_MODES.seimbang);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [publishCopyAiLoading, setPublishCopyAiLoading] = useState(false);
  const [publishCopyAiError, setPublishCopyAiError] = useState<string | null>(null);
  const [publishCopyAiNotice, setPublishCopyAiNotice] = useState<string | null>(null);
  const [publishCopySuggestions, setPublishCopySuggestions] =
    useState<PublishCopySuggestions | null>(null);
  const [selectedAiFields, setSelectedAiFields] =
    useState<PublishCopyAiField[]>(DEFAULT_AI_FIELDS);
  const [publishCopyInstruction, setPublishCopyInstruction] = useState("");
  const [applyingSuggestionField, setApplyingSuggestionField] =
    useState<PublishCopyAiField | null>(null);
  const [applyingAllSuggestions, setApplyingAllSuggestions] = useState(false);
  const [lockedTitle, setLockedTitle] = useState<string | null>(null);
  const [lockedDescription, setLockedDescription] = useState<string | null>(null);

  const isExported = apiPkg?.status === "exported";
  const isReadonly = !apiMode || source !== "api" || isExported;
  const hasPackage = Boolean(packageId);
  const genre = apiPkg?.genre ?? null;

  const resetPublishCopyAiState = useCallback(() => {
    setPublishCopyAiLoading(false);
    setPublishCopyAiError(null);
    setPublishCopyAiNotice(null);
    setPublishCopySuggestions(null);
    setSelectedAiFields(DEFAULT_AI_FIELDS);
    setPublishCopyInstruction("");
    setApplyingSuggestionField(null);
    setApplyingAllSuggestions(false);
    setCreditBalance(null);
    setCreditLoading(false);
    setCreditError(null);
  }, []);

  const applyMockFallback = useCallback(
    (message: string | null) => {
      setPkg(mockPublishPackage);
      setSource("mock");
      setLockedTitle(null);
      setLockedDescription(null);
      setNotice(message);
      setApiPkg(null);
      setPackageId(null);
      setSummaryApproved(false);
      setSummaryId(null);
      resetPublishCopyAiState();
    },
    [resetPublishCopyAiState],
  );

  const applyBlocked = useCallback(
    (kind: "locked" | "error", title: string, description: string) => {
      setPkg({
        ...mockPublishPackage,
        projectId: routeProjectId ?? "unknown",
        chapterNumber: 0,
        chapterTitle: "",
        title: "",
        blurb: "",
        teaser: "",
        caption: "",
        commentBait: "",
        nextChapterTeaser: "",
        tags: [],
        pageCopy: {
          ...mockPublishPackage.pageCopy,
          title,
          subtitle: description,
          badgeLabel: "Belum Tersedia",
        },
      });
      setSource(kind);
      setLockedTitle(title);
      setLockedDescription(description);
      setNotice(null);
      setApiPkg(null);
      setPackageId(null);
      setSummaryApproved(false);
      setSummaryId(null);
      resetPublishCopyAiState();
    },
    [resetPublishCopyAiState, routeProjectId],
  );

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

  const refreshCreditBalance = useCallback(async () => {
    if (!apiMode || !token) return;
    setCreditLoading(true);
    setCreditError(null);
    try {
      const balance = await fetchCreditBalance(token);
      setCreditBalance(balance);
    } catch {
      setCreditBalance(null);
      setCreditError("Saldo belum bisa dimuat; server tetap memvalidasi saat klik.");
    } finally {
      setCreditLoading(false);
    }
  }, [apiMode, token]);

  const loadQualityMode = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;
    try {
      const settings = await fetchProjectSettings(projectId, token);
      setQualityMode(normalizeQualityMode(settings.qualityMode));
    } catch {
      setQualityMode(WRITER_QUALITY_MODES.seimbang);
    }
  }, [apiMode, projectId, token]);

  const loadPublishRoom = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);
    setWorkflowNotice(null);
    setActionError(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        if (allowMockFallback()) {
          applyMockFallback("Proyek tidak ditemukan. Menampilkan demo paket publish.");
        } else {
          applyBlocked("error", "Proyek tidak ditemukan", "Proyek ini tidak ada atau Anda tidak memiliki akses.");
        }
        return;
      }

      setLockedTitle(null);
      setLockedDescription(null);

      setProjectId(resolvedId);
      const bundle = await fetchOutlineBundle(resolvedId, token);
      const chapter = pickDefaultChapter(bundle.chapterOutlines);
      if (!chapter) {
        applyBlocked(
          "locked",
          "Paket Publish belum tersedia",
          "Belum ada bab yang siap dipublish. Selesaikan outline, ruang tulis, dan ringkasan bab terlebih dahulu.",
        );
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
      if (allowMockFallback()) {
        applyMockFallback(userFacingError(error));
      } else {
        applyBlocked("error", "Paket publish tidak bisa dimuat", userFacingError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [apiMode, applyApiPackage, applyBlocked, applyMockFallback, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setPkg(mockPublishPackage);
      setSource("mock");
      resetPublishCopyAiState();
      setLockedTitle(null);
      setLockedDescription(null);
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk paket publish dengan API.");
      return;
    }

    void loadPublishRoom();
  }, [apiMode, authLoading, loadPublishRoom, resetPublishCopyAiState, useMocks]);

  useEffect(() => {
    if (!apiMode || !token || !projectId) return;
    void refreshCreditBalance();
    void loadQualityMode();
  }, [apiMode, loadQualityMode, projectId, refreshCreditBalance, token]);

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

  const dismissPublishCopySuggestion = useCallback((field: PublishCopyAiField) => {
    setPublishCopySuggestions((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[field];
      return Object.keys(next).length > 0 ? next : null;
    });
  }, []);

  const improvePublishCopyWithAi = useCallback(async () => {
    if (
      !apiMode ||
      !token ||
      !projectId ||
      !packageId ||
      source !== "api" ||
      isExported ||
      publishCopyAiLoading
    ) {
      return;
    }

    if (selectedAiFields.length === 0) {
      setPublishCopyAiError("Pilih minimal satu field untuk diperbaiki.");
      return;
    }

    const copyCost = getPublishCopyCreditCost(qualityMode);
    if (creditBalance != null && creditBalance.balance < copyCost) {
      setPublishCopyAiError("Kredit tidak cukup.");
      return;
    }

    setPublishCopyAiLoading(true);
    setPublishCopyAiError(null);
    setPublishCopyAiNotice(null);

    const idempotencyKey = buildPublishCopyIdempotencyKey(packageId);
    const instruction = publishCopyInstruction.trim();

    try {
      const result = await improvePublishCopy(projectId, token, {
        packageId,
        fields: selectedAiFields,
        qualityMode,
        idempotencyKey,
        ...(instruction ? { instruction } : {}),
      });

      setPublishCopySuggestions(result.suggestions);

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
      setPublishCopyAiNotice(
        `Saran copy siap ditinjau. Terpotong ${cost} kredit.${balanceNote}${replayNote}`,
      );
    } catch (error) {
      setPublishCopyAiError(mapPublishCopyAiError(error));
    } finally {
      setPublishCopyAiLoading(false);
    }
  }, [
    apiMode,
    creditBalance,
    isExported,
    packageId,
    projectId,
    publishCopyAiLoading,
    publishCopyInstruction,
    qualityMode,
    refreshCreditBalance,
    selectedAiFields,
    source,
    token,
  ]);

  const applyPublishCopySuggestion = useCallback(
    async (field: PublishCopyAiField) => {
      if (
        !apiMode ||
        !token ||
        !projectId ||
        !packageId ||
        isExported ||
        !publishCopySuggestions?.[field]
      ) {
        return;
      }

      const value = publishCopySuggestions[field];
      if (!value?.trim()) return;

      setApplyingSuggestionField(field);
      setPublishCopyAiError(null);

      try {
        const patch = uiFieldToApiPatch(aiFieldToEditableKey(field), value);
        const result = await updatePublishPackageFields(projectId, packageId, patch, token);
        applyApiPackage(result.publishPackage);
        dismissPublishCopySuggestion(field);
        setPublishCopyAiNotice(`Field ${field} berhasil diterapkan ke paket publish.`);
      } catch (error) {
        setPublishCopyAiError(userFacingError(error));
      } finally {
        setApplyingSuggestionField(null);
      }
    },
    [
      apiMode,
      applyApiPackage,
      dismissPublishCopySuggestion,
      isExported,
      packageId,
      projectId,
      publishCopySuggestions,
      token,
    ],
  );

  const applyAllPublishCopySuggestions = useCallback(async () => {
    if (
      !apiMode ||
      !token ||
      !projectId ||
      !packageId ||
      isExported ||
      !publishCopySuggestions
    ) {
      return;
    }

    const patch: PublishFieldPatch = {};
    for (const [field, value] of Object.entries(publishCopySuggestions) as [
      PublishCopyAiField,
      string,
    ][]) {
      if (value?.trim()) {
        Object.assign(patch, uiFieldToApiPatch(aiFieldToEditableKey(field), value));
      }
    }

    if (Object.keys(patch).length === 0) return;

    setApplyingAllSuggestions(true);
    setPublishCopyAiError(null);

    try {
      const result = await updatePublishPackageFields(projectId, packageId, patch, token);
      applyApiPackage(result.publishPackage);
      setPublishCopySuggestions(null);
      setPublishCopyAiNotice("Semua saran copy berhasil diterapkan ke paket publish.");
    } catch (error) {
      setPublishCopyAiError(userFacingError(error));
    } finally {
      setApplyingAllSuggestions(false);
    }
  }, [
    apiMode,
    applyApiPackage,
    isExported,
    packageId,
    projectId,
    publishCopySuggestions,
    token,
  ]);

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

  const publishCopyCost = getPublishCopyCreditCost(qualityMode);
  const knownBalance = creditBalance?.balance ?? null;
  const publishCopyInsufficientCredit =
    knownBalance != null && knownBalance < publishCopyCost;
  const publishCopyRemainingAfterImprove =
    knownBalance != null ? Math.max(0, knownBalance - publishCopyCost) : null;

  const publishCopyAiCanRun =
    apiMode &&
    source === "api" &&
    hasPackage &&
    !isExported &&
    selectedAiFields.length > 0 &&
    !publishCopyAiLoading &&
    !publishCopyInsufficientCredit;

  const publishCopyAiUnavailableReason = useMemo(() => {
    if (!apiMode || source !== "api") {
      return "Perbaiki copy dengan AI hanya tersedia dalam mode API.";
    }
    if (!hasPackage) {
      return "Buat paket publish terlebih dahulu.";
    }
    if (isExported) {
      return null;
    }
    if (selectedAiFields.length === 0) {
      return "Pilih minimal satu field untuk diperbaiki.";
    }
    if (publishCopyInsufficientCredit) {
      return "Kredit tidak cukup untuk membuat saran copy.";
    }
    return null;
  }, [
    apiMode,
    hasPackage,
    isExported,
    publishCopyInsufficientCredit,
    selectedAiFields.length,
    source,
  ]);

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
    publishCopyAiLoading,
    publishCopyAiError,
    publishCopyAiNotice,
    publishCopySuggestions,
    selectedAiFields,
    publishCopyInstruction,
    applyingSuggestionField,
    applyingAllSuggestions,
    publishCopyCreditCostLabel: formatPublishCopyCreditCostLabel(qualityMode),
    publishCopyQualityModeLabel: formatQualityModeLabel(qualityMode),
    publishCopyCreditBalance: knownBalance,
    publishCopyCreditLoading: creditLoading,
    publishCopyCreditError: creditError,
    publishCopyInsufficientCredit,
    publishCopyRemainingAfterImprove,
    publishCopyAiUnavailableReason,
    setSelectedAiFields,
    setPublishCopyInstruction,
    generatePackageAction,
    saveFieldAction,
    toggleChecklistItem,
    markExportedAction,
    improvePublishCopyWithAi,
    publishCopyAiCanRun,
    applyPublishCopySuggestion,
    applyAllPublishCopySuggestions,
    dismissPublishCopySuggestion,
    lockedTitle,
    lockedDescription,
  };
}