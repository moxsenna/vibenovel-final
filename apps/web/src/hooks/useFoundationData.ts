import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { mapFoundationBundleToUi, resolveApiProjectId } from "@/lib/api-mappers";
import { shouldUseMocks } from "@/lib/env";
import { mockStoryFoundation } from "@/mocks/storyFoundation";
import { fetchFoundationBundle } from "@/services/foundation";
import { fetchProjects, pickActiveProject } from "@/services/projects";
import type { StoryFoundation } from "@/types/storyFoundation";

export type FoundationDataSource = "mock" | "api" | "api-fallback";

export interface FoundationData {
  foundation: StoryFoundation;
  source: FoundationDataSource;
  loading: boolean;
  notice: string | null;
}

export function useFoundationData(): FoundationData {
  const { id: routeProjectId } = useParams();
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;

  const [foundation, setFoundation] = useState<StoryFoundation>(mockStoryFoundation);
  const [source, setSource] = useState<FoundationDataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (useMocks || !token) {
      setFoundation(mockStoryFoundation);
      setSource("mock");
      setNotice(
        useMocks
          ? null
          : "Masuk ke akun untuk membaca fondasi dari API. Menampilkan mock Sprint 1.",
      );
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotice(null);

      try {
        const projects = await fetchProjects(token);
        const active = pickActiveProject(projects);
        const projectId = resolveApiProjectId(routeProjectId, active?.id ?? null);

        if (!projectId) {
          if (cancelled) return;
          setFoundation(mockStoryFoundation);
          setSource("api-fallback");
          setNotice("Proyek tidak ditemukan. Menampilkan mock fondasi.");
          return;
        }

        const bundle = await fetchFoundationBundle(projectId, token);
        if (cancelled) return;

        setFoundation(
          mapFoundationBundleToUi(
            projectId,
            bundle.foundation,
            bundle.characters,
            bundle.facts,
          ),
        );
        setSource("api");
      } catch (error) {
        if (cancelled) return;
        setFoundation(mockStoryFoundation);
        setSource("api-fallback");
        setNotice(
          error instanceof ApiClientError
            ? `API tidak tersedia (${error.message}). Menampilkan mock Sprint 1.`
            : "API tidak tersedia. Menampilkan mock Sprint 1.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, routeProjectId, token, useMocks]);

  return useMemo(
    () => ({
      foundation,
      source,
      loading,
      notice,
    }),
    [foundation, source, loading, notice],
  );
}