import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api";
import { shouldUseMocks } from "@/lib/env";
import { resolveProjectIdForRoute } from "@/lib/project-context";
import {
  createDraftImport,
  extractDraftImportSignals,
  materializeDraftImportProposals,
  resumeDraftImportJob,
  type DraftImportSignal,
  type DraftImportSummary,
  type ImportJobSummary,
} from "@/services/draftImport";

export interface DraftImportData {
  projectId: string | null;
  draftImport: DraftImportSummary | null;
  importJob: ImportJobSummary | null;
  signals: DraftImportSignal[];
  content: string;
  loading: boolean;
  importing: boolean;
  extracting: boolean;
  resuming: boolean;
  materializing: boolean;
  proposalCount: number | null;
  notice: string | null;
  apiMode: boolean;
  setContent: (value: string) => void;
  importDraft: () => Promise<void>;
  extractSignals: () => Promise<void>;
  resumePrep: () => Promise<void>;
  materializeProposals: () => Promise<void>;
}

function mapError(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return `${fallback} (${error.message}).`;
  }
  return fallback;
}

export function useDraftImportData(): DraftImportData {
  const { id: routeProjectId } = useParams();
  const { session: authSession } = useAuth();
  const token = authSession?.access_token ?? null;
  const apiMode = !shouldUseMocks() && Boolean(token);

  const [projectId, setProjectId] = useState<string | null>(routeProjectId ?? null);
  const [draftImport, setDraftImport] = useState<DraftImportSummary | null>(null);
  const [importJob, setImportJob] = useState<ImportJobSummary | null>(null);
  const [signals, setSignals] = useState<DraftImportSignal[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [proposalCount, setProposalCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(
    apiMode ? null : "Masuk ke akun untuk menyimpan dan menganalisis draft.",
  );

  const resolveProjectId = useCallback(async (): Promise<string | null> => {
    if (!apiMode || !token) return null;
    setLoading(true);
    try {
      const resolved = await resolveProjectIdForRoute(routeProjectId, token);
      setProjectId(resolved);
      if (!resolved) {
        setNotice("Proyek tidak ditemukan.");
      }
      return resolved;
    } finally {
      setLoading(false);
    }
  }, [apiMode, routeProjectId, token]);

  const importDraft = useCallback(async () => {
    if (!apiMode || !token) {
      setNotice("Masuk ke akun untuk mengimpor draft.");
      return;
    }
    const resolvedId = projectId ?? (await resolveProjectId());
    if (!resolvedId) return;

    setImporting(true);
    setNotice(null);
    try {
      const result = await createDraftImport(resolvedId, content, token);
      setDraftImport(result.draftImport);
      const jobResult = await resumeDraftImportJob(resolvedId, result.draftImport.id, token);
      setImportJob(jobResult.importJob);
      setSignals([]);
      setProposalCount(null);
      setNotice("Draft tersimpan. Prep job siap dilanjutkan sebelum review proposal.");
    } catch (error) {
      setNotice(mapError(error, "Gagal mengimpor draft"));
      throw error;
    } finally {
      setImporting(false);
    }
  }, [apiMode, content, projectId, resolveProjectId, token]);

  const resumePrep = useCallback(async () => {
    if (!apiMode || !token || !projectId || !draftImport) {
      setNotice("Impor draft dulu sebelum melanjutkan prep job.");
      return;
    }
    setResuming(true);
    setNotice(null);
    try {
      const result = await resumeDraftImportJob(projectId, draftImport.id, token);
      setImportJob(result.importJob);
      setNotice(result.resumed ? "Prep job dilanjutkan dari fase terakhir." : "Prep job sudah aktif.");
    } catch (error) {
      setNotice(mapError(error, "Gagal melanjutkan prep job"));
      throw error;
    } finally {
      setResuming(false);
    }
  }, [apiMode, draftImport, projectId, token]);

  const extractSignals = useCallback(async () => {
    if (!apiMode || !token || !projectId || !draftImport) {
      setNotice("Impor draft dulu sebelum mengekstrak sinyal.");
      return;
    }
    setExtracting(true);
    setNotice(null);
    try {
      const result = await extractDraftImportSignals(projectId, draftImport.id, token);
      setDraftImport(result.draftImport);
      setSignals(result.signals);
      setProposalCount(null);
      setNotice("Sinyal draft berhasil diekstrak tanpa mengubah canon.");
    } catch (error) {
      setNotice(mapError(error, "Gagal mengekstrak sinyal draft"));
      throw error;
    } finally {
      setExtracting(false);
    }
  }, [apiMode, draftImport, projectId, token]);

  const materializeProposals = useCallback(async () => {
    if (!apiMode || !token || !projectId || !draftImport) {
      setNotice("Impor dan deteksi draft dulu sebelum membuat proposal review.");
      return;
    }
    setMaterializing(true);
    setNotice(null);
    try {
      const result = await materializeDraftImportProposals(projectId, draftImport.id, token);
      setDraftImport(result.draftImport);
      setProposalCount(result.proposalCount);
      setNotice(`${result.proposalCount} proposal siap direview di Fondasi.`);
    } catch (error) {
      setNotice(mapError(error, "Gagal membuat proposal review"));
      throw error;
    } finally {
      setMaterializing(false);
    }
  }, [apiMode, draftImport, projectId, token]);

  return useMemo(
    () => ({
      projectId,
      draftImport,
      importJob,
      signals,
      content,
      loading,
      importing,
      extracting,
      resuming,
      materializing,
      proposalCount,
      notice,
      apiMode,
      setContent,
      importDraft,
      extractSignals,
      resumePrep,
      materializeProposals,
    }),
    [
      projectId,
      draftImport,
      importJob,
      signals,
      content,
      loading,
      importing,
      extracting,
      resuming,
      materializing,
      proposalCount,
      notice,
      apiMode,
      importDraft,
      extractSignals,
      resumePrep,
      materializeProposals,
    ],
  );
}
