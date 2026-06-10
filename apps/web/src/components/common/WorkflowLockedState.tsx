import { Link } from "react-router-dom";
import { Icon } from "@/components/ui";

export interface WorkflowLockedStateProps {
  title: string;
  description: string;
  hint?: string | null;
  backRoute?: string;
  backLabel?: string;
}

/** Honest empty/locked state when a workflow step is not yet available. */
export function WorkflowLockedState({
  title,
  description,
  hint,
  backRoute,
  backLabel = "Kembali ke dashboard",
}: WorkflowLockedStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-detail flex-col items-center gap-4 rounded-xl border border-border bg-surface-soft p-xl text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-muted-text">
        <Icon name="lock" size={24} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
        {hint ? (
          <p className="font-body-sm text-body-sm text-muted-text">{hint}</p>
        ) : null}
      </div>
      {backRoute ? (
        <Link
          to={backRoute}
          className="rounded-xl border border-border bg-surface px-4 py-2 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container min-h-[44px]"
        >
          {backLabel}
        </Link>
      ) : null}
    </div>
  );
}