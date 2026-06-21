import { useCallback, useEffect, useState } from "react";
import type {
  Character,
  CharacterKnowledge,
  CharacterKnowledgeStatus,
  CharacterState,
  Fact,
  OpenLoop,
  OpenLoopStatus,
  PlannedRevealStatus,
} from "@vibenovel/shared";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { fetchOutlineBundle, type PlannedRevealPublic } from "@/services/outline";
import { fetchProjectSettings, type ProjectSettingsApiResponse } from "@/services/settings";
import {
  DEFAULT_OPERATIONAL_STYLE_RULES,
  fetchCharacterContinuity,
  fetchStoryControlCharacters,
  fetchStoryControlFacts,
  fetchStyleProfile,
  patchStoryFact,
  patchStoryOpenLoop,
  patchStoryReveal,
  putCharacterKnowledge,
  putCharacterState,
  putStyleProfile,
  type OperationalStyleRules,
  type StyleProfile,
} from "@/services/storyControl";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan yang tidak dikenal.";
}

function confirmChange(message: string): boolean {
  return window.confirm(message);
}

export function useStoryControlData() {
  const { id: projectId = "" } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const apiMode = !shouldUseMocks();

  const [settings, setSettings] = useState<ProjectSettingsApiResponse | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [openLoops, setOpenLoops] = useState<OpenLoop[]>([]);
  const [reveals, setReveals] = useState<PlannedRevealPublic[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterState, setCharacterState] = useState<CharacterState | null>(null);
  const [characterStateHistory, setCharacterStateHistory] = useState<CharacterState[]>([]);
  const [characterKnowledge, setCharacterKnowledge] = useState<CharacterKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [continuityLoading, setContinuityLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!projectId) return;
    if (!apiMode || !token) {
      setSettings(null);
      setLoading(false);
      setNotice("Story Control membutuhkan sesi API dan Creator Mode Advanced.");
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const [nextSettings, nextFacts, outline, nextCharacters, nextStyleProfile] =
        await Promise.all([
          fetchProjectSettings(projectId, token),
          fetchStoryControlFacts(projectId, token),
          fetchOutlineBundle(projectId, token),
          fetchStoryControlCharacters(projectId, token),
          fetchStyleProfile(projectId, token),
        ]);
      setSettings(nextSettings);
      setFacts(nextFacts);
      setOpenLoops(outline.openLoops);
      setReveals(outline.plannedReveals);
      setCharacters(nextCharacters);
      setStyleProfile(nextStyleProfile);
      setSelectedCharacterId((current) => current ?? nextCharacters[0]?.id ?? null);
    } catch (error) {
      setNotice(`Gagal memuat Story Control: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [apiMode, projectId, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!projectId || !token || !selectedCharacterId || settings?.creatorMode !== "advanced") {
      setCharacterState(null);
      setCharacterStateHistory([]);
      setCharacterKnowledge([]);
      return;
    }

    let cancelled = false;
    setContinuityLoading(true);
    void fetchCharacterContinuity(projectId, selectedCharacterId, token)
      .then((result) => {
        if (cancelled) return;
        setCharacterState(result.state.state);
        setCharacterStateHistory(result.state.history);
        setCharacterKnowledge(result.knowledge.knowledge);
      })
      .catch((error) => {
        if (!cancelled) setNotice(`Gagal memuat continuity: ${errorMessage(error)}`);
      })
      .finally(() => {
        if (!cancelled) setContinuityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, selectedCharacterId, settings?.creatorMode, token]);

  const toggleFactLock = useCallback(
    async (fact: Fact) => {
      if (!projectId || !confirmChange(
        `${fact.isLocked ? "Buka kunci" : "Kunci"} fakta canon ini? Perubahan akan dicatat di audit log.`,
      )) return;
      setSavingKey(`fact:${fact.id}`);
      try {
        const updated = await patchStoryFact(projectId, fact.id, { isLocked: !fact.isLocked }, token);
        setFacts((current) => current.map((item) => item.id === updated.id ? updated : item));
        setNotice("Status fakta canon diperbarui.");
      } catch (error) {
        setNotice(`Gagal memperbarui fakta: ${errorMessage(error)}`);
      } finally {
        setSavingKey(null);
      }
    },
    [projectId, token],
  );

  const updateOpenLoopStatus = useCallback(
    async (loopId: string, status: OpenLoopStatus) => {
      if (!projectId || !confirmChange("Ubah status open loop ini?")) return;
      setSavingKey(`loop:${loopId}`);
      try {
        const updated = await patchStoryOpenLoop(projectId, loopId, { status }, token);
        setOpenLoops((current) => current.map((item) => item.id === updated.id ? updated : item));
        setNotice("Status open loop diperbarui.");
      } catch (error) {
        setNotice(`Gagal memperbarui open loop: ${errorMessage(error)}`);
      } finally {
        setSavingKey(null);
      }
    },
    [projectId, token],
  );

  const updateRevealStatus = useCallback(
    async (revealId: string, status: PlannedRevealStatus) => {
      if (!projectId || !confirmChange("Ubah status jadwal reveal ini?")) return;
      setSavingKey(`reveal:${revealId}`);
      try {
        const updated = await patchStoryReveal(projectId, revealId, { status }, token);
        setReveals((current) => current.map((item) => item.id === updated.id ? updated : item));
        setNotice("Status reveal diperbarui.");
      } catch (error) {
        setNotice(`Gagal memperbarui reveal: ${errorMessage(error)}`);
      } finally {
        setSavingKey(null);
      }
    },
    [projectId, token],
  );

  const replaceRevealTruth = useCallback(
    async (revealId: string, planningTruth: string) => {
      const trimmed = planningTruth.trim();
      if (!projectId || !trimmed) {
        setNotice("Nilai rahasia pengganti tidak boleh kosong.");
        return false;
      }
      if (!confirmChange(
        "Ganti planning truth? Nilai lama tidak ditampilkan dan perubahan ini tidak dapat dibatalkan dari Story Control.",
      )) return false;
      setSavingKey(`truth:${revealId}`);
      try {
        await patchStoryReveal(
          projectId,
          revealId,
          { planningTruth: trimmed, confirmation: "UPDATE_PLANNING_TRUTH" },
          token,
        );
        setNotice("Planning truth diganti tanpa menampilkan nilai mentahnya ke client.");
        return true;
      } catch (error) {
        setNotice(`Gagal mengganti planning truth: ${errorMessage(error)}`);
        return false;
      } finally {
        setSavingKey(null);
      }
    },
    [projectId, token],
  );

  const saveCharacterState = useCallback(
    async (input: {
      chapterNumber: number;
      emotionalState?: string | null;
      physicalState?: string | null;
      currentGoal?: string | null;
    }) => {
      if (!projectId || !selectedCharacterId || !confirmChange(
        "Simpan snapshot continuity tokoh ini? Perubahan akan memengaruhi konteks bab berikutnya.",
      )) return;
      setSavingKey("character-state");
      try {
        const updated = await putCharacterState(
          projectId,
          selectedCharacterId,
          { confirmation: "UPDATE_CONTINUITY_STATE", ...input },
          token,
        );
        setCharacterState(updated);
        setCharacterStateHistory((current) => {
          const withoutSameChapter = current.filter(
            (item) => item.chapterNumber !== updated.chapterNumber,
          );
          return [...withoutSameChapter, updated].sort(
            (a, b) => a.chapterNumber - b.chapterNumber,
          );
        });
        setNotice("Continuity state diperbarui.");
      } catch (error) {
        setNotice(`Gagal memperbarui continuity state: ${errorMessage(error)}`);
      } finally {
        setSavingKey(null);
      }
    },
    [projectId, selectedCharacterId, token],
  );

  const saveCharacterKnowledge = useCallback(
    async (factId: string, knowledgeStatus: CharacterKnowledgeStatus) => {
      if (!projectId || !selectedCharacterId || !confirmChange(
        "Ubah pengetahuan tokoh terhadap fakta ini?",
      )) return;
      setSavingKey(`knowledge:${factId}`);
      try {
        const updated = await putCharacterKnowledge(
          projectId,
          selectedCharacterId,
          factId,
          { confirmation: "UPDATE_CONTINUITY_KNOWLEDGE", knowledgeStatus },
          token,
        );
        setCharacterKnowledge((current) => [
          ...current.filter((item) => item.factId !== factId),
          updated,
        ]);
        setNotice("Pengetahuan tokoh diperbarui.");
      } catch (error) {
        setNotice(`Gagal memperbarui pengetahuan tokoh: ${errorMessage(error)}`);
      } finally {
        setSavingKey(null);
      }
    },
    [projectId, selectedCharacterId, token],
  );

  const saveStyleProfile = useCallback(
    async (rules: OperationalStyleRules) => {
      if (!projectId || !confirmChange(
        "Simpan Voice Lock ini? Aturan operasional akan dipakai oleh Writer dan validator gaya.",
      )) return;
      setSavingKey("style-profile");
      try {
        const updated = await putStyleProfile(projectId, rules, token);
        setStyleProfile(updated);
        setNotice(`Voice Lock disimpan sebagai versi ${updated.version}.`);
      } catch (error) {
        setNotice(`Gagal menyimpan Voice Lock: ${errorMessage(error)}`);
      } finally {
        setSavingKey(null);
      }
    },
    [projectId, token],
  );

  return {
    projectId,
    apiMode,
    settings,
    facts,
    openLoops,
    reveals,
    characters,
    styleProfile,
    effectiveStyleRules: styleProfile?.operationalRules ?? DEFAULT_OPERATIONAL_STYLE_RULES,
    selectedCharacterId,
    characterState,
    characterStateHistory,
    characterKnowledge,
    loading,
    continuityLoading,
    savingKey,
    notice,
    setSelectedCharacterId,
    toggleFactLock,
    updateOpenLoopStatus,
    updateRevealStatus,
    replaceRevealTruth,
    saveCharacterState,
    saveCharacterKnowledge,
    saveStyleProfile,
    reload: loadAll,
  };
}
