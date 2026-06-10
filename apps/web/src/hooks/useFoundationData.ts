import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { mapFoundationBundleToUi, resolveApiProjectId } from "@/lib/api-mappers";
import { createEmptyApiFoundation } from "@/lib/empty-states";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { apiErrorMessage } from "@/lib/hook-fallback";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import { mockStoryFoundation } from "@/mocks/storyFoundation";
import { fetchFoundationBundle } from "@/services/foundation";
import { fetchProjects, pickActiveProject } from "@/services/projects";
import type { StoryFoundation } from "@/types/storyFoundation";

export type FoundationDataSource = "mock" | "api" | "error";

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
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk membaca fondasi dari API.");
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