import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui";

export interface ChatInputProps {
  placeholder: string;
  tip: string;
  onSend: (text: string) => void;
  externalValue?: string;
  onExternalValueConsumed?: () => void;
}

export function ChatInput({
  placeholder,
  tip,
  onSend,
  externalValue,
  onExternalValueConsumed,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (externalValue !== undefined) {
      setValue(externalValue);
    }
  }, [externalValue]);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
    onExternalValueConsumed?.();
  }, [value, onSend, onExternalValueConsumed]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-surface p-4">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 transition-all focus-within:border-primary-container focus-within:ring-1 focus-within:ring-primary-container">
        <button
          type="button"
          aria-label="Input suara — belum tersedia"
          className="flex-shrink-0 rounded-lg p-2 text-muted-text transition-colors hover:text-primary"
          disabled
        >
          <Icon name="mic" size={24} />
        </button>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="max-h-32 w-full resize-none border-none bg-transparent py-2 font-body-md text-body-md text-on-background placeholder:text-muted-text focus:ring-0"
        />
        <button
          type="button"
          aria-label="Kirim"
          onClick={handleSend}
          className="flex-shrink-0 rounded-lg bg-primary p-2 text-on-primary shadow-sm transition-colors hover:bg-primary-dark min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Icon name="send" size={20} filled />
        </button>
      </div>
      <p className="mt-2 text-center font-label-sm text-label-sm text-muted-text">{tip}</p>
    </div>
  );
}