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
import { apiErrorMessage } from "@/lib/hook-fallback";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { mockStoryFoundation } from "@/mocks/storyFoundation";
import { fetchFoundationBundle } from "@/services/foundation";
import {
  acceptProposal,
  fetchFoundationProposals,
  fetchFoundationReadiness,
  generateFoundationProposals,
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
  locking: boolean;
  acceptingId: string | null;
  notice: string | null;
  lockNotice: string | null;
  apiMode: boolean;
  generateProposals: () => Promise<void>;
  acceptProposalById: (proposalId: string) => Promise<void>;
  lockFoundationNow: () => Promise<void>;
  refresh: () => Promise<void>;
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
  const [locking, setLocking] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

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

  const generateProposals = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setGenerating(true);
    setNotice(null);
    try {
      await generateFoundationProposals(projectId, token, {});
      const [proposalRows, readiness] = await Promise.all([
        fetchFoundationProposals(projectId, token, true),
        fetchFoundationReadiness(projectId, token),
      ]);
      setProposals(proposalRows.map(mapProposalToUi));
      setFoundation((prev) => ({
        ...prev,
        readiness: mapReadinessApiToUi(readiness),
      }));
    } catch (error) {
      setNotice(
        error instanceof ApiClientError
          ? `Gagal membuat usulan (${error.message}).`
          : "Gagal membuat usulan fondasi.",
      );
    } finally {
      setGenerating(false);
    }
  }, [apiMode, projectId, token]);

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
        setNotice(
          error instanceof ApiClientError
            ? `Gagal menerima usulan (${error.message}).`
            : "Gagal menerima usulan.",
        );
      } finally {
        setAcceptingId(null);
      }
    },
    [apiMode, projectId, token],
  );

  const lockFoundationNow = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setLocking(true);
    setLockNotice(null);
    try {
      const result = await lockFoundation(projectId, token);
      const ui = mapFoundationBundleToUi(
        projectId,
        result.foundation,
        result.promoted.characters,
        result.promoted.facts,
      );
      ui.readiness = mapReadinessApiToUi(result.readiness);
      ui.isLocked = result.foundation.isLocked;
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

  return useMemo(
    () => ({
      foundation,
      proposals,
      source,
      loading,
      generating,
      locking,
      acceptingId,
      notice,
      lockNotice,
      apiMode,
      generateProposals,
      acceptProposalById,
      lockFoundationNow,
      refresh: loadAll,
    }),
    [
      foundation,
      proposals,
      source,
      loading,
      generating,
      locking,
      acceptingId,
      notice,
      lockNotice,
      apiMode,
      generateProposals,
      acceptProposalById,
      lockFoundationNow,
      loadAll,
    ],
  );
}