import { useState } from "react";
import { ApiClientError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { archiveProject } from "@/services/projects";
import { Button, Icon } from "@/components/ui";

export interface DeleteProjectConfirmModalProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteProjectConfirmModal({
  projectId,
  projectTitle,
  open,
  onClose,
  onDeleted,
}: DeleteProjectConfirmModalProps) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const useMocks = shouldUseMocks();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    setError(null);

    if (useMocks || !token) {
      onDeleted?.();
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await archiveProject(projectId, token);
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Gagal menghapus proyek. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-danger/30 bg-surface p-lg shadow-lg">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <Icon name="warning" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="delete-project-title"
              className="font-headline-sm text-headline-sm text-on-surface"
            >
              Hapus proyek?
            </h2>
            <p id="delete-project-desc" className="mt-2 font-body-sm text-body-sm text-muted-text">
              Anda akan menghapus{" "}
              <strong className="font-medium text-on-surface">&quot;{projectTitle}&quot;</strong>{" "}
              dari daftar aktif. Proyek tidak bisa dibuka lagi dari dashboard, tetapi data di server
              tidak dihapus permanen.
            </p>
            <p className="mt-2 font-body-sm text-body-sm text-muted-text">
              Tindakan ini tidak bisa dibatalkan dari aplikasi. Pastikan Anda sudah yakin.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-md font-body-sm text-body-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-lg flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-danger text-on-primary hover:opacity-90"
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {submitting ? "Menghapus..." : "Ya, hapus proyek"}
          </Button>
        </div>
      </div>
    </div>
  );
}