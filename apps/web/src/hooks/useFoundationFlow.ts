import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import {
  mapFoundationBundleToUi,
  mapProposalToUi,
  mapReadinessApiToUi,
  type UiFoundationProposal,
} from "@/lib/api-mappers";
import { createEmptyApiFoundation } from "@/lib/empty-states";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { aiGenerationFailureNotice, apiErrorMessage } from "@/lib/hook-fallback";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { mockStoryFoundation } from "@/mocks/storyFoundation";
import { ROUTES } from "@/routes/paths";
import {
  formatCreditSuccessNotice,
  formatFoundationCreditCostLabel,
  getFoundationCreditCost,
} from "@/services/ai-credit-display";
import { fetchCreditBalance, fetchCreditEstimate } from "@/services/credits";
import { fetchFoundationBundle } from "@/services/foundation";
import {
  acceptProposal,
  buildFoundationGenerationIdempotencyKey,
  fetchFoundationProposals,
  fetchFoundationReadiness,
  generateFoundationProposals,
  generateFoundationProposalsFromNarra,
  lockFoundation,
} from "@/services/foundation-flow";
import type { StoryFoundation } from "@/types/storyFoundation";

export type FoundationFlowSource = "mock" | "api" | "error";

export interface FoundationFlowData {
  foundation: StoryFoundation;
  proposals: UiFoundationProposal[];
  source: FoundationFlowSource;
  loading: boolean;
  generating: boolean;
  generatingNarra: boolean;
  locking: boolean;
  acceptingId: string | null;
  notice: string | null;
  lockNotice: string | null;
  apiMode: boolean;
  matangkanDenganNarraRoute: string | null;
  generateProposals: () => Promise<void>;
  generateNarraProposals: () => Promise<void>;
  acceptProposalById: (proposalId: string) => Promise<void>;
  lockFoundationNow: () => Promise<void>;
  refresh: () => Promise<void>;
  serverCreditCost: number | null;
  creditBalance: number | null;
  creditLoading: boolean;
  creditError: string | null;
  creditCostLabel: string;
  creditInsufficient: boolean;
}

function formatLockError(error: ApiClientError): string {
  const details = error.details as
    | { missing?: string[]; failedChecks?: string[]; readinessScore?: number }
    | undefined;
  const parts = [error.message];
  if (details?.missing && details.missing.length > 0) {
    parts.push(`Kurang: ${details.missing.join(", ")}`);
  }
  if (typeof details?.readinessScore === "number") {
    parts.push(`Kesiapan: ${details.readinessScore}%`);
  }
  return parts.join(" — ");
}

