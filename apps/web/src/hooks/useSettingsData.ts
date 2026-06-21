import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreatorMode, WriterQualityMode } from "@vibenovel/shared";
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
  selectedCreatorMode: CreatorMode;
  setSelectedCreatorMode: (mode: CreatorMode) => void;
  source: SettingsDataSource;
  loading: boolean;
  saving: boolean;
  notice: string | null;
  saveMessage: string | null;
  handleCancel: () => void;
  handleSave: () => Promise<void>;
}

const emptySettings: UserSettings = {
  displayName: "Memuat...",
  email: "Memuat...",
  planLabel: "Memuat...",
  creditsRemaining: 0,
  monthlyUsage: {
    used: 0,
    quota: 0,
    percentUsed: 0,
    resetLabel: "Memuat...",
    infoMessage: "Memuat pemakaian kuota...",
  },
  modelTiers: mockSettings.modelTiers.map((t) => ({ ...t, isSelected: t.id === "seimbang" })),
  creatorMode: "simple",
  writerPreferences: {
    defaultLanguage: "Indonesia",
    defaultOutputStyle: "Seimbang",
    defaultFormat: "Format HP/KBM",
  },
  pageCopy: {
    ...mockSettings.pageCopy,
    subtitle: "Memuat pengaturan...",
  },
};

const LOCAL_QUALITY_MODE_KEY = "narraza.settings.qualityMode";
const LOCAL_CREATOR_MODE_KEY = "narraza.settings.creatorMode";
const MODEL_TIERS: ModelTier[] = ["hemat", "seimbang", "terbaik"];
const MODEL_TIER_SET = new Set<string>(MODEL_TIERS);
const CREATOR_MODE_SET = new Set<string>(["simple", "advanced"]);

function isModelTier(value: string | null | undefined): value is ModelTier {
  return Boolean(value && MODEL_TIER_SET.has(value));
}

function readStoredQualityTier(): ModelTier {
  if (typeof window === "undefined") return "seimbang";
  const stored = window.localStorage.getItem(LOCAL_QUALITY_MODE_KEY);
  return isModelTier(stored) ? stored : "seimbang";
}

function persistQualityTier(tier: ModelTier): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_QUALITY_MODE_KEY, tier);
}

function isCreatorMode(value: string | null | undefined): value is CreatorMode {
  return Boolean(value && CREATOR_MODE_SET.has(value));
}

function readStoredCreatorMode(): CreatorMode {
  if (typeof window === "undefined") return "simple";
  const stored = window.localStorage.getItem(LOCAL_CREATOR_MODE_KEY);
  return isCreatorMode(stored) ? stored : "simple";
}

function persistCreatorMode(mode: CreatorMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_CREATOR_MODE_KEY, mode);
}

function applySelectedTier(settings: UserSettings, tier: ModelTier): UserSettings {
  return {
    ...settings,
    modelTiers: settings.modelTiers.map((item) => ({
      ...item,
      isSelected: item.id === tier,
    })),
  };
}

function applyCreatorMode(settings: UserSettings, creatorMode: CreatorMode): UserSettings {
  return { ...settings, creatorMode };
}

