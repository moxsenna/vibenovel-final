import { useCallback, useState, type ReactNode } from "react";
import { DeleteProjectConfirmModal } from "@/components/dashboard/DeleteProjectConfirmModal";
import { EditProjectTitleModal } from "@/components/dashboard/EditProjectTitleModal";

export interface ProjectManageTarget {
  id: string;
  title: string;
}

export interface UseProjectManageModalsOptions {
  onChanged?: () => void;
}

export function useProjectManageModals(options: UseProjectManageModalsOptions = {}) {
  const { onChanged } = options;
  const [editTarget, setEditTarget] = useState<ProjectManageTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectManageTarget | null>(null);

  const openEdit = useCallback((id: string, title: string) => {
    setEditTarget({ id, title });
  }, []);

  const openDelete = useCallback((id: string, title: string) => {
    setDeleteTarget({ id, title });
  }, []);

  const modals: ReactNode = (
    <>
      {editTarget ? (
        <EditProjectTitleModal
          projectId={editTarget.id}
          initialTitle={editTarget.title}
          open
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            onChanged?.();
          }}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteProjectConfirmModal
          projectId={deleteTarget.id}
          projectTitle={deleteTarget.title}
          open
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            onChanged?.();
          }}
        />
      ) : null}
    </>
  );

  return { openEdit, openDelete, modals };
}