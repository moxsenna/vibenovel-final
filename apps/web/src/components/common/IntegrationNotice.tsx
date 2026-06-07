export interface IntegrationNoticeProps {
  message: string | null;
  className?: string;
}

/** Small non-blocking note when API/mock fallback is active. */
export function IntegrationNotice({ message, className = "" }: IntegrationNoticeProps) {
  if (!message) return null;

  return (
    <p
      className={[
        "rounded-lg border border-border bg-surface-soft px-3 py-2 font-body-sm text-body-sm text-muted-text",
        className,
      ].join(" ")}
      role="status"
    >
      {message}
    </p>
  );
}