import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { mapApiMessageToUi, mapApiSignalToUi, mapIntakeBundleToUi } from "@/lib/api-mappers";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { apiErrorMessage } from "@/lib/hook-fallback";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import { createEmptyApiIntakeSession } from "@/lib/empty-states";
import { mockIntakeSession } from "@/mocks/intake";
import {
  extractIntakeSignals,
  fetchIntakeBundle,
  sendIntakeMessage,
} from "@/services/intake";
import type { IntakeSession } from "@/types";

export type IntakeDataSource = "mock" | "api" | "error";

export interface IntakeData {
  session: IntakeSession;
  source: IntakeDataSource;
  loading: boolean;
  sending: boolean;
  notice: string | null;
  apiMode: boolean;
  sendMessage: (text: string) => Promise<void>;
  extractSignals: () => Promise<void>;
}

export function useIntakeData(): IntakeData {
  const { id: routeProjectId } = useParams();
  const { session: authSession, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = authSession?.access_token ?? null;
  const apiMode = !useMocks && Boolean(token);

  const [session, setSession] = useState<IntakeSession>(() => {
    if (useMocks) return mockIntakeSession;
    return mapIntakeBundleToUi(
      routeProjectId ?? "unknown",
      createEmptyApiIntakeSession(routeProjectId ?? "unknown"),
      [],
      [],
    );
  });
  const [source, setSource] = useState<IntakeDataSource>(useMocks ? "mock" : "api");
  const [loading, setLoading] = useState(apiMode);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const loadBundle = useCallback(async () => {
    if (!apiMode || !token) return;

    setLoading(true);
    setNotice(null);

    try {
      const resolvedId = await resolveProjectIdForRoute(routeProjectId, token);
      if (!resolvedId) {
        if (allowMockFallback()) {
          setSession(mockIntakeSession);
          setSource("mock");
          setNotice("Proyek tidak ditemukan. Menampilkan demo intake.");
        } else {
          setSession(
            mapIntakeBundleToUi(
              routeProjectId ?? "unknown",
              createEmptyApiIntakeSession(routeProjectId ?? "unknown"),
              [],
              [],
            ),
          );
          setSource("error");
          setNotice("Proyek tidak ditemukan.");
        }
        return;
      }

      setProjectId(resolvedId);
      const bundle = await fetchIntakeBundle(resolvedId, token);
      setSession(
        mapIntakeBundleToUi(resolvedId, bundle.session, bundle.messages, bundle.signals),
      );
      setSource("api");
    } catch (error) {
      if (allowMockFallback()) {
        setSession(mockIntakeSession);
        setSource("mock");
        setNotice(apiErrorMessage(error, "API tidak tersedia. Menampilkan demo Sprint 1."));
      } else {
        setSession(
          mapIntakeBundleToUi(
            routeProjectId ?? "unknown",
            createEmptyApiIntakeSession(routeProjectId ?? "unknown"),
            [],
            [],
          ),
        );
        setSource("error");
        setNotice(apiErrorMessage(error, "API tidak tersedia."));
      }
    } finally {
      setLoading(false);
    }
  }, [apiMode, routeProjectId, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!apiMode) {
      setSession(mockIntakeSession);
      setSource("mock");
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk menyimpan obrolan intake ke API.");
      return;
    }

    void loadBundle();
  }, [authLoading, apiMode, loadBundle, useMocks]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!apiMode || !token || !projectId) {
        setSession((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: `local-${Date.now()}`,
              role: "user" as const,
              content: text,
              timestamp: new Date().toISOString(),
            },
          ],
        }));
        return;
      }

      setSending(true);
      try {
        const result = await sendIntakeMessage(projectId, text, token);
        const userMsg = mapApiMessageToUi(result.userMessage);
        const agentMsg = mapApiMessageToUi(result.agentMessage);

        setSession((prev) => ({
          ...prev,
          messages: [...prev.messages, userMsg, agentMsg],
          progressPercent: result.session.progressPercent ?? prev.progressPercent,
        }));

        await extractIntakeSignals(projectId, token).then((extracted) => {
          if (extracted.signals.length > 0) {
            setSession((prev) => ({
              ...prev,
              detectedSignals: extracted.signals.map(mapApiSignalToUi),
            }));
          }
        });
      } catch (error) {
        setNotice(
          error instanceof ApiClientError
            ? `Gagal mengirim pesan (${error.message}).`
            : "Gagal mengirim pesan ke API.",
        );
        throw error;
      } finally {
        setSending(false);
      }
    },
    [apiMode, projectId, token],
  );

  const extractSignals = useCallback(async () => {
    if (!apiMode || !token || !projectId) return;

    try {
      const result = await extractIntakeSignals(projectId, token);
      if (result.signals.length > 0) {
        setSession((prev) => ({
          ...prev,
          detectedSignals: result.signals.map(mapApiSignalToUi),
        }));
      }
    } catch (error) {
      setNotice(
        error instanceof ApiClientError
          ? `Gagal mengekstrak sinyal (${error.message}).`
          : "Gagal mengekstrak sinyal.",
      );
    }
  }, [apiMode, projectId, token]);

  return useMemo(
    () => ({
      session,
      source,
      loading,
      sending,
      notice,
      apiMode,
      sendMessage,
      extractSignals,
    }),
    [session, source, loading, sending, notice, apiMode, sendMessage, extractSignals],
  );
}