import { useCallback, useEffect, useMemo, useState } from "react";
import type { WriterQualityMode } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { mergeSettingsWithApi } from "@/lib/api-mappers";
import { allowMockFallback, shouldUseMocks } from "@/lib/env";
import { apiErrorMessage } from "@/lib/hook-fallback";
import { DEMO_MODE_LABEL } from "@/lib/workflow-truth";
import { mockSettings } from "@/mocks/settings";
import { fetchCreditBalance } from "@/services/credits";
import { fetchMe } from "@/services/me";
import { fetchProjectSettings, updateProjectSettings } from "@/services/settings";
import { fetchProjects, pickActiveProject } from "@/services/projects";
import type { ModelTier, UserSettings } from "@/types";

export type SettingsDataSource = "mock" | "api" | "error";

export interface SettingsData {
  settings: UserSettings;
  selectedTier: ModelTier;
  setSelectedTier: (tier: ModelTier) => void;
  source: SettingsDataSource;
  loading: boolean;
  saving: boolean;
  notice: string | null;
  saveMessage: string | null;
  handleCancel: () => void;
  handleSave: () => Promise<void>;
}

export function useSettingsData(): SettingsData {
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;

  const [settings, setSettings] = useState<UserSettings>(mockSettings);
  const [selectedTier, setSelectedTier] = useState<ModelTier>("seimbang");
  const [persistedTier, setPersistedTier] = useState<ModelTier>("seimbang");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [source, setSource] = useState<SettingsDataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (useMocks || !token) {
      setSettings(mockSettings);
      setSelectedTier("seimbang");
      setPersistedTier("seimbang");
      setActiveProjectId(null);
      setSource("mock");
      setNotice(useMocks ? DEMO_MODE_LABEL : "Masuk ke akun untuk menyimpan pengaturan ke API.");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotice(null);
      setSaveMessage(null);

      try {
        const projects = await fetchProjects(token);
        const active = pickActiveProject(projects);
        if (!active) {
          if (cancelled) return;
          const [creditBalance, me] = await Promise.all([
            fetchCreditBalance(token),
            fetchMe(token),
          ]);
          if (cancelled) return;
          const merged = mergeSettingsWithApi(
            {
              qualityMode: "seimbang",
              defaultOutputStyle: "warm_emotional",
              defaultFormat: "hp_kbm",
              defaultLanguage: "id",
            },
            creditBalance,
            {
              displayName: me.profile.displayName,
              email: me.profile.email,
              planLabel: me.profile.planLabel,
            },
          );
          setSettings(merged);
          setSelectedTier("seimbang");
          setPersistedTier("seimbang");
          setActiveProjectId(null);
          setSource("api");
          setNotice("Belum ada proyek aktif. Pengaturan penulis per-proyek akan aktif setelah Anda membuat proyek.");
          return;
        }

        const [apiSettings, creditBalance, me] = await Promise.all([
          fetchProjectSettings(active.id, token),
          fetchCreditBalance(token),
          fetchMe(token),
        ]);

        if (cancelled) return;

        const merged = mergeSettingsWithApi(
          {
            qualityMode: apiSettings.qualityMode ?? apiSettings.qualityTier,
            defaultOutputStyle: apiSettings.defaultOutputStyle,
            defaultFormat: apiSettings.defaultFormat,
            defaultLanguage: apiSettings.defaultLanguage,
          },
          creditBalance,
          {
            displayName: me.profile.displayName,
            email: me.profile.email,
            planLabel: me.profile.planLabel,
          },
        );

        const tier = merged.modelTiers.find((t) => t.isSelected)?.id ?? "seimbang";
        setSettings(merged);
        setSelectedTier(tier);
        setPersistedTier(tier);
        setActiveProjectId(active.id);
        setSource("api");
      } catch (error) {
        if (cancelled) return;
        setSettings(allowMockFallback() ? mockSettings : mockSettings);
        setSelectedTier("seimbang");
        setPersistedTier("seimbang");
        setActiveProjectId(null);
        setSource(allowMockFallback() ? "mock" : "error");
        setNotice(apiErrorMessage(error, "API tidak tersedia."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, token, useMocks]);

  const handleCancel = useCallback(() => {
    setSelectedTier(persistedTier);
    setSaveMessage(null);
  }, [persistedTier]);

  const handleSave = useCallback(async () => {
    setSaveMessage(null);

    if (source !== "api" || !activeProjectId || !token) {
      setSaveMessage("Pengaturan disimpan secara lokal (mock mode).");
      setPersistedTier(selectedTier);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProjectSettings(
        activeProjectId,
        { qualityMode: selectedTier as WriterQualityMode },
        token,
      );
      const tier = updated.qualityMode ?? updated.qualityTier;
      setPersistedTier(tier);
      setSelectedTier(tier);
      setSettings((prev) => ({
        ...prev,
        modelTiers: prev.modelTiers.map((item) => ({
          ...item,
          isSelected: item.id === tier,
        })),
      }));
      setSaveMessage("Mode kualitas disimpan ke API.");
    } catch (error) {
      setSaveMessage(
        error instanceof ApiClientError
          ? `Gagal menyimpan: ${error.message}`
          : "Gagal menyimpan ke API.",
      );
    } finally {
      setSaving(false);
    }
  }, [activeProjectId, selectedTier, source, token]);

  return useMemo(
    () => ({
      settings,
      selectedTier,
      setSelectedTier,
      source,
      loading,
      saving,
      notice,
      saveMessage,
      handleCancel,
      handleSave,
    }),
    [
      settings,
      selectedTier,
      source,
      loading,
      saving,
      notice,
      saveMessage,
      handleCancel,
      handleSave,
    ],
  );
}