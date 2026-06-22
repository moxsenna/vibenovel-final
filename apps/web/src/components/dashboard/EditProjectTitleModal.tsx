import { useEffect, useState, type FormEvent } from "react";
import { ApiClientError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { updateProject } from "@/services/projects";
import { Button, Input } from "@/components/ui";

const TITLE_MAX = 120;

export interface EditProjectTitleModalProps {
  projectId: string;
  initialTitle: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (title: string) => void;
}

export function EditProjectTitleModal({
  projectId,
  initialTitle,
  open,
  onClose,
  onSaved,
}: EditProjectTitleModalProps) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const useMocks = shouldUseMocks();

  const [title, setTitle] = useState(initialTitle);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setError(null);
    }
  }, [open, initialTitle]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Judul tidak boleh kosong.");
      return;
    }
    if (trimmed.length > TITLE_MAX) {
      setError(`Judul maksimal ${TITLE_MAX} karakter.`);
      return;
    }

    if (useMocks || !token) {
      onSaved?.(trimmed);
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateProject(projectId, { title: trimmed }, token);
      onSaved?.(updated.title);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Gagal menyimpan judul. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-project-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-lg shadow-lg">
        <h2 id="edit-project-title" className="font-headline-sm text-headline-sm text-on-surface">
          Ubah nama proyek
        </h2>
        <p className="mt-1 font-body-sm text-body-sm text-muted-text">
          Judul ini tampil di dashboard dan daftar proyek Anda.
        </p>

        <form className="mt-lg flex flex-col gap-md" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 font-label-sm text-label-sm text-on-surface-variant">
            Nama proyek
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              autoFocus
              disabled={submitting}
              aria-invalid={Boolean(error)}
            />
          </label>

          {error ? (
            <p className="font-body-sm text-body-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}