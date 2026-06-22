import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui";

export interface ProjectCardActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  /** Disable delete (e.g. demo project in mock mode) */
  deleteDisabled?: boolean;
  className?: string;
}

export function ProjectCardActionsMenu({
  onEdit,
  onDelete,
  deleteDisabled,
  className = "",
}: ProjectCardActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="rounded-full p-2 text-muted-text transition-colors hover:bg-surface-soft hover:text-on-surface"
        aria-label="Opsi proyek"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="more_vert" size={20} />
      </button>

      {open ? (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-border bg-surface py-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-label-md text-label-md text-on-surface hover:bg-surface-soft"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Icon name="edit" size={18} className="text-muted-text" />
              Ubah nama
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              disabled={deleteDisabled}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-label-md text-label-md text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Icon name="delete" size={18} />
              Hapus proyek
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}