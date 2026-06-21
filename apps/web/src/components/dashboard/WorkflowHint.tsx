import { workflowStatusTooltip } from "@/lib/workflow-tooltips";

export interface WorkflowHintProps {
  label: string;
  className?: string;
}

/** Short workflow label with optional native tooltip (doc 113 C2). */
export function WorkflowHint({ label, className = "" }: WorkflowHintProps) {
  const tip = workflowStatusTooltip(label);
  return (
    <span
      className={className}
      title={tip}
      aria-label={tip ? `${label}. ${tip}` : label}
    >
      {label}
    </span>
  );
}