export function useSettingsData(): SettingsData {
  const { session, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const token = session?.access_token ?? null;

  const [settings, setSettings] = useState<UserSettings>(() => {
    const tier = readStoredQualityTier();
    if (useMocks) return applySelectedTier(mockSettings, tier);
    return applySelectedTier(emptySettings, tier);
  });
  const [selectedTier, setSelectedTier] = useState<ModelTier>(() => readStoredQualityTier());
  const [persistedTier, setPersistedTier] = useState<ModelTier>(() => readStoredQualityTier());
  const [selectedCreatorMode, setSelectedCreatorMode] = useState<CreatorMode>(() =>
    readStoredCreatorMode(),
  );
  const [persistedCreatorMode, setPersistedCreatorMode] = useState<CreatorMode>(() =>
    readStoredCreatorMode(),
  );
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [source, setSource] = useState<SettingsDataSource>(useMocks ? "mock" : "api");
  const [loading, setLoading] = useState(!useMocks && Boolean(token));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (useMocks || !token) {
      const tier = readStoredQualityTier();
      const creatorMode = readStoredCreatorMode();
      setSettings(applyCreatorMode(applySelectedTier(mockSettings, tier), creatorMode));
      setSelectedTier(tier);
      setPersistedTier(tier);
      setSelectedCreatorMode(creatorMode);
      setPersistedCreatorMode(creatorMode);
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
          const storedTier = readStoredQualityTier();
          const storedCreatorMode = readStoredCreatorMode();
          const merged = mergeSettingsWithApi(
            {
              qualityMode: storedTier as WriterQualityMode,
              defaultOutputStyle: "warm_emotional",
              defaultFormat: "hp_kbm",
              creatorMode: storedCreatorMode,
              defaultLanguage: "id",
            },
            creditBalance,
            {
              displayName: me.profile.displayName,
              email: me.profile.email,
              planLabel: me.profile.planLabel,
            },
          );
          setSettings(applyCreatorMode(applySelectedTier(merged, storedTier), storedCreatorMode));
          setSelectedTier(storedTier);
          setPersistedTier(storedTier);
          setSelectedCreatorMode(storedCreatorMode);
          setPersistedCreatorMode(storedCreatorMode);
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
            creatorMode: apiSettings.creatorMode,
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
        const creatorMode = merged.creatorMode;
        setSettings(merged);
        setSelectedTier(tier);
        setPersistedTier(tier);
        setSelectedCreatorMode(creatorMode);
        setPersistedCreatorMode(creatorMode);
        setActiveProjectId(active.id);
        setSource("api");
      } catch (error) {
        if (cancelled) return;
        const tier = readStoredQualityTier();
        const creatorMode = readStoredCreatorMode();
        setSettings(
          applyCreatorMode(
            applySelectedTier(allowMockFallback() ? mockSettings : emptySettings, tier),
            creatorMode,
          ),
        );
        setSelectedTier(tier);
        setPersistedTier(tier);
        setSelectedCreatorMode(creatorMode);
        setPersistedCreatorMode(creatorMode);
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
    setSelectedCreatorMode(persistedCreatorMode);
    setSaveMessage(null);
  }, [persistedCreatorMode, persistedTier]);

  const handleSave = useCallback(async () => {
    setSaveMessage(null);

    if (source !== "api" || !activeProjectId || !token) {
      persistQualityTier(selectedTier);
      persistCreatorMode(selectedCreatorMode);
      setSettings((prev) =>
        applyCreatorMode(applySelectedTier(prev, selectedTier), selectedCreatorMode),
      );
      setSaveMessage("Mode kualitas disimpan di perangkat ini.");
      setPersistedTier(selectedTier);
      setPersistedCreatorMode(selectedCreatorMode);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProjectSettings(
        activeProjectId,
        {
          qualityMode: selectedTier as WriterQualityMode,
          creatorMode: selectedCreatorMode,
        },
        token,
      );
      const tier = updated.qualityMode ?? updated.qualityTier;
      const creatorMode = updated.creatorMode;
      persistQualityTier(tier);
      persistCreatorMode(creatorMode);
      setPersistedTier(tier);
      setSelectedTier(tier);
      setPersistedCreatorMode(creatorMode);
      setSelectedCreatorMode(creatorMode);
      setSettings((prev) => ({
        ...prev,
        creatorMode,
        modelTiers: prev.modelTiers.map((item) => ({
          ...item,
          isSelected: item.id === tier,
        })),
      }));
      setSaveMessage("Mode creator disimpan ke API.");
    } catch (error) {
      setSaveMessage(
        error instanceof ApiClientError
          ? `Gagal menyimpan: ${error.message}`
          : "Gagal menyimpan ke API.",
      );
    } finally {
      setSaving(false);
    }
  }, [activeProjectId, selectedCreatorMode, selectedTier, source, token]);

  return useMemo(
    () => ({
      settings,
      selectedTier,
      setSelectedTier,
      selectedCreatorMode,
      setSelectedCreatorMode,
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
      selectedCreatorMode,
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
