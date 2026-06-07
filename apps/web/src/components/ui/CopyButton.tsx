import { useCallback, useState } from "react";
import { Icon } from "./Icon";

export interface CopyButtonProps {
  /** Text to copy — Sprint 1 dummy clipboard only */
  value: string;
  label?: string;
  className?: string;
}

/**
 * Dummy copy button — UI feedback only.
 * TODO: Sprint 2+ — integrate with real publish workflow if needed.
 */
export function CopyButton({ value, label = "Salin", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={[
        "text-primary hover:bg-primary-soft p-2 rounded-full transition-colors",
        "flex items-center justify-center min-h-[44px] min-w-[44px]",
        className,
      ].join(" ")}
    >
      {copied ? (
        <Icon name="check" size={20} className="text-tertiary-container" />
      ) : (
        <Icon name="content_copy" size={20} />
      )}
    </button>
  );
}