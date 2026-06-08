import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ChapterOutline, ChapterSummary as ApiChapterSummary } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { shouldUseMocks } from "@/lib/env";
import { mapApiSummaryToUi } from "@/lib/summary-mappers";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { mockChapterSummary } from "@/mocks/summary";
import { fetchOutlineBundle } from "@/services/outline";
import {
  acceptLinkedProposal,
  approveSummary,
  extractDelta,
  generateSummary,
  getLinkedProposals,
  getSummaryByChapter,
  rejectLinkedProposal,
  type LinkedProposalSummary,
} from "@/services/summary";
import { startWritingSession } from "@/services/write";
import type { ChapterSummary } from "@/types";

export type SummaryDataSource = "mock" | "api" | "api-fallback";

function pickDefaultChapter(chapters: ChapterOutline[]): ChapterOutline | null {
  if (chapters.length === 0) return null;
  return chapters.find((ch) => ch.chapterNumber === 1) ?? chapters[0] ?? null;
}

function userFacingError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 409) return error.message;
    if (error.status === 400) return error.message;
    if (error.status === 404) return "Data ringkasan tidak ditemukan.";
    if (error.status === 0) return "API tidak tersedia. Menampilkan mock Sprint 1.";
    return "Terjadi kesalahan saat memuat ringkasan.";
  }
  return "API tidak tersedia. Menampilkan mock Sprint 1.";
}

export interface UseSummaryDataResult {
  summary: ChapterSummary;
  source: SummaryDataSource;
  apiMode: boolean;
  loading: boolean;
  generating: boolean;
  extracting: boolean;
  approving: boolean;
  notice: string | null;
  workflowNotice: string | null;
  actionError: string | null;
  hasSummary: boolean;
  readyForSummary: boolean;
  isApproved: boolean;
  hasDelta: boolean;
  proposals: LinkedProposalSummary[];
  actionProposalId: string | null;
  generateSummaryAction: () => Promise<void>;
  extractDeltaAction: () => Promise<void>;
  approveSummaryAction: () => Promise<void>;
  acceptProposal: (proposalId: string) => Promise<void>;
  rejectProposal: (proposalId: string) => Promise<void>;
}

