import { useCallback, useEffect, useId, useState } from "react";
import type { IntakeMessage } from "@/types";
import { INTAKE_DUMMY_REPLY } from "@/mocks/intake";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { SuggestedActionChips } from "./SuggestedActionChips";

export interface ChatPanelProps {
  introTitle: string;
  introSubtitle: string;
  initialMessages: IntakeMessage[];
  suggestedActions: string[];
  inputPlaceholder: string;
  inputTip: string;
  apiMode?: boolean;
  sending?: boolean;
  onSendMessage?: (text: string) => Promise<void>;
}

function createMessage(role: IntakeMessage["role"], content: string): IntakeMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

/** Sprint 1 — local state only. TODO: Sprint 3 chat persistence + real agent */
export function ChatPanel({
  introTitle,
  introSubtitle,
  initialMessages,
  suggestedActions,
  inputPlaceholder,
  inputTip,
  apiMode = false,
  sending = false,
  onSendMessage,
}: ChatPanelProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [chipDraft, setChipDraft] = useState<string | undefined>();
  const listId = useId();

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      setChipDraft(undefined);

      if (apiMode && onSendMessage) {
        await onSendMessage(text);
        return;
      }

      setMessages((prev) => [
        ...prev,
        createMessage("user", text),
        createMessage("agent", INTAKE_DUMMY_REPLY),
      ]);
    },
    [apiMode, onSendMessage],
  );

  const handleChipSelect = useCallback((action: string) => {
    setChipDraft(action);
  }, []);

  return (
    <section className="relative flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm lg:min-h-[560px]">
      <div
        id={listId}
        className="flex flex-1 flex-col gap-8 overflow-y-auto scroll-smooth p-6"
      >
        <div className="mx-auto mb-4 flex max-w-md flex-col items-center text-center">
          <h3 className="mb-2 font-headline-lg text-headline-lg text-on-background">
            {introTitle}
          </h3>
          <p className="font-body-md text-body-md text-muted-text">{introSubtitle}</p>
        </div>

        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
      </div>

      <SuggestedActionChips actions={suggestedActions} onSelect={handleChipSelect} />

      <ChatInput
        placeholder={inputPlaceholder}
        tip={inputTip}
        onSend={handleSend}
        disabled={sending}
        externalValue={chipDraft}
        onExternalValueConsumed={() => setChipDraft(undefined)}
      />
    </section>
  );
}