import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { mapApiConceptToUi } from "@/lib/api-mappers";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { apiErrorMessage } from "@/lib/hook-fallback";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { CONCEPTS_PAGE_COPY, mockConcepts } from "@/mocks/concepts";
import { fetchConcepts, generateConcepts, selectConcept } from "@/services/concepts";
import { ROUTES } from "@/routes/paths";
import type { StoryConcept } from "@/types";

export type ConceptsDataSource = "mock" | "api" | "error";

export interface ConceptsData {
  concepts: StoryConcept[];
  pageCopy: typeof CONCEPTS_PAGE_COPY;
  source: ConceptsDataSource;
  loading: boolean;
  generating: boolean;
  selectingId: string | null;
  notice: string | null;
  apiMode: boolean;
  generate: () => Promise<void>;
  selectConceptById: (conceptId: string) => Promise<void>;
}

export function useConceptsData(): ConceptsData {
  const { id: routeProjectId } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [concepts, setConcepts] = useState<StoryConcept[]>(useMocks ? mockConcepts : []);
  const [source, setSource] = useState<ConceptsDataSource>(useMocks ? "mock" : "api");
  const [loading, setLoading] = useState(apiMode);
  const [generating, setGenerating] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const loadConcepts = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        setConcepts(allowMockFallback() ? mockConcepts : []);
        setSource(allowMockFallback() ? "mock" : "error");
        setNotice(
          allowMockFallback()
            ? "Proyek tidak ditemukan. Menampilkan demo konsep."
            : "Proyek tidak ditemukan.",
        );
        return;
      }

      setProjectId(resolvedId);
      const rows = await fetchConcepts(resolvedId, token);
      if (rows.length === 0) {
        setConcepts([]);
        setSource("api");
        return;
      }

      setConcepts(rows.map((c, i) => mapApiConceptToUi(c, resolvedId, i)));
      setSource("api");
    } catch (error) {
      setConcepts(allowMockFallback() ? mockConcepts : []);
      setSource(allowMockFallback() ? "mock" : "error");
      setNotice(apiErrorMessage(error, "API tidak tersedia."));
    } finally {
      setLoading(false);
    }
  }, [apiMode, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setConcepts(mockConcepts);
      setSource("mock");
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk membaca konsep dari API.");
      return;
    }

    void loadConcepts();
  }, [authLoading, apiMode, loadConcepts, useMocks]);

  const generate = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    setGenerating(true);
    setNotice(null);
    try {
      const result = await generateConcepts(projectId, token, {});
      setConcepts(result.concepts.map((c, i) => mapApiConceptToUi(c, projectId, i)));
      setSource("api");
    } catch (error) {
      setNotice(
        error instanceof ApiClientError
          ? `Gagal membuat konsep (${error.message}).`
          : "Gagal membuat konsep.",
      );
    } finally {
      setGenerating(false);
    }
  }, [apiMode, projectId, token]);

  const selectConceptById = useCallback(
    async (conceptId: string) => {
      if (!apiMode || !token || !projectId) return;

      setSelectingId(conceptId);
      setNotice(null);
      try {
        await selectConcept(projectId, conceptId, token);
        setConcepts((prev) =>
          prev.map((c) => ({
            ...c,
            status: c.id === conceptId ? "selected" : c.status === "selected" ? "rejected" : c.status,
          })),
        );
        navigate(ROUTES.project.foundation(projectId));
      } catch (error) {
        setNotice(
          error instanceof ApiClientError
            ? `Gagal memilih konsep (${error.message}).`
            : "Gagal memilih konsep.",
        );
      } finally {
        setSelectingId(null);
      }
    },
    [apiMode, navigate, projectId, token],
  );

  return useMemo(
    () => ({
      concepts,
      pageCopy: CONCEPTS_PAGE_COPY,
      source,
      loading,
      generating,
      selectingId,
      notice,
      apiMode,
      generate,
      selectConceptById,
    }),
    [
      concepts,
      source,
      loading,
      generating,
      selectingId,
      notice,
      apiMode,
      generate,
      selectConceptById,
    ],
  );
}