export function useSummaryData(): UseSummaryDataResult {
  const { id: routeProjectId } = useParams();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [summary, setSummary] = useState<ChapterSummary>(mockChapterSummary);
  const [source, setSource] = useState<SummaryDataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [chapterOutlineId, setChapterOutlineId] = useState<string | null>(null);
  const [writingSessionId, setWritingSessionId] = useState<string | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [apiSummary, setApiSummary] = useState<ApiChapterSummary | null>(null);
  const [readyForSummary, setReadyForSummary] = useState(false);
  const [hasDelta, setHasDelta] = useState(false);
  const [proposals, setProposals] = useState<LinkedProposalSummary[]>([]);
  const [actionProposalId, setActionProposalId] = useState<string | null>(null);

  const applyMock = useCallback((message: string | null) => {
    setSummary(mockChapterSummary);
    setSource("api-fallback");
    setNotice(message);
    setApiSummary(null);
    setSummaryId(null);
    setProposals([]);
    setHasDelta(false);
    setReadyForSummary(false);
  }, []);

  const applyApiSummary = useCallback(
    (apiRow: ApiChapterSummary, items: Parameters<typeof mapApiSummaryToUi>[1]) => {
      const ui = mapApiSummaryToUi(apiRow, items, routeProjectId ?? apiRow.projectId);
      setSummary(ui);
      setApiSummary(apiRow);
      setSummaryId(apiRow.id);
      setSource("api");
      setNotice(null);
    },
    [routeProjectId],
  );

  const refreshProposals = useCallback(
    async (resolvedProjectId: string, sid: string) => {
      if (!token) return;
      const result = await getLinkedProposals(resolvedProjectId, sid, token);
      setProposals(result.proposals);
    },
    [token],
  );

  const loadSummaryRoom = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);
    setWorkflowNotice(null);
    setActionError(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        applyMock("Proyek tidak ditemukan. Menampilkan mock ringkasan bab.");
        return;
      }

      setProjectId(resolvedId);
      const bundle = await fetchOutlineBundle(resolvedId, token);
      const chapter = pickDefaultChapter(bundle.chapterOutlines);
      if (!chapter) {
        applyMock("Belum ada bab di outline. Menampilkan mock ringkasan bab.");
        return;
      }

      setChapterOutlineId(chapter.id);

      const started = await startWritingSession(resolvedId, token, {
        chapterOutlineId: chapter.id,
      });
      setWritingSessionId(started.session.id);

      const ws = started.writingState.status;
      const sessionReady =
        started.session.status === "ready_for_summary" ||
        started.session.status === "completed";
      const chapterReady =
        ws === "ready_for_summary" || ws === "summarized";
      setReadyForSummary(sessionReady && chapterReady);

      if (!sessionReady || !chapterReady) {
        setWorkflowNotice(
          "Bab ini belum siap ringkasan. Selesaikan di Ruang Tulis dan tandai siap ringkasan terlebih dahulu.",
        );
      }

      const byChapter = await getSummaryByChapter(resolvedId, chapter.id, token);
      if (byChapter.summary) {
        applyApiSummary(byChapter.summary, byChapter.items ?? []);
        const linked = await getLinkedProposals(resolvedId, byChapter.summary.id, token);
        setProposals(linked.proposals);
        setHasDelta(linked.proposals.length > 0);
      } else {
        setSummary({
          ...mockChapterSummary,
          projectId: routeProjectId ?? resolvedId,
          chapterNumber: chapter.chapterNumber,
          chapterTitle: chapter.title,
          synopsis: "",
          newFacts: [],
          characterChanges: [],
          relationChanges: [],
          miniVictories: [],
          heldSecrets: [],
          openLoops: [],
          storyCheckNotes: [],
          status: "draft",
          pageCopy: {
            ...mockChapterSummary.pageCopy,
            subtitle:
              "Belum ada ringkasan bab. Buat ringkasan setelah bab siap di Ruang Tulis.",
            statusReady: "Belum Ada Ringkasan",
          },
        });
        setSource("api");
        setApiSummary(null);
        setSummaryId(null);
        setProposals([]);
        setHasDelta(false);
      }
    } catch (error) {
      applyMock(userFacingError(error));
    } finally {
      setLoading(false);
    }
  }, [apiMode, applyApiSummary, applyMock, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setSummary(mockChapterSummary);
      setSource("mock");
      setNotice(
        useMocks
          ? null
          : "Masuk ke akun untuk ringkasan bab dengan API. Menampilkan mock Sprint 1.",
      );
      return;
    }

    void loadSummaryRoom();
  }, [apiMode, authLoading, loadSummaryRoom, useMocks]);

  const generateSummaryAction = useCallback(async () => {
    if (!apiMode || !token || !projectId || !chapterOutlineId) return;
    setGenerating(true);
    setActionError(null);
    try {
      const result = await generateSummary(projectId, token, {
        chapterOutlineId,
        writingSessionId: writingSessionId ?? undefined,
      });
      applyApiSummary(result.summary, result.items);
      setProposals([]);
      setHasDelta(false);
      setWorkflowNotice(null);
    } catch (error) {
      setActionError(userFacingError(error));
    } finally {
      setGenerating(false);
    }
  }, [
    apiMode,
    applyApiSummary,
    chapterOutlineId,
    projectId,
    token,
    writingSessionId,
  ]);

  const extractDeltaAction = useCallback(async () => {
    if (!apiMode || !token || !projectId || !summaryId) return;
    setExtracting(true);
    setActionError(null);
    try {
      const result = await extractDelta(projectId, summaryId, token, {});
      setProposals(result.proposals);
      setHasDelta(true);
    } catch (error) {
      setActionError(userFacingError(error));
    } finally {
      setExtracting(false);
    }
  }, [apiMode, projectId, summaryId, token]);

  const approveSummaryAction = useCallback(async () => {
    if (!apiMode || !token || !projectId || !summaryId) return;
    setApproving(true);
    setActionError(null);
    try {
      const result = await approveSummary(projectId, summaryId, token);
      applyApiSummary(result.summary, result.items);
      await refreshProposals(projectId, summaryId);
      if (result.warnings.length > 0) {
        setWorkflowNotice(
          "Ringkasan disetujui. Usulan canon tetap perlu ditinjau satu per satu.",
        );
      }
    } catch (error) {
      setActionError(userFacingError(error));
    } finally {
      setApproving(false);
    }
  }, [apiMode, applyApiSummary, projectId, refreshProposals, summaryId, token]);

  const acceptProposal = useCallback(
    async (proposalId: string) => {
      if (!apiMode || !token || !projectId || !summaryId) return;
      setActionProposalId(proposalId);
      setActionError(null);
      try {
        const result = await acceptLinkedProposal(projectId, summaryId, proposalId, token, {});
        setProposals((prev) =>
          prev.map((p) => (p.proposalId === proposalId ? result.proposal : p)),
        );
        if (result.promoted?.entityType === "fact") {
          setWorkflowNotice("Usulan fakta diterima dan ditambahkan ke canon.");
        }
      } catch (error) {
        setActionError(userFacingError(error));
      } finally {
        setActionProposalId(null);
      }
    },
    [apiMode, projectId, summaryId, token],
  );

  const rejectProposal = useCallback(
    async (proposalId: string) => {
      if (!apiMode || !token || !projectId || !summaryId) return;
      setActionProposalId(proposalId);
      setActionError(null);
      try {
        const result = await rejectLinkedProposal(projectId, summaryId, proposalId, token, {
          reason: "Ditolak dari Ringkasan Bab",
        });
        setProposals((prev) =>
          prev.map((p) => (p.proposalId === proposalId ? result.proposal : p)),
        );
        setWorkflowNotice("Usulan ditolak — tidak ada perubahan canon.");
      } catch (error) {
        setActionError(userFacingError(error));
      } finally {
        setActionProposalId(null);
      }
    },
    [apiMode, projectId, summaryId, token],
  );

  const isApproved = apiSummary?.status === "approved";

  return {
    summary,
    source,
    apiMode,
    loading,
    generating,
    extracting,
    approving,
    notice,
    workflowNotice,
    actionError,
    hasSummary: Boolean(summaryId),
    readyForSummary,
    isApproved,
    hasDelta,
    proposals,
    actionProposalId,
    generateSummaryAction,
    extractDeltaAction,
    approveSummaryAction,
    acceptProposal,
    rejectProposal,
  };
}