export function useFoundationFlow(): FoundationFlowData {
  const { id: routeProjectId } = useParams();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [foundation, setFoundation] = useState<StoryFoundation>(() => {
    if (useMocks) return mockStoryFoundation;
    return mapFoundationBundleToUi(
      routeProjectId ?? "unknown",
      createEmptyApiFoundation(routeProjectId ?? "unknown"),
      [],
      [],
    );
  });
  const [proposals, setProposals] = useState<UiFoundationProposal[]>([]);
  const [source, setSource] = useState<FoundationFlowSource>(useMocks ? "mock" : "api");
  const [loading, setLoading] = useState(apiMode);
  const [generating, setGenerating] = useState(false);
  const [generatingNarra, setGeneratingNarra] = useState(false);
  const [locking, setLocking] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [serverCreditCost, setServerCreditCost] = useState<number | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const matangkanDenganNarraRoute = projectId
    ? `${ROUTES.project.narra(projectId)}?mode=foundation`
    : null;

  const loadAll = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        if (allowMockFallback()) {
          setFoundation(mockStoryFoundation);
          setSource("mock");
          setNotice("Proyek tidak ditemukan. Menampilkan demo fondasi.");
        } else {
          setFoundation(
            mapFoundationBundleToUi(
              routeProjectId ?? "unknown",
              createEmptyApiFoundation(routeProjectId ?? "unknown"),
              [],
              [],
            ),
          );
          setSource("error");
          setNotice("Proyek tidak ditemukan.");
        }
        setProposals([]);
        return;
      }

      setProjectId(resolvedId);

      const [bundle, proposalRows, readiness] = await Promise.all([
        fetchFoundationBundle(resolvedId, token),
        fetchFoundationProposals(resolvedId, token, true),
        fetchFoundationReadiness(resolvedId, token),
      ]);

      const uiFoundation = mapFoundationBundleToUi(
        resolvedId,
        bundle.foundation,
        bundle.characters,
        bundle.facts,
      );
      uiFoundation.readiness = mapReadinessApiToUi(readiness);
      uiFoundation.isLocked = bundle.foundation.isLocked;

      setFoundation(uiFoundation);
      setProposals(proposalRows.map(mapProposalToUi));
      setSource("api");
    } catch (error) {
      if (allowMockFallback()) {
        setFoundation(mockStoryFoundation);
        setSource("mock");
        setNotice(apiErrorMessage(error, "API tidak tersedia. Menampilkan demo Sprint 1."));
      } else {
        setFoundation(
          mapFoundationBundleToUi(
            routeProjectId ?? "unknown",
            createEmptyApiFoundation(routeProjectId ?? "unknown"),
            [],
            [],
          ),
        );
        setSource("error");
        setNotice(apiErrorMessage(error, "API tidak tersedia."));
      }
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [apiMode, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setFoundation(mockStoryFoundation);
      setProposals([]);
      setSource("mock");
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk membaca fondasi dari API.");
      return;
    }

    void loadAll();
  }, [authLoading, apiMode, loadAll, useMocks]);

  useEffect(() => {
    if (!apiMode || !token || !projectId) {
      setServerCreditCost(null);
      setCreditBalance(null);
      setCreditLoading(false);
      setCreditError(null);
      return;
    }

    let ignore = false;
    setCreditLoading(true);
    setCreditError(null);

    void Promise.allSettled([
      fetchCreditEstimate("foundation_setup", undefined, token),
      fetchCreditBalance(token),
    ]).then(([estimateResult, balanceResult]) => {
      if (ignore) return;

      if (estimateResult.status === "fulfilled") {
        setServerCreditCost(estimateResult.value.creditCost);
      } else {
        setServerCreditCost(null);
        setCreditError("Estimasi biaya belum bisa dimuat.");
      }

      if (balanceResult.status === "fulfilled") {
        setCreditBalance(balanceResult.value?.balance ?? null);
      } else {
        setCreditBalance(null);
        setCreditError((current) =>
          current
            ? `${current} Saldo belum bisa dimuat.`
            : "Saldo belum bisa dimuat; server tetap memvalidasi saat klik.",
        );
      }
      setCreditLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [apiMode, projectId, token]);

  const generateProposals = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    const creditCost = getFoundationCreditCost(serverCreditCost);
    if (creditBalance != null && creditBalance < creditCost) {
      setNotice("Kredit tidak cukup untuk membuat usulan fondasi.");
      return;
    }

    setGenerating(true);
    setNotice(null);
    try {
      const result = await generateFoundationProposals(projectId, token, {
        idempotencyKey: buildFoundationGenerationIdempotencyKey(),
      });
      const [proposalRows, readiness] = await Promise.all([
        fetchFoundationProposals(projectId, token, true),
        fetchFoundationReadiness(projectId, token),
      ]);
      setProposals(proposalRows.map(mapProposalToUi));
      setFoundation((prev) => ({
        ...prev,
        readiness: mapReadinessApiToUi(readiness),
      }));
      setCreditBalance(result.creditBalance?.balance ?? creditBalance);
      setNotice(
        formatCreditSuccessNotice(
          "Usulan fondasi berhasil dibuat",
          result.creditCost,
          result.creditBalance?.balance ?? creditBalance,
          result.idempotentReplay,
        ),
      );
    } catch (error) {
      setNotice(aiGenerationFailureNotice(error, "Gagal membuat usulan"));
    } finally {
      setGenerating(false);
    }
  }, [apiMode, creditBalance, projectId, serverCreditCost, token]);

  const acceptProposalById = useCallback(
    async (proposalId: string) => {
      if (!apiMode || !token || !projectId) return;

      setAcceptingId(proposalId);
      setNotice(null);
      try {
        await acceptProposal(projectId, proposalId, token);
        const [proposalRows, readiness, bundle] = await Promise.all([
          fetchFoundationProposals(projectId, token, true),
          fetchFoundationReadiness(projectId, token),
          fetchFoundationBundle(projectId, token),
        ]);
        setProposals(proposalRows.map(mapProposalToUi));
        setFoundation((prev) => {
          const ui = mapFoundationBundleToUi(
            projectId,
            bundle.foundation,
            bundle.characters,
            bundle.facts,
          );
          return {
            ...prev,
            ...ui,
            readiness: mapReadinessApiToUi(readiness),
            pageCopy: prev.pageCopy,
            secretSchedule: prev.secretSchedule,
          };
        });
      } catch (error) {
        setNotice(aiGenerationFailureNotice(error, "Gagal menerima usulan"));
      } finally {
        setAcceptingId(null);
      }
    },
    [apiMode, projectId, token],
  );

  const generateNarraProposals = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setGeneratingNarra(true);
    setNotice(null);
    try {
      await generateFoundationProposalsFromNarra(projectId, token);
      const [proposalRows, readiness, bundle] = await Promise.all([
        fetchFoundationProposals(projectId, token, true),
        fetchFoundationReadiness(projectId, token),
        fetchFoundationBundle(projectId, token),
      ]);
      setProposals(proposalRows.map(mapProposalToUi));
      const ui = mapFoundationBundleToUi(
        projectId,
        bundle.foundation,
        bundle.characters,
        bundle.facts,
      );
      ui.readiness = mapReadinessApiToUi(readiness);
      ui.isLocked = bundle.foundation.isLocked;
      setFoundation((prev) => ({
        ...prev,
        ...ui,
        pageCopy: prev.pageCopy,
        secretSchedule: prev.secretSchedule,
      }));
    } catch (error) {
      setNotice(aiGenerationFailureNotice(error, "Gagal membuat Usulan Narra"));
    } finally {
      setGeneratingNarra(false);
    }
  }, [apiMode, projectId, token]);

  const lockFoundationNow = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setLocking(true);
    setLockNotice(null);
    try {
      await lockFoundation(projectId, token);
      const [bundle, readiness] = await Promise.all([
        fetchFoundationBundle(projectId, token),
        fetchFoundationReadiness(projectId, token),
      ]);
      const ui = mapFoundationBundleToUi(
        projectId,
        bundle.foundation,
        bundle.characters,
        bundle.facts,
      );
      ui.readiness = mapReadinessApiToUi(readiness);
      ui.isLocked = bundle.foundation.isLocked;
      setFoundation((prev) => ({
        ...ui,
        pageCopy: prev.pageCopy,
        secretSchedule: prev.secretSchedule,
      }));
      setLockNotice("Fondasi berhasil dikunci. Siap lanjut ke outline.");
    } catch (error) {
      setLockNotice(
        error instanceof ApiClientError ? formatLockError(error) : "Gagal mengunci fondasi.",
      );
    } finally {
      setLocking(false);
    }
  }, [apiMode, projectId, token]);

  const creditCost = getFoundationCreditCost(serverCreditCost);
  const creditInsufficient =
    creditBalance != null && creditBalance < creditCost;
  const creditCostLabel = formatFoundationCreditCostLabel(serverCreditCost);

  return useMemo(
    () => ({
      foundation,
      proposals,
      source,
      loading,
      generating,
      generatingNarra,
      locking,
      acceptingId,
      notice,
      lockNotice,
      apiMode,
      matangkanDenganNarraRoute,
      generateProposals,
      generateNarraProposals,
      acceptProposalById,
      lockFoundationNow,
      refresh: loadAll,
      serverCreditCost,
      creditBalance,
      creditLoading,
      creditError,
      creditCostLabel,
      creditInsufficient,
    }),
    [
      foundation,
      proposals,
      source,
      loading,
      generating,
      generatingNarra,
      locking,
      acceptingId,
      notice,
      lockNotice,
      apiMode,
      matangkanDenganNarraRoute,
      generateProposals,
      generateNarraProposals,
      acceptProposalById,
      lockFoundationNow,
      loadAll,
      serverCreditCost,
      creditBalance,
      creditLoading,
      creditError,
      creditCostLabel,
      creditInsufficient,
    ],
  );